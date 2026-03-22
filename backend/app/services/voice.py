"""
Voice interaction service — handles questions directed at Sprynt during meetings.

Detects wake phrases from transcript, generates answers via LLM, sends responses
to the meeting chat via Skribby's chat-message WebSocket action, and broadcasts
the answer to the dashboard. On chat-message failure, falls back to dashboard-only
display (per FRD §23).
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

import websockets

from app.database import async_session_maker
from app.models.deep_dive import DeepDiveResult
from app.services.llm import generate_spoken_answer
from app.services.task_machine import get_active_tasks_summary
from app.ws_manager import manager

from sqlalchemy import select

logger = logging.getLogger(__name__)

# Module-level registry: incident_id → Skribby websocket_url.
# Populated by skribby_listener when it starts listening.
_skribby_ws_urls: dict[str, str] = {}


def register_skribby_ws(incident_id: str, ws_url: str) -> None:
    """Register a Skribby WebSocket URL for an incident (called by skribby_listener)."""
    _skribby_ws_urls[incident_id] = ws_url


def unregister_skribby_ws(incident_id: str) -> None:
    """Remove the Skribby WebSocket URL for an incident."""
    _skribby_ws_urls.pop(incident_id, None)


async def _send_agent_status(incident_id: str, status: str, message: str) -> None:
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


async def send_chat_response(text: str, skribby_ws_url: str) -> None:
    """Send a chat message into the meeting via Skribby's chat-message WebSocket action."""
    async with websockets.connect(skribby_ws_url) as ws:
        await ws.send(json.dumps({
            "action": "chat-message",
            "data": {"content": text},
        }))


async def _get_deep_dive_summary(incident_id: str) -> list[dict[str, Any]]:
    """Fetch the top deep dive results for incident context."""
    try:
        async with async_session_maker() as db:
            result = await db.execute(
                select(DeepDiveResult)
                .where(DeepDiveResult.incident_id == uuid.UUID(incident_id))
                .order_by(DeepDiveResult.rank)
                .limit(3)
            )
            rows = list(result.scalars().all())
            return [
                {
                    "file": r.suspect_file,
                    "confidence": r.confidence,
                    "reason": (r.evidence_json or {}).get("reasoning", ""),
                }
                for r in rows
            ]
    except Exception:
        logger.warning("Could not fetch deep dive results for voice context", extra={"incident_id": incident_id})
        return []


async def handle_voice_question(
    incident_id: str,
    speaker: str,
    text: str,
) -> None:
    """Full voice Q&A pipeline:

    1. Set agent status to "speaking".
    2. Gather incident context (active tasks, deep dive results).
    3. Generate an LLM answer via generate_spoken_answer().
    4. Send answer to meeting chat via Skribby (with dashboard-only fallback).
    5. Broadcast the answer to the dashboard WebSocket.
    6. Set agent status back to "listening".
    """
    logger.info(
        "Voice question detected: incident=%s speaker=%s text=%s",
        incident_id, speaker, text[:120],
    )

    await _send_agent_status(incident_id, "speaking", f"Answering {speaker}...")

    try:
        # Gather context
        async with async_session_maker() as db:
            tasks_summary = await get_active_tasks_summary(db, incident_id)
        deep_dive_results = await _get_deep_dive_summary(incident_id)

        answer = await generate_spoken_answer(
            question=text,
            incident_summary="",
            deep_dive_results=deep_dive_results,
            active_tasks=tasks_summary,
        )

        # Attempt to send to meeting chat via Skribby
        ws_url = _skribby_ws_urls.get(incident_id)
        if ws_url:
            try:
                await send_chat_response(answer, ws_url)
                logger.info("Chat response sent to meeting for incident %s", incident_id)
            except Exception:
                logger.warning(
                    "Skribby chat-message failed for incident %s; falling back to dashboard-only",
                    incident_id,
                    exc_info=True,
                )
        else:
            logger.info(
                "No Skribby WS URL registered for incident %s; dashboard-only response",
                incident_id,
            )

        # Always broadcast to dashboard regardless of chat-message result
        await manager.send(
            incident_id,
            {
                "type": "voice_answer",
                "incident_id": incident_id,
                "speaker": "Sprynt AI",
                "question": text,
                "question_by": speaker,
                "answer": answer,
            },
        )
    except Exception:
        logger.exception(
            "Voice question handling failed",
            extra={"incident_id": incident_id},
        )
    finally:
        await _send_agent_status(incident_id, "listening", "Listening")
