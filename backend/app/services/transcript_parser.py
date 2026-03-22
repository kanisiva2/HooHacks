"""
Transcript parser — receives chunks from the Skribby listener, persists them,
broadcasts via WebSocket, and routes final chunks to the task machine and
voice detection pipeline.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.incident import Incident
from app.models.integration import Integration
from app.models.transcript import TranscriptChunk
from app.ws_manager import manager

logger = logging.getLogger(__name__)

WAKE_PHRASES = [
    "sprynt",
    "sprynt ai",
    "hey sprynt",
    "ok sprynt",
]

# Track final-chunk counts per incident for auto deep-dive trigger.
_final_chunk_counts: dict[str, int] = {}
_deep_dive_triggered: set[str] = set()
AUTO_DEEP_DIVE_THRESHOLD = 20


def is_direct_address(text: str) -> bool:
    normalized = text.lower().strip()
    return any(phrase in normalized for phrase in WAKE_PHRASES)


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

async def _persist_chunk(
    db: AsyncSession,
    incident_id: str,
    speaker: str,
    text: str,
    is_final: bool,
    start_ts: float | None,
    end_ts: float | None,
) -> None:
    chunk = TranscriptChunk(
        incident_id=uuid.UUID(incident_id),
        speaker=speaker,
        text=text,
        is_final=is_final,
        start_ts=start_ts,
        end_ts=end_ts,
    )
    db.add(chunk)
    await db.commit()


# ---------------------------------------------------------------------------
# Integration credential lookup
# ---------------------------------------------------------------------------

async def _get_jira_credentials(
    db: AsyncSession, incident_id: str,
) -> tuple[str | None, str | None, str | None]:
    """Return (access_token, cloud_id, project_key) or Nones if unavailable."""
    result = await db.execute(
        select(Incident.workspace_id).where(
            Incident.id == uuid.UUID(incident_id)
        )
    )
    workspace_id = result.scalar_one_or_none()
    if workspace_id is None:
        return None, None, None

    result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id,
            Integration.provider == "jira",
        )
    )
    integration = result.scalar_one_or_none()
    if integration is None:
        return None, None, None

    meta = integration.metadata_json or {}
    return (
        integration.access_token,
        meta.get("cloud_id"),
        meta.get("default_project_key"),
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def process_parsed_chunk(
    incident_id: str,
    speaker: str,
    text: str,
    is_final: bool,
    start_ts: float | str | None = None,
    end_ts: float | str | None = None,
    db: Any | None = None,
) -> None:
    # Coerce timestamps to float for the ORM column.
    _start = float(start_ts) if start_ts is not None else None
    _end = float(end_ts) if end_ts is not None else None

    # Ensure we have a usable DB session.
    own_session = db is None or not hasattr(db, "execute")
    session: AsyncSession
    if own_session:
        session = async_session_maker()
    else:
        session = db

    try:
        if own_session:
            async with session as s:
                await _process(s, incident_id, speaker, text, is_final, _start, _end)
        else:
            await _process(session, incident_id, speaker, text, is_final, _start, _end)
    except Exception:
        logger.exception(
            "process_parsed_chunk failed",
            extra={"incident_id": incident_id},
        )


async def _process(
    db: AsyncSession,
    incident_id: str,
    speaker: str,
    text: str,
    is_final: bool,
    start_ts: float | None,
    end_ts: float | None,
) -> None:
    # ── 1. Persist transcript chunk ──
    try:
        await _persist_chunk(db, incident_id, speaker, text, is_final, start_ts, end_ts)
    except Exception:
        logger.exception("Failed persisting transcript chunk", extra={"incident_id": incident_id})

    # ── 2. Broadcast to dashboard ──
    received_at = datetime.now(timezone.utc).isoformat()
    await manager.send(
        incident_id,
        {
            "type": "transcript_chunk",
            "incident_id": incident_id,
            "speaker": speaker,
            "text": text,
            "is_final": is_final,
            "start_ts": start_ts,
            "end_ts": end_ts,
            "received_at": received_at,
        },
    )

    if not is_final:
        return

    # ── 3. Route final chunks to task machine ──
    try:
        from app.services.task_machine import process_transcript_chunk as run_task_machine

        jira_token, jira_cloud_id, jira_project_key = await _get_jira_credentials(db, incident_id)

        await run_task_machine(
            incident_id=incident_id,
            speaker=speaker,
            text=text,
            db=db,
            jira_access_token=jira_token,
            jira_cloud_id=jira_cloud_id,
            jira_project_key=jira_project_key,
        )
    except Exception:
        logger.exception("Task machine processing failed", extra={"incident_id": incident_id})

    # ── 4. Voice question detection ──
    if is_direct_address(text):
        try:
            from app.services.voice import handle_voice_question
            asyncio.create_task(
                handle_voice_question(incident_id, speaker, text)
            )
        except Exception:
            logger.exception("Voice question handling failed", extra={"incident_id": incident_id})

    # ── 5. Auto deep-dive trigger ──
    _final_chunk_counts[incident_id] = _final_chunk_counts.get(incident_id, 0) + 1
    if (
        _final_chunk_counts[incident_id] >= AUTO_DEEP_DIVE_THRESHOLD
        and incident_id not in _deep_dive_triggered
    ):
        _deep_dive_triggered.add(incident_id)
        asyncio.create_task(_auto_deep_dive(db, incident_id))


# ---------------------------------------------------------------------------
# Auto deep-dive trigger
# ---------------------------------------------------------------------------

async def _auto_deep_dive(db_original: AsyncSession, incident_id: str) -> None:
    """Automatically trigger a deep dive after enough transcript accumulates."""
    try:
        from app.services.deep_dive_agent import run_deep_dive

        async with async_session_maker() as db:
            # Fetch incident workspace
            result = await db.execute(
                select(Incident.workspace_id).where(
                    Incident.id == uuid.UUID(incident_id)
                )
            )
            workspace_id = result.scalar_one_or_none()
            if workspace_id is None:
                return

            # Fetch GitHub integration
            result = await db.execute(
                select(Integration).where(
                    Integration.workspace_id == workspace_id,
                    Integration.provider == "github",
                )
            )
            gh = result.scalar_one_or_none()
            if gh is None:
                logger.info("Auto deep-dive skipped: no GitHub integration for incident %s", incident_id)
                return

            meta = gh.metadata_json or {}
            repo = meta.get("default_repo")
            if not repo:
                logger.info("Auto deep-dive skipped: no default_repo configured for incident %s", incident_id)
                return

            # Build transcript summary from last 30 chunks
            result = await db.execute(
                select(TranscriptChunk)
                .where(
                    TranscriptChunk.incident_id == uuid.UUID(incident_id),
                    TranscriptChunk.is_final.is_(True),
                )
                .order_by(TranscriptChunk.created_at.desc())
                .limit(30)
            )
            chunks = list(result.scalars().all())
            chunks.reverse()
            summary = "\n".join(
                f"{c.speaker or 'Unknown'}: {c.text}" for c in chunks
            )

            await run_deep_dive(
                incident_id=incident_id,
                github_token=gh.access_token,
                repo_full_name=repo,
                transcript_summary=summary,
                db=db,
            )

    except Exception:
        logger.exception("Auto deep-dive failed", extra={"incident_id": incident_id})
