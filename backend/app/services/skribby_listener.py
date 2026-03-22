"""
Skribby real-time WebSocket listener — connects to Skribby's websocket_url
and forwards transcript/status events into the backend pipeline.

Sprint 4 hardening:
- Intelligent reconnection: checks bot status via REST API before retrying.
- Error-event fallback: polls Skribby REST for post-meeting transcript when
  real-time stream encounters errors.
"""

from __future__ import annotations

import json
import logging
from asyncio import sleep
from typing import Any

import websockets

from app.services.skribby import get_bot
from app.services.transcript_parser import process_parsed_chunk
from app.ws_manager import manager

logger = logging.getLogger(__name__)

RECORDING_POLL_ATTEMPTS = 10
RECORDING_POLL_INTERVAL = 3
MAX_RECONNECT_ATTEMPTS = 5
MAX_BACKOFF_SECONDS = 30

BOT_TERMINAL_STATUSES = frozenset({"finished", "not_admitted", "error", "failed"})

_error_received: dict[str, bool] = {}


async def listen_to_skribby(
    websocket_url: str,
    incident_id: str,
    bot_id: str | None = None,
    db: Any = None,
) -> None:
    """Connect to Skribby's realtime WebSocket and forward transcript/status events.

    On disconnect, polls the Skribby REST API to decide whether to reconnect
    (bot still active) or stop (bot finished / not admitted).
    """
    from app.services.voice import register_skribby_ws

    register_skribby_ws(incident_id, websocket_url)

    async def _send_status(status: str, message: str) -> None:
        await manager.send(
            incident_id,
            {
                "type": "agent_status",
                "incidentId": incident_id,
                "incident_id": incident_id,
                "status": status,
                "lastMessage": message,
                "last_message": message,
            },
        )

    await _send_status("joining", "Connecting to Skribby stream")

    attempt = 0
    while attempt < MAX_RECONNECT_ATTEMPTS:
        attempt += 1
        try:
            async with websockets.connect(websocket_url) as ws:
                attempt = 0  # reset on successful connection
                async for raw_message in ws:
                    try:
                        event = json.loads(raw_message)
                    except json.JSONDecodeError:
                        logger.warning(
                            "Skipping non-JSON Skribby event",
                            extra={"incident_id": incident_id},
                        )
                        continue

                    event_type = event.get("type") or event.get("event")

                    if event_type == "ping":
                        continue

                    if event_type == "start":
                        await _send_status("listening", "Bot joined meeting and is listening")
                        continue

                    if event_type == "transcript":
                        data = event.get("data", {})
                        speaker = data.get("speaker", "Unknown")
                        text = data.get("text", "")
                        if not text:
                            continue

                        is_final = bool(data.get("is_final", data.get("isFinal", False)))
                        start_ts = data.get("start_ts") or data.get("startTs") or data.get("timestamp")
                        end_ts = data.get("end_ts") or data.get("endTs") or data.get("timestamp")

                        await process_parsed_chunk(
                            incident_id=incident_id,
                            speaker=speaker,
                            text=text,
                            is_final=is_final,
                            start_ts=start_ts,
                            end_ts=end_ts,
                            db=db,
                        )
                        continue

                    if event_type == "stop":
                        recording_url = await _fetch_recording_url(bot_id, incident_id)
                        msg = "Meeting ended"
                        if recording_url:
                            msg = "Meeting ended — recording available"

                        if _error_received.pop(incident_id, False):
                            await _poll_post_meeting_transcript(bot_id, incident_id, db)

                        await _send_status("idle", msg)
                        return

                    if event_type == "error":
                        message = (
                            (event.get("data") or {}).get("message")
                            or event.get("message")
                            or "Unknown error"
                        )
                        logger.error(
                            "Skribby stream error: %s", message,
                            extra={"incident_id": incident_id},
                        )
                        _error_received[incident_id] = True
                        await _send_status("error", message)
                        continue

        except Exception as exc:
            logger.exception(
                "Skribby listener crashed",
                extra={"incident_id": incident_id},
            )

        # --- On any disconnect, check bot status via REST API ---
        should_stop = await _check_bot_terminal(bot_id, incident_id, _send_status)
        if should_stop:
            if _error_received.pop(incident_id, False):
                await _poll_post_meeting_transcript(bot_id, incident_id, db)
            return

        if attempt < MAX_RECONNECT_ATTEMPTS:
            delay = min(2 ** attempt, MAX_BACKOFF_SECONDS)
            await _send_status(
                "joining",
                f"Reconnecting ({attempt}/{MAX_RECONNECT_ATTEMPTS})...",
            )
            await sleep(delay)

    # Exhausted all reconnect attempts
    if _error_received.pop(incident_id, False):
        await _poll_post_meeting_transcript(bot_id, incident_id, db)

    await _send_status("error", "Listener stopped after max reconnect attempts")


