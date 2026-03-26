import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Literal

# import httpx  # Only needed for S3 artifact export (disabled)
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.deps import get_db, get_current_user_id
from app.models.action_item import ActionItem
from app.models.deep_dive import DeepDiveResult
from app.models.incident import Incident
from app.services.event_logger import log_event
from app.models.transcript import TranscriptChunk
from app.models.workspace import WorkspaceMember
from app.services.s3 import (
    delete_object,
    download_json,
    get_presigned_url,
    incident_report_key,
    incident_transcript_key,
    upload_text,
    upload_json,
)
from app.services.skribby import create_bot, detect_service, stop_bot, get_bot
from app.services.skribby_listener import listen_to_skribby

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request / Response schemas ──

class IncidentCreate(BaseModel):
    workspace_id: uuid.UUID
    title: str
    severity: Literal["P1", "P2", "P3", "P4"]
    repo_full_name: str | None = None
    meeting_link: str


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
    repo_full_name: str | None
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


async def _poll_recording_url(
    bot_session_id: str,
    attempts: int = 10,
    interval: int = 5,
) -> str | None:
    """Poll Skribby GET /bot/{id} until status=='finished' and recording_url is present."""
    for _ in range(attempts):
        try:
            data = await get_bot(bot_session_id)
            bot_status = data.get("status")
            if bot_status == "finished":
                url = data.get("recording_url") or data.get("recordingUrl")
                if url:
                    return url
                # finished but no URL — nothing to download
                logger.warning("Bot %s finished but no recording_url returned.", bot_session_id)
                return None
            if bot_status in ("error", "failed"):
                logger.warning("Bot %s in %s state — no recording.", bot_session_id, bot_status)
                return None
        except Exception as exc:
            logger.warning("_poll_recording_url error: %s", exc)
            return None
        await asyncio.sleep(interval)
    logger.warning("Recording URL not available after %d attempts for bot %s", attempts, bot_session_id)
    return None


