import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user_id
from app.models.deep_dive import DeepDiveResult
from app.models.incident import Incident
from app.models.integration import Integration
from app.models.transcript import TranscriptChunk
from app.models.workspace import WorkspaceMember
from app.schemas.deep_dive import DeepDiveResultOut
from app.services.github import get_file_content

router = APIRouter()


# ── Helpers ──

async def _assert_workspace_member(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: str
) -> None:
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


async def _get_github_integration(db: AsyncSession, workspace_id: uuid.UUID) -> Integration:
    """Fetch the GitHub integration for a workspace or raise 400."""
    result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id,
            Integration.provider == "github",
        )
    )
    integration = result.scalar_one_or_none()
    if integration is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub integration connected for this workspace",
        )
    return integration


# ── Endpoints ──

@router.get("/incidents/{incident_id}/deep-dive", response_model=list[DeepDiveResultOut])
async def list_deep_dive_results(
    incident_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[DeepDiveResultOut]:
    """List all deep dive results for an incident, ordered by rank."""
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    result = await db.execute(
        select(DeepDiveResult)
        .where(DeepDiveResult.incident_id == incident_id)
        .order_by(DeepDiveResult.rank.asc())
    )
    rows = result.scalars().all()
    return [DeepDiveResultOut.model_validate(r) for r in rows]


@router.post("/incidents/{incident_id}/deep-dive/trigger", status_code=status.HTTP_202_ACCEPTED)
async def trigger_deep_dive(
    incident_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Manually trigger the deep dive agent for an incident.
    Requires a GitHub integration on the workspace.
    Returns 202 immediately — agent runs as a background task.
    """
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    integration = await _get_github_integration(db, incident.workspace_id)

    repo = (integration.metadata_json or {}).get("default_repo")
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No default repository set on GitHub integration",
        )

    # Build transcript summary from the last 20 final chunks
    chunks_result = await db.execute(
        select(TranscriptChunk)
        .where(
            TranscriptChunk.incident_id == incident_id,
            TranscriptChunk.is_final == True,
        )
        .order_by(TranscriptChunk.start_ts.desc())
        .limit(20)
    )
    chunks = chunks_result.scalars().all()
    transcript_summary = " ".join(
        f"{c.speaker}: {c.text}" for c in reversed(chunks) if c.text
    ) or f"Incident: {incident.title}"

    # Launch E4's deep dive agent as a background task (lazy import — safe if not yet merged)
    # NOTE: db is NOT passed — the request session closes when this endpoint returns.
    # E4's run_deep_dive must create its own session internally.
    try:
        from app.services.deep_dive_agent import run_deep_dive
        asyncio.create_task(
            run_deep_dive(
                incident_id=str(incident_id),
                github_token=integration.access_token,
                repo_full_name=repo,
                transcript_summary=transcript_summary,
            )
        )
    except ImportError:
        pass  # E4's deep_dive_agent not yet available — endpoint still returns 202

    return {"message": "Deep dive triggered", "incident_id": str(incident_id)}


@router.get("/incidents/{incident_id}/deep-dive/{result_id}/file")
async def get_deep_dive_file(
    incident_id: uuid.UUID,
    result_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Fetch the full file content for a deep dive result.
    Powers the Monaco code panel on the frontend.
    """
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    result = await db.execute(
        select(DeepDiveResult).where(DeepDiveResult.id == result_id)
    )
    dd_result = result.scalar_one_or_none()
    if dd_result is None or dd_result.incident_id != incident_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deep dive result not found")

    integration = await _get_github_integration(db, incident.workspace_id)
    repo = (integration.metadata_json or {}).get("default_repo")
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No default repository set on GitHub integration",
        )

    content = await get_file_content(integration.access_token, repo, dd_result.suspect_file)

    return {
        "file_path": dd_result.suspect_file,
        "content": content,
        "suspect_lines": dd_result.suspect_lines,
    }
