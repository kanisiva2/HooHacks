import asyncio
import difflib
import logging
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user_id
from app.models.deep_dive import DeepDiveResult
from app.models.incident import Incident
from app.models.integration import Integration
from app.models.transcript import TranscriptChunk
from app.models.workspace import WorkspaceMember
from app.services.event_logger import log_event
from app.schemas.deep_dive import (
    ApplyFixSuggestionRequest,
    ApplyFixSuggestionResponse,
    DeepDiveResultOut,
    FixSuggestionOut,
)
from app.services.github import (
    create_branch_ref,
    create_pull_request,
    get_branch_head_sha,
    get_file_content,
    get_file_content_with_metadata,
    get_rate_limit_info,
    get_repo_details,
    get_valid_github_token,
    github_rate_limit_ok,
    update_file_on_branch,
)
from app.services.llm import generate_fix_suggestion

logger = logging.getLogger(__name__)

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


async def _build_incident_summary(db: AsyncSession, incident: Incident) -> str:
    chunks_result = await db.execute(
        select(TranscriptChunk)
        .where(
            TranscriptChunk.incident_id == incident.id,
            TranscriptChunk.is_final == True,
        )
        .order_by(TranscriptChunk.start_ts.desc())
        .limit(20)
    )
    chunks = chunks_result.scalars().all()
    return " ".join(
        f"{c.speaker or 'Unknown'}: {c.text}" for c in reversed(chunks) if c.text
    ) or f"Incident: {incident.title}"


def _get_result_lines(dd_result: DeepDiveResult) -> tuple[int, int]:
    lines = dd_result.suspect_lines or {}
    start = lines.get("start") if isinstance(lines, dict) else None
    end = lines.get("end") if isinstance(lines, dict) else None
    if not isinstance(start, int) or not isinstance(end, int) or start < 1 or end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This deep dive result does not have a valid suspect line range",
        )
    return start, end


def _get_evidence_reasoning(dd_result: DeepDiveResult) -> str:
    evidence = dd_result.evidence_json or {}
    if not isinstance(evidence, dict):
        return "No evidence reasoning provided."
    for key in ("reasoning", "reason", "evidence", "explanation"):
        value = evidence.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return "No evidence reasoning provided."


def _replace_line_range(
    file_content: str,
    *,
    line_start: int,
    line_end: int,
    replacement_code: str,
) -> tuple[str, str]:
    lines = file_content.splitlines()
    if line_end > len(lines):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Suspect lines are outside the current file contents",
        )

    replacement_lines = replacement_code.splitlines()
    original_code = "\n".join(lines[line_start - 1:line_end])
    updated_lines = [
        *lines[: line_start - 1],
        *replacement_lines,
        *lines[line_end:],
    ]
    updated_content = "\n".join(updated_lines)
    if file_content.endswith("\n"):
        updated_content += "\n"
    return original_code, updated_content


def _build_unified_diff(
    *,
    file_path: str,
    original_content: str,
    updated_content: str,
) -> str:
    return "\n".join(
        difflib.unified_diff(
            original_content.splitlines(),
            updated_content.splitlines(),
            fromfile=f"a/{file_path}",
            tofile=f"b/{file_path}",
            lineterm="",
        )
    )


def _build_fix_branch_name(
    incident_id: uuid.UUID,
    result_id: uuid.UUID,
) -> str:
    return (
        f"sprynt-fix/{str(incident_id)[:8]}-"
        f"{str(result_id)[:8]}-{uuid.uuid4().hex[:6]}"
    )


def _build_pr_body(
    *,
    incident: Incident,
    result: DeepDiveResult,
    rationale: str,
    risk_notes: str,
) -> str:
    lines = result.suspect_lines or {}
    line_summary = "unknown lines"
    if isinstance(lines, dict) and isinstance(lines.get("start"), int) and isinstance(lines.get("end"), int):
        line_summary = f"lines {lines['start']}-{lines['end']}"

    return (
        f"Automated fix suggestion for incident `{incident.title}`.\n\n"
        f"- Suspect file: `{result.suspect_file}`\n"
        f"- Suspect range: {line_summary}\n\n"
        f"Rationale:\n{rationale}\n\n"
        f"Risk notes:\n{risk_notes}"
    )


async def _resolve_repo_and_token(
    db: AsyncSession,
    incident: Incident,
) -> tuple[str, str]:
    integration = await _get_github_integration(db, incident.workspace_id)
    github_token = await get_valid_github_token(db, incident.workspace_id, integration)
    repo = incident.repo_full_name or (integration.metadata_json or {}).get("default_repo")
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No repository configured for this incident",
        )
    return repo, github_token


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

    if not github_rate_limit_ok():
        info = get_rate_limit_info()
        reset_mins = round((info["reset_in_seconds"] or 0) / 60, 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"GitHub rate limit low ({info['remaining']} remaining). Try again in ~{reset_mins} minutes.",
        )

    integration = await _get_github_integration(db, incident.workspace_id)
    github_token = await get_valid_github_token(db, incident.workspace_id, integration)

    repo = incident.repo_full_name or (integration.metadata_json or {}).get("default_repo")
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No repository configured for this incident",
        )

    transcript_summary = await _build_incident_summary(db, incident)

    # Log deep_dive_started event before launching
    await log_event(db, incident_id, "deep_dive_started", {"repo": repo})

    # Launch E4's deep dive agent as a background task (lazy import — safe if not yet merged)
    # NOTE: db is NOT passed — the request session closes when this endpoint returns.
    # E4's run_deep_dive must create its own session internally.
    logger.info("deep_dive_triggered incident_id=%s repo=%s user_id=%s", incident_id, repo, user_id)

    try:
        from app.services.deep_dive_agent import run_deep_dive
        asyncio.create_task(
            run_deep_dive(
                incident_id=str(incident_id),
                github_token=github_token,
                repo_full_name=repo,
                transcript_summary=transcript_summary,
            )
        )
    except ModuleNotFoundError:
        logger.warning("deep_dive_agent not available — returning 202 without agent")

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
    github_token = await get_valid_github_token(db, incident.workspace_id, integration)
    repo = incident.repo_full_name or (integration.metadata_json or {}).get("default_repo")
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No repository configured for this incident",
        )

    content = await get_file_content(github_token, repo, dd_result.suspect_file)
    logger.info(
        "deep_dive_file_fetched incident_id=%s file=%s result_id=%s",
        incident_id, dd_result.suspect_file, result_id,
    )

    return {
        "file_path": dd_result.suspect_file,
        "content": content,
        "suspect_lines": dd_result.suspect_lines,
    }


