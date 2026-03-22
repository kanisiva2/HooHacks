from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.ws_manager import manager

logger = logging.getLogger(__name__)

try:
    from sqlalchemy import text as sql_text
except Exception:  # pragma: no cover - allows import before sqlalchemy install
    sql_text = None

WAKE_PHRASES = [
    "sprynt",
    "sprynt ai",
    "hey sprynt",
    "ok sprynt",
]


def is_direct_address(text: str) -> bool:
    normalized = text.lower().strip()
    return any(phrase in normalized for phrase in WAKE_PHRASES)


async def _persist_transcript_chunk(
    db: Any,
    incident_id: str,
    speaker: str,
    text: str,
    is_final: bool,
    start_ts: str | None,
    end_ts: str | None,
) -> None:
    """
    Best-effort persistence hook for Sprint 1.

    Expects an async DB session with `execute` and `commit`. If unavailable,
    this function logs and skips persistence to keep the pipeline non-blocking.
    """
    if db is None:
        return

    if not hasattr(db, "execute") or not hasattr(db, "commit"):
        logger.warning("DB session does not support execute/commit; skipping transcript persistence")
        return

    params_base = {
        "incident_id": incident_id,
        "speaker": speaker,
        "text": text,
        "start_ts": start_ts,
        "end_ts": end_ts,
    }

    insert_with_is_final = """
        INSERT INTO transcript_chunks (incident_id, speaker, text, is_final, start_ts, end_ts)
        VALUES (:incident_id, :speaker, :text, :is_final, :start_ts, :end_ts)
    """
    params_with_is_final = {**params_base, "is_final": is_final}
    insert_without_is_final = """
        INSERT INTO transcript_chunks (incident_id, speaker, text, start_ts, end_ts)
        VALUES (:incident_id, :speaker, :text, :start_ts, :end_ts)
    """

    try:
        statement = sql_text(insert_with_is_final) if sql_text else insert_with_is_final
        await db.execute(statement, params_with_is_final)
        await db.commit()
        return
    except Exception:
        # Some schema versions do not include `is_final` on transcript_chunks yet.
        try:
            if hasattr(db, "rollback"):
                await db.rollback()
            fallback_statement = sql_text(insert_without_is_final) if sql_text else insert_without_is_final
            await db.execute(fallback_statement, params_base)
            await db.commit()
            return
        except Exception:
            logger.exception("Failed persisting transcript chunk", extra={"incident_id": incident_id})


async def process_parsed_chunk(
    incident_id: str,
    speaker: str,
    text: str,
    is_final: bool,
    start_ts: str | None = None,
    end_ts: str | None = None,
    db: Any | None = None,
) -> None:
    await _persist_transcript_chunk(
        db=db,
        incident_id=incident_id,
        speaker=speaker,
        text=text,
        is_final=is_final,
        start_ts=start_ts,
        end_ts=end_ts,
    )

    received_at = datetime.now(timezone.utc).isoformat()

    await manager.send(
        incident_id,
        {
            "type": "transcript_chunk",
            "incidentId": incident_id,
            "incident_id": incident_id,
            "speaker": speaker,
            "text": text,
            "isFinal": is_final,
            "is_final": is_final,
            "startTs": start_ts,
            "start_ts": start_ts,
            "endTs": end_ts,
            "end_ts": end_ts,
            "receivedAt": received_at,
            "received_at": received_at,
        },
    )
