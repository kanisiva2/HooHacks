"""
Voice interaction service — handles questions directed at Sprynt during meetings.

Provides:
- A module-level registry mapping incident_id → Skribby websocket_url so the
  voice handler can send chat messages into the meeting.
- send_chat_response() — delivers text to the meeting via Skribby chat-message.
- handle_voice_question() — full Q&A pipeline: status transitions, LLM answer
  generation, chat-message delivery, and dashboard broadcast.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

import websockets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.action_item import ActionItem
from app.models.deep_dive import DeepDiveResult
from app.models.incident import IncidentEvent
from app.models.transcript import TranscriptChunk
from app.services.llm import generate_spoken_answer
from app.ws_manager import manager

logger = logging.getLogger(__name__)

_CHAT_WS_TIMEOUT = 10  # seconds

# ---------------------------------------------------------------------------
# Skribby WebSocket URL registry
# ---------------------------------------------------------------------------

_skribby_ws_urls: dict[str, str] = {}


def register_skribby_url(incident_id: str, websocket_url: str) -> None:
    """Store the Skribby websocket_url so voice responses can reach the meeting."""
    _skribby_ws_urls[incident_id] = websocket_url


def unregister_skribby_url(incident_id: str) -> None:
    _skribby_ws_urls.pop(incident_id, None)


def get_skribby_url(incident_id: str) -> str | None:
    return _skribby_ws_urls.get(incident_id)


# ---------------------------------------------------------------------------
# Chat-message delivery
# ---------------------------------------------------------------------------

async def send_chat_response(text: str, skribby_ws_url: str) -> None:
    """Send *text* into the meeting chat via Skribby's chat-message WS action.

    Opens a short-lived connection, sends the payload, then closes.  If the
    connection fails the caller should fall back to dashboard-only delivery.
    """
    try:
        async with websockets.connect(
            skribby_ws_url,
            open_timeout=_CHAT_WS_TIMEOUT,
            close_timeout=_CHAT_WS_TIMEOUT,
        ) as ws:
            await ws.send(json.dumps({
                "action": "chat-message",
                "data": {"content": text},
            }))
    except Exception:
        logger.exception("Failed to send chat-message via Skribby WS")
        raise


# ---------------------------------------------------------------------------
# Agent-status helper
# ---------------------------------------------------------------------------

async def _send_agent_status(incident_id: str, status: str, message: str) -> None:
    await manager.send(incident_id, {
        "type": "agent_status",
        "incident_id": incident_id,
        "status": status,
        "last_message": message,
        "timestamp": datetime.now(timezone.utc).timestamp(),
    })


# ---------------------------------------------------------------------------
# Context gathering
# ---------------------------------------------------------------------------

async def _gather_context(
    db: AsyncSession,
    incident_id: str,
) -> tuple[str, list[dict], list[dict]]:
    """Return (incident_summary, deep_dive_results, active_tasks) for the LLM."""

    inc_uuid = uuid.UUID(incident_id)

    # Transcript summary from last 20 final chunks
    result = await db.execute(
        select(TranscriptChunk)
        .where(
            TranscriptChunk.incident_id == inc_uuid,
            TranscriptChunk.is_final.is_(True),
        )
        .order_by(TranscriptChunk.created_at.desc())
        .limit(20)
    )
    chunks = list(result.scalars().all())
    chunks.reverse()
    incident_summary = "\n".join(
        f"{c.speaker or 'Unknown'}: {c.text}" for c in chunks
    ) or "No transcript available yet."

    # Deep dive results
    result = await db.execute(
        select(DeepDiveResult)
        .where(DeepDiveResult.incident_id == inc_uuid)
        .order_by(DeepDiveResult.rank.asc())
    )
    dd_rows = result.scalars().all()
    deep_dive_results = [
        {
            "suspect_file": r.suspect_file,
            "confidence": r.confidence,
            "rank": r.rank,
            "evidence": r.evidence_json,
            "suspect_lines": r.suspect_lines,
        }
        for r in dd_rows
    ]

    # Active tasks
    result = await db.execute(
        select(ActionItem)
        .where(
            ActionItem.incident_id == inc_uuid,
            ActionItem.status.in_(["active", "synced", "proposed"]),
        )
    )
    task_rows = result.scalars().all()
    active_tasks = [
        {
            "id": str(t.id),
            "normalized_task": t.normalized_task,
            "owner": t.owner,
            "status": t.status,
            "priority": t.priority,
        }
        for t in task_rows
    ]

    return incident_summary, deep_dive_results, active_tasks


# ---------------------------------------------------------------------------
# Main voice Q&A handler
# ---------------------------------------------------------------------------

async def handle_voice_question(
    incident_id: str,
    speaker: str,
    text: str,
) -> None:
    """Full voice Q&A pipeline triggered when a wake phrase is detected.

    1. Set agent status to "speaking".
    2. Gather incident context from the database.
    3. Generate a concise answer via the LLM.
    4. Send the answer to the meeting chat via Skribby chat-message.
    5. Broadcast the answer to the dashboard via WebSocket.
    6. Set agent status back to "listening".
    """
    logger.info(
        "Voice question detected: incident=%s speaker=%s text=%s",
        incident_id, speaker, text[:120],
    )

    # 1. Status → speaking
    await _send_agent_status(incident_id, "speaking", f"Answering question from {speaker}")

    try:
        # 2. Gather context and log the question event
        async with async_session_maker() as db:
            incident_summary, deep_dive_results, active_tasks = await _gather_context(db, incident_id)

            db.add(IncidentEvent(
                incident_id=uuid.UUID(incident_id),
                event_type="voice_question",
                payload_json={"speaker": speaker, "text": text[:500]},
            ))
            await db.commit()

        # 3. LLM answer
        answer = await generate_spoken_answer(
            question=text,
            incident_summary=incident_summary,
            deep_dive_results=deep_dive_results,
            active_tasks=active_tasks,
        )

        # 4. Send to meeting chat (graceful degradation if unavailable)
        skribby_url = get_skribby_url(incident_id)
        if skribby_url:
            try:
                await send_chat_response(answer, skribby_url)
            except Exception:
                logger.warning(
                    "Chat-message delivery failed; answer will appear on dashboard only",
                    extra={"incident_id": incident_id},
                )
        else:
            logger.info(
                "No Skribby WS URL registered for incident %s; dashboard-only response",
                incident_id,
            )

        # 5. Broadcast answer to dashboard
        await manager.send(incident_id, {
            "type": "agent_status",
            "incident_id": incident_id,
            "status": "speaking",
            "last_message": answer,
            "timestamp": datetime.now(timezone.utc).timestamp(),
        })

        # Log the answer event
        async with async_session_maker() as db:
            db.add(IncidentEvent(
                incident_id=uuid.UUID(incident_id),
                event_type="voice_answer",
                payload_json={"answer": answer[:500], "chat_delivered": skribby_url is not None},
            ))
            await db.commit()

    except Exception:
        logger.exception("handle_voice_question failed", extra={"incident_id": incident_id})

    # 6. Status → listening
    await _send_agent_status(incident_id, "listening", "Resumed listening")
