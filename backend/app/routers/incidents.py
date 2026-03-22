import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user_id
from app.models.action_item import ActionItem
from app.models.incident import Incident
from app.models.transcript import TranscriptChunk
from app.models.workspace import WorkspaceMember
from app.services.s3 import get_presigned_url

router = APIRouter()


# ── Request / Response schemas (inline for Sprint 1; E3 will move to app/schemas/) ──

class IncidentCreate(BaseModel):
    workspace_id: uuid.UUID
    title: str
    severity: Literal["P1", "P2", "P3", "P4"]
    meeting_link: str | None = None


class IncidentUpdate(BaseModel):
    title: str | None = None
    severity: Literal["P1", "P2", "P3", "P4"] | None = None
    status: Literal["active", "resolved", "closed"] | None = None


class IncidentResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    severity: str
    status: str
    meeting_link: str | None
    bot_session_id: str | None
    audio_s3_key: str | None
    transcript_s3_key: str | None
    report_s3_key: str | None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


# ── Helpers ──

async def _assert_workspace_member(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: str
) -> None:
    """Raises 403 if the user is not a member of the given workspace."""
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == uuid.UUID(user_id),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")


async def _get_incident_or_404(db: AsyncSession, incident_id: uuid.UUID) -> Incident:
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


# ── Endpoints ──

@router.post("/incidents", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def create_incident(
    body: IncidentCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> IncidentResponse:
    """
    Create a new incident.
    Sprint 1: stores the record only — bot launch wired in Sprint 3.
    """
    await _assert_workspace_member(db, body.workspace_id, user_id)

    incident = Incident(
        workspace_id=body.workspace_id,
        title=body.title,
        severity=body.severity,
        meeting_link=body.meeting_link,
        status="active",
    )
    db.add(incident)
    await db.commit()

    return IncidentResponse.model_validate(incident)


@router.get("/incidents", response_model=list[IncidentResponse])
async def list_incidents(
    workspace_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[IncidentResponse]:
    """List all incidents for a workspace, newest first."""
    await _assert_workspace_member(db, workspace_id, user_id)

    result = await db.execute(
        select(Incident)
        .where(Incident.workspace_id == workspace_id)
        .order_by(Incident.created_at.desc())
    )
    incidents = result.scalars().all()
    return [IncidentResponse.model_validate(i) for i in incidents]


@router.get("/incidents/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> IncidentResponse:
    """Get a single incident. User must be a member of the incident's workspace."""
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)
    return IncidentResponse.model_validate(incident)


@router.patch("/incidents/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: uuid.UUID,
    body: IncidentUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> IncidentResponse:
    """
    Update incident fields.
    Sprint 1: updates fields only — bot stop + artifact export wired in Sprint 3.
    """
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    if body.title is not None:
        incident.title = body.title
    if body.severity is not None:
        incident.severity = body.severity
    if body.status is not None:
        incident.status = body.status
        if body.status in ("resolved", "closed") and incident.resolved_at is None:
            incident.resolved_at = datetime.now(timezone.utc)
        if body.status == "closed":
            # Cascade-close all open action items for this incident
            await db.execute(
                update(ActionItem)
                .where(
                    ActionItem.incident_id == incident_id,
                    ActionItem.status != "closed",
                )
                .values(status="closed")
            )

    await db.commit()
    return IncidentResponse.model_validate(incident)


@router.get("/incidents/{incident_id}/transcript")
async def get_transcript(
    incident_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Return all transcript chunks for an incident ordered by start_ts."""
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    result = await db.execute(
        select(TranscriptChunk)
        .where(TranscriptChunk.incident_id == incident_id)
        .order_by(TranscriptChunk.start_ts.asc().nulls_last())
    )
    chunks = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "speaker": c.speaker,
            "text": c.text,
            "start_ts": c.start_ts,
            "end_ts": c.end_ts,
            "is_final": c.is_final,
            "created_at": c.created_at.isoformat(),
        }
        for c in chunks
    ]


@router.get("/incidents/{incident_id}/artifacts")
async def get_artifacts(
    incident_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Return pre-signed S3 URLs for any artifacts attached to the incident.
    Keys are None when the artifact hasn't been uploaded yet.
    """
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    async def _safe_presigned(key: str | None) -> str | None:
        if not key:
            return None
        try:
            return await get_presigned_url(key)
        except Exception:
            return None

    audio_url = await _safe_presigned(incident.audio_s3_key)
    transcript_url = await _safe_presigned(incident.transcript_s3_key)
    report_url = await _safe_presigned(incident.report_s3_key)

    return {
        "audio_url": audio_url,
        "transcript_url": transcript_url,
        "report_url": report_url,
    }