def _build_report(
    incident: Incident,
    chunks: list,
    tasks: list,
    dd_rows: list,
) -> str:
    """Generate a markdown incident report from DB objects. No LLM required."""
    duration = ""
    if incident.resolved_at and incident.created_at:
        delta = incident.resolved_at - incident.created_at
        total_seconds = int(delta.total_seconds())
        h, m = divmod(total_seconds // 60, 60)
        duration = f"{h}h {m}m" if h else f"{m}m"

    lines = [
        f"# Incident Report: {incident.title}",
        f"",
        f"**Severity:** {incident.severity} | **Status:** {incident.status}"
        + (f" | **Duration:** {duration}" if duration else ""),
        f"**Created:** {incident.created_at.isoformat()}",
        f"",
    ]

    # Transcript timeline
    lines.append("## Transcript")
    if chunks:
        for c in chunks:
            ts = f"[{c.start_ts}] " if c.start_ts else ""
            lines.append(f"{ts}**{c.speaker}:** {c.text}")
    else:
        lines.append("_No transcript recorded._")
    lines.append("")

    # Action items
    lines.append("## Action Items")
    if tasks:
        for t in tasks:
            owner_str = f" — {t.owner}" if t.owner else ""
            jira_str = f" ({t.jira_issue_key})" if t.jira_issue_key else ""
            lines.append(f"- [{t.status.upper()}] {t.normalized_task}{owner_str}{jira_str}")
    else:
        lines.append("_No action items recorded._")
    lines.append("")

    # Deep dive findings
    lines.append("## Deep Dive Findings")
    if dd_rows:
        for r in dd_rows:
            conf_pct = int(r.confidence * 100)
            lines.append(f"- **{r.suspect_file}** — {conf_pct}% confidence (rank {r.rank})")
            evidence = (r.evidence_json or {}).get("reason") or (r.evidence_json or {}).get("reasoning")
            if evidence:
                lines.append(f"  _{evidence}_")
    else:
        lines.append("_No deep dive results._")

    return "\n".join(lines)


def _serialize_transcript_chunks(
    chunks: list[TranscriptChunk],
) -> list[dict[str, Any]]:
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


async def _export_transcript_artifact(incident_id: str) -> None:
    """Background task — exports transcript JSON to S3 and stores the key on the incident."""
    async with async_session_maker() as db:
        try:
            incident = await _get_incident_or_404(db, uuid.UUID(incident_id))
            chunks_result = await db.execute(
                select(TranscriptChunk)
                .where(TranscriptChunk.incident_id == uuid.UUID(incident_id))
                .order_by(TranscriptChunk.start_ts.asc().nulls_last())
            )
            chunks = chunks_result.scalars().all()
            payload = _serialize_transcript_chunks(chunks)
            transcript_key = incident_transcript_key(incident_id)
            await upload_json(transcript_key, payload)
            incident.transcript_s3_key = transcript_key
            await db.commit()
            logger.info(
                "Transcript artifact exported for incident %s to s3://%s",
                incident_id,
                transcript_key,
            )
        except Exception as exc:
            logger.exception(
                "_export_transcript_artifact failed for incident %s: %s",
                incident_id,
                exc,
            )


async def _export_report_artifact(incident_id: str) -> None:
    """Background task — exports a markdown incident report to S3."""
    async with async_session_maker() as db:
        try:
            incident = await _get_incident_or_404(db, uuid.UUID(incident_id))

            chunks_result = await db.execute(
                select(TranscriptChunk)
                .where(TranscriptChunk.incident_id == uuid.UUID(incident_id))
                .order_by(TranscriptChunk.start_ts.asc().nulls_last())
            )
            tasks_result = await db.execute(
                select(ActionItem)
                .where(ActionItem.incident_id == uuid.UUID(incident_id))
                .order_by(ActionItem.proposed_at.asc())
            )
            deep_dive_result = await db.execute(
                select(DeepDiveResult)
                .where(DeepDiveResult.incident_id == uuid.UUID(incident_id))
                .order_by(DeepDiveResult.rank.asc(), DeepDiveResult.created_at.asc())
            )

            report = _build_report(
                incident=incident,
                chunks=chunks_result.scalars().all(),
                tasks=tasks_result.scalars().all(),
                dd_rows=deep_dive_result.scalars().all(),
            )

            report_key = incident_report_key(incident_id)
            await upload_text(report_key, report)
            incident.report_s3_key = report_key
            await db.commit()
            logger.info(
                "Report artifact exported for incident %s to s3://%s",
                incident_id,
                report_key,
            )
        except Exception as exc:
            logger.exception(
                "_export_report_artifact failed for incident %s: %s",
                incident_id,
                exc,
            )


# ── Endpoints ──

@router.post("/incidents", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def create_incident(
    body: IncidentCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> IncidentResponse:
    """Create a new incident. Launches a Skribby meeting bot if meeting_link is provided."""
    await _assert_workspace_member(db, body.workspace_id, user_id)

    incident = Incident(
        workspace_id=body.workspace_id,
        title=body.title,
        severity=body.severity,
        repo_full_name=body.repo_full_name,
        meeting_link=body.meeting_link,
        status="active",
    )
    db.add(incident)
    await db.commit()

    # Sprint 3: Bot launch — non-fatal if Skribby is unavailable
    if body.meeting_link:
        try:
            service = detect_service(body.meeting_link)
            bot_result = await create_bot(
                meeting_url=body.meeting_link,
                bot_name="Sprynt AI",
                service=service,
            )
            incident.bot_session_id = bot_result["id"]
            await db.commit()
            logger.info(
                "Skribby bot created for incident %s: id=%s, ws_url=%s, status=%s",
                incident.id,
                bot_result.get("id"),
                bot_result.get("websocket_url"),
                bot_result.get("status"),
            )

            await log_event(db, incident.id, "bot_joined", {"bot_id": bot_result["id"]})

            # Launch the Skribby WebSocket listener as a background task.
            # db is NOT passed — request session closes when endpoint returns;
            # the listener creates its own sessions via async_session_maker.
            asyncio.create_task(
                listen_to_skribby(
                    websocket_url=bot_result["websocket_url"],
                    incident_id=str(incident.id),
                    bot_id=bot_result["id"],
                )
            )
        except Exception as exc:
            logger.warning(
                "Bot launch failed for incident %s (meeting_link=%s): %s",
                incident.id, body.meeting_link, exc,
            )
            # Incident is still created — bot failure is non-fatal

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
    """Update incident fields. Stops bot and exports artifacts when resolved/closed."""
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    if body.title is not None:
        incident.title = body.title
    if body.severity is not None:
        incident.severity = body.severity
    if body.status is not None:
        previous_status = incident.status  # capture before mutation for event payload
        incident.status = body.status
        if body.status in ("resolved", "closed") and incident.resolved_at is None:
            incident.resolved_at = datetime.utcnow()
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

        if body.status in ("resolved", "closed"):
            # Log the status change event
            event_type = "incident_resolved" if body.status == "resolved" else "incident_closed"
            await log_event(db, incident_id, event_type, {"previous_status": previous_status})

            # Stop the Skribby bot — non-fatal if already stopped or never started
            if incident.bot_session_id:
                try:
                    await stop_bot(incident.bot_session_id)
                except Exception as exc:
                    logger.warning(
                        "stop_bot failed for incident %s (bot=%s): %s",
                        incident_id, incident.bot_session_id, exc,
                    )

            asyncio.create_task(_export_transcript_artifact(str(incident_id)))
            if body.status == "resolved" and previous_status != "resolved":
                asyncio.create_task(_export_report_artifact(str(incident_id)))

    await db.commit()
    return IncidentResponse.model_validate(incident)


@router.get("/incidents/{incident_id}/transcript")
async def get_transcript(
    incident_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Return transcript chunks for an incident ordered by start_ts.

    Prefers Postgres as the primary source and falls back to S3 JSON when the
    incident has a persisted transcript artifact but no transcript rows remain.
    """
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    result = await db.execute(
        select(TranscriptChunk)
        .where(TranscriptChunk.incident_id == incident_id)
        .order_by(TranscriptChunk.start_ts.asc().nulls_last())
    )
    chunks = result.scalars().all()
    if chunks:
        return _serialize_transcript_chunks(chunks)

    if incident.transcript_s3_key:
        try:
            artifact = await download_json(incident.transcript_s3_key)
            if isinstance(artifact, list):
                return artifact
            logger.warning(
                "Transcript artifact for incident %s was not a list; ignoring",
                incident_id,
            )
        except Exception:
            logger.exception(
                "Failed loading transcript artifact from S3 for incident %s",
                incident_id,
            )

    return []


@router.get("/incidents/{incident_id}/artifacts")
async def get_artifacts(
    incident_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    async def _safe_presigned(key: str | None) -> str | None:
        if not key:
            return None
        try:
            return await get_presigned_url(key)
        except Exception:
            logger.exception(
                "Failed generating presigned URL for incident %s key %s",
                incident_id,
                key,
            )
            return None

    transcript_url = await _safe_presigned(incident.transcript_s3_key)
    report_url = await _safe_presigned(incident.report_s3_key)
    return {
        "audio_url": None,
        "transcript_url": transcript_url,
        "report_url": report_url,
    }


@router.delete("/incidents/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident(
    incident_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    if incident.bot_session_id and incident.status == "active":
        try:
            await stop_bot(incident.bot_session_id)
        except Exception as exc:
            logger.warning(
                "stop_bot failed during delete for incident %s (bot=%s): %s",
                incident_id,
                incident.bot_session_id,
                exc,
            )

    artifact_keys = [
        key
        for key in (
            incident.audio_s3_key,
            incident.transcript_s3_key,
            incident.report_s3_key,
        )
        if key
    ]
    for key in artifact_keys:
        try:
            await delete_object(key)
        except Exception:
            logger.exception(
                "Failed deleting incident artifact for incident %s key %s",
                incident_id,
                key,
            )

    await db.delete(incident)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
