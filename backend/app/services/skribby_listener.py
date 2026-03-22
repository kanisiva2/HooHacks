from __future__ import annotations

import json
import logging
from asyncio import sleep
from typing import Any

import websockets

from app.services.transcript_parser import process_parsed_chunk
from app.ws_manager import manager

logger = logging.getLogger(__name__)


async def listen_to_skribby(websocket_url: str, incident_id: str, db: Any = None) -> None:
    """
    Connects to Skribby's realtime WebSocket and forwards transcript/status events.
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
                        await _send_status("idle", "Meeting stream stopped")
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
