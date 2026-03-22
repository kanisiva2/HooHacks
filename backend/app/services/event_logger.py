"""
Shared event logging helper.
Imported by both routers and services to avoid router-to-router imports.
"""
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incident import IncidentEvent


async def log_event(
    db: AsyncSession,
    incident_id: uuid.UUID,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Insert an IncidentEvent row and commit. Pass the current request session."""
    db.add(IncidentEvent(
        incident_id=incident_id,
        event_type=event_type,
        payload_json=payload,
    ))
    await db.commit()