async def _check_bot_terminal(
    bot_id: str | None,
    incident_id: str,
    send_status: Any,
) -> bool:
    """Check Skribby REST API for bot status. Returns True if the bot is in a
    terminal state and the listener should stop."""
    if not bot_id:
        return False

    try:
        bot_info = await get_bot(bot_id)
        bot_status = bot_info.get("status", "")
        if bot_status in BOT_TERMINAL_STATUSES:
            logger.info(
                "Bot %s reached terminal status '%s' for incident %s",
                bot_id, bot_status, incident_id,
            )
            await send_status("idle", f"Bot {bot_status} — listener stopped")
            return True
    except Exception:
        logger.warning(
            "Failed to check bot status via REST, will attempt reconnect",
            extra={"incident_id": incident_id},
        )

    return False


# ---------------------------------------------------------------------------
# Recording URL polling (unchanged from Sprint 2)
# ---------------------------------------------------------------------------

async def _fetch_recording_url(bot_id: str | None, incident_id: str) -> str | None:
    """Poll Skribby GET /bot/{id} until status is 'finished' to retrieve recording_url.

    Per AGENTS.md Rule §14: poll until status is "finished" to get the recording URL
    for archiving to S3.  Actual S3 upload is handled by E1 in Sprint 3.
    """
    if not bot_id:
        logger.warning("No bot_id — cannot fetch recording URL for incident %s", incident_id)
        return None

    for attempt in range(1, RECORDING_POLL_ATTEMPTS + 1):
        try:
            bot_info = await get_bot(bot_id)
            status = bot_info.get("status", "")
            recording_url = bot_info.get("recording_url") or bot_info.get("recordingUrl")

            if status == "finished" and recording_url:
                logger.info(
                    "Recording URL retrieved for incident %s: %s",
                    incident_id, recording_url,
                )
                return recording_url

            if status == "finished":
                logger.info("Bot finished but no recording URL for incident %s", incident_id)
                return None

            logger.debug(
                "Bot %s status=%s (poll %d/%d), waiting for 'finished'",
                bot_id, status, attempt, RECORDING_POLL_ATTEMPTS,
            )
        except Exception:
            logger.warning(
                "Failed to poll bot status (attempt %d/%d) for incident %s",
                attempt, RECORDING_POLL_ATTEMPTS, incident_id,
            )

        await sleep(RECORDING_POLL_INTERVAL)

    logger.warning(
        "Gave up polling for recording URL after %d attempts for incident %s",
        RECORDING_POLL_ATTEMPTS, incident_id,
    )
    return None


# ---------------------------------------------------------------------------
# Post-meeting transcript fallback (Sprint 4)
# ---------------------------------------------------------------------------

async def _poll_post_meeting_transcript(
    bot_id: str | None,
    incident_id: str,
    db: Any = None,
) -> None:
    """Fallback: poll Skribby REST API for transcript data after an error event.

    Per FRD §23: if the real-time WebSocket sends an error event, fall back to
    polling the REST API for post-meeting transcript when the bot finishes.
    """
    if not bot_id:
        logger.warning(
            "No bot_id — cannot poll post-meeting transcript for incident %s",
            incident_id,
        )
        return

    logger.info(
        "Falling back to REST transcript poll for incident %s",
        incident_id,
    )

    for i in range(1, RECORDING_POLL_ATTEMPTS + 1):
        try:
            bot_info = await get_bot(bot_id)
            if bot_info.get("status") == "finished":
                transcript_data = bot_info.get("transcript") or []
                if not transcript_data:
                    logger.info(
                        "Bot finished but no transcript data in REST response for incident %s",
                        incident_id,
                    )
                    return

                logger.info(
                    "Recovered %d transcript entries via REST for incident %s",
                    len(transcript_data), incident_id,
                )
                for entry in transcript_data:
                    text = entry.get("text", "")
                    if not text:
                        continue
                    await process_parsed_chunk(
                        incident_id=incident_id,
                        speaker=entry.get("speaker", "Unknown"),
                        text=text,
                        is_final=True,
                        start_ts=entry.get("start_ts"),
                        end_ts=entry.get("end_ts"),
                        db=db,
                    )
                return
        except Exception:
            logger.warning(
                "Transcript poll attempt %d/%d failed for incident %s",
                i, RECORDING_POLL_ATTEMPTS, incident_id,
            )

        await sleep(RECORDING_POLL_INTERVAL)

    logger.warning(
        "Gave up polling for post-meeting transcript after %d attempts for incident %s",
        RECORDING_POLL_ATTEMPTS, incident_id,
    )
