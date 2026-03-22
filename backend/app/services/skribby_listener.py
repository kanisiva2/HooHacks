from __future__ import annotations

import json
import logging
from asyncio import sleep
from typing import Any

import websockets

from app.services.skribby import get_bot
from app.services.transcript_parser import process_parsed_chunk
from app.services.voice import register_skribby_url, unregister_skribby_url
from app.ws_manager import manager

logger = logging.getLogger(__name__)

RECORDING_POLL_ATTEMPTS = 10
RECORDING_POLL_INTERVAL = 3


async def listen_to_skribby(
    websocket_url: str,
    incident_id: str,
    bot_id: str | None = None,
    db: Any = None,
) -> None:
    """
    Connects to Skribby's realtime WebSocket and forwards transcript/status events.
    On a stop event, polls Skribby REST API for the recording URL.
    """
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

    logger.info(
        "listen_to_skribby STARTED: incident=%s, ws_url=%s, bot_id=%s",
        incident_id, websocket_url, bot_id,
    )
    await _send_status("joining", "Connecting to Skribby stream")
    register_skribby_url(incident_id, websocket_url)

    max_attempts = 3
    attempt = 0
    while attempt < max_attempts:
        attempt += 1
        try:
            logger.info("Connecting to Skribby WS (attempt %d/%d): %s", attempt, max_attempts, websocket_url)
            async with websockets.connect(websocket_url) as ws:
                logger.info("Skribby WS connected for incident %s", incident_id)
                async for raw_message in ws:
                    try:
                        event = json.loads(raw_message)
                    except json.JSONDecodeError:
                        logger.warning("Skipping non-JSON Skribby event", extra={"incident_id": incident_id})
                        continue

                    event_type = event.get("type") or event.get("event")
                    logger.info("[SKRIBBY] incident=%s type=%s", incident_id, event_type)

                    if event_type in ("ping", "started-speaking", "stopped-speaking", "participant-tracked"):
                        continue

                    if event_type == "connected":
                        # Initial connection event — contains transcript history
                        transcripts = (event.get("data") or {}).get("transcripts", [])
                        for seg in transcripts:
                            text = seg.get("transcript", "")
                            if not text:
                                continue
                            await process_parsed_chunk(
                                incident_id=incident_id,
                                speaker=seg.get("speaker_name") or f"Speaker {seg.get('speaker', '?')}",
                                text=text,
                                is_final=True,
                                start_ts=seg.get("start"),
                                end_ts=seg.get("end"),
                                db=db,
                            )
                        logger.info("Replayed %d historic transcript segments", len(transcripts))
                        continue

                    if event_type == "start":
                        await _send_status("listening", "Bot joined meeting and is listening")
                        continue

                    if event_type == "status-update":
                        data = event.get("data", {})
                        new_status = data.get("new_status", "")
                        logger.info("Bot status update: %s -> %s", data.get("old_status"), new_status)
                        if new_status in ("finished", "not_admitted"):
                            stop_reason = data.get("stop_reason", "unknown")
                            unregister_skribby_url(incident_id)
                            recording_url = await _fetch_recording_url(bot_id, incident_id)
                            msg = f"Meeting ended ({stop_reason})"
                            if recording_url:
                                msg += " — recording available"
                            await _send_status("idle", msg)
                            return
                        continue

                    if event_type == "ts":
                        data = event.get("data", {})
                        text = data.get("transcript", "")
                        if not text:
                            continue
                        speaker = data.get("speaker_name") or f"Speaker {data.get('speaker', '?')}"
                        start_ts = data.get("start")
                        end_ts = data.get("end")

                        await process_parsed_chunk(
                            incident_id=incident_id,
                            speaker=speaker,
                            text=text,
                            is_final=True,
                            start_ts=start_ts,
                            end_ts=end_ts,
                            db=db,
                        )
                        continue

                    if event_type == "stop":
                        unregister_skribby_url(incident_id)
                        recording_url = await _fetch_recording_url(bot_id, incident_id)
                        msg = "Meeting ended"
                        if recording_url:
                            msg += " — recording available"
                        await _send_status("idle", msg)
                        return

                    if event_type == "error":
                        message = (event.get("data") or {}).get("message") or event.get("message") or "Unknown error"
                        logger.error("Skribby stream error: %s", message, extra={"incident_id": incident_id})
                        await _send_status("error", message)
                        continue

                    logger.debug("Unhandled Skribby event type: %s", event_type)

            # Socket ended without explicit stop: retry.
            if attempt < max_attempts:
                await _send_status("joining", f"Stream disconnected, retrying ({attempt}/{max_attempts})")
                await sleep(2**attempt)
                continue
            break
        except Exception as exc:
            logger.exception("Skribby listener crashed", extra={"incident_id": incident_id})
            if attempt < max_attempts:
                await _send_status("joining", f"Listener reconnecting after error ({attempt}/{max_attempts})")
                await sleep(2**attempt)
                continue
            unregister_skribby_url(incident_id)
            await _send_status("error", f"Listener crashed: {exc}")
            return

    unregister_skribby_url(incident_id)
    await _send_status("error", "Listener stopped after retries")


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

    logger.warning("Gave up polling for recording URL after %d attempts for incident %s", RECORDING_POLL_ATTEMPTS, incident_id)
    return None
