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

    await _send_status("joining", "Connecting to Skribby stream")

    max_attempts = 3
    attempt = 0
    while attempt < max_attempts:
        attempt += 1
        try:
            async with websockets.connect(websocket_url) as ws:
                async for raw_message in ws:
                    try:
                        event = json.loads(raw_message)
                    except json.JSONDecodeError:
                        logger.warning("Skipping non-JSON Skribby event", extra={"incident_id": incident_id})
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
                            msg = f"Meeting ended — recording available"
                        await _send_status("idle", msg)
                        return

                    if event_type == "error":
                        message = (event.get("data") or {}).get("message") or event.get("message") or "Unknown error"
                        logger.error("Skribby stream error: %s", message, extra={"incident_id": incident_id})
                        await _send_status("error", message)
                        continue

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
            await _send_status("error", f"Listener crashed: {exc}")
            return

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