@router.post(
    "/incidents/{incident_id}/deep-dive/{result_id}/suggest-fix",
    response_model=FixSuggestionOut,
)
async def suggest_fix_for_result(
    incident_id: uuid.UUID,
    result_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> FixSuggestionOut:
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    result = await db.execute(
        select(DeepDiveResult).where(DeepDiveResult.id == result_id)
    )
    dd_result = result.scalar_one_or_none()
    if dd_result is None or dd_result.incident_id != incident_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deep dive result not found")

    line_start, line_end = _get_result_lines(dd_result)
    repo, github_token = await _resolve_repo_and_token(db, incident)
    repo_details = await get_repo_details(github_token, repo)
    file_data = await get_file_content_with_metadata(github_token, repo, dd_result.suspect_file)
    transcript_summary = await _build_incident_summary(db, incident)
    evidence_reasoning = _get_evidence_reasoning(dd_result)

    suggestion = await generate_fix_suggestion(
        file_path=dd_result.suspect_file,
        file_content=file_data["content"],
        line_start=line_start,
        line_end=line_end,
        incident_summary=transcript_summary,
        evidence_reasoning=evidence_reasoning,
    )
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate a fix suggestion",
        )

    original_code, updated_content = _replace_line_range(
        file_data["content"],
        line_start=line_start,
        line_end=line_end,
        replacement_code=suggestion["replacement_code"],
    )
    diff = _build_unified_diff(
        file_path=dd_result.suspect_file,
        original_content=file_data["content"],
        updated_content=updated_content,
    )

    return FixSuggestionOut(
        incident_id=incident.id,
        result_id=dd_result.id,
        repo_full_name=repo,
        file_path=dd_result.suspect_file,
        line_start=line_start,
        line_end=line_end,
        summary=suggestion.get("summary") or "Suggested fix",
        rationale=suggestion.get("rationale") or "No rationale provided.",
        risk_notes=suggestion.get("risk_notes") or "No risk notes provided.",
        replacement_code=suggestion["replacement_code"],
        original_code=original_code,
        updated_code=updated_content,
        diff=diff,
        file_sha=file_data["sha"],
        base_branch=repo_details.get("default_branch", "main"),
    )


@router.post(
    "/incidents/{incident_id}/deep-dive/{result_id}/apply-fix",
    response_model=ApplyFixSuggestionResponse,
)
async def apply_fix_for_result(
    incident_id: uuid.UUID,
    result_id: uuid.UUID,
    payload: ApplyFixSuggestionRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApplyFixSuggestionResponse:
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    result = await db.execute(
        select(DeepDiveResult).where(DeepDiveResult.id == result_id)
    )
    dd_result = result.scalar_one_or_none()
    if dd_result is None or dd_result.incident_id != incident_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deep dive result not found")

    line_start, line_end = _get_result_lines(dd_result)
    repo, github_token = await _resolve_repo_and_token(db, incident)
    repo_details = await get_repo_details(github_token, repo)
    base_branch = repo_details.get("default_branch", "main")
    file_data = await get_file_content_with_metadata(github_token, repo, dd_result.suspect_file)

    if file_data["sha"] != payload.file_sha:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The file changed on GitHub before this fix was applied. Regenerate the suggestion.",
        )

    _, updated_content = _replace_line_range(
        file_data["content"],
        line_start=line_start,
        line_end=line_end,
        replacement_code=payload.replacement_code,
    )

    branch_name = _build_fix_branch_name(incident.id, dd_result.id)

    try:
        base_sha = await get_branch_head_sha(github_token, repo, base_branch)
        await create_branch_ref(
            github_token,
            repo,
            branch_name,
            base_sha,
        )
        update_response = await update_file_on_branch(
            github_token,
            repo,
            dd_result.suspect_file,
            branch=branch_name,
            message=f"Sprynt fix: {payload.summary}",
            content=updated_content,
            sha=file_data["sha"],
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub write failed: {detail}",
        ) from exc

    pr_url: str | None = None
    pr_number: int | None = None
    if payload.open_pr:
        try:
            pr = await create_pull_request(
                github_token,
                repo,
                title=f"Sprynt fix: {payload.summary}",
                head=branch_name,
                base=base_branch,
                body=_build_pr_body(
                    incident=incident,
                    result=dd_result,
                    rationale=payload.rationale,
                    risk_notes=payload.risk_notes,
                ),
            )
            pr_url = pr.get("html_url")
            pr_number = pr.get("number")
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text if exc.response is not None else str(exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"GitHub pull request failed: {detail}",
            ) from exc

    content_data = update_response.get("content") or {}
    commit_data = update_response.get("commit") or {}
    commit_sha = commit_data.get("sha") or content_data.get("sha")

    return ApplyFixSuggestionResponse(
        branch_name=branch_name,
        commit_sha=commit_sha,
        pull_request_url=pr_url,
        pull_request_number=pr_number,
    )
