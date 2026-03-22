"""
Deep dive agent — 6-step investigation pipeline.

1. Notify UI → "investigating"
2. Fetch repo tree
3. Fetch recent commits + diffs
4. LLM ranks suspect files
5. For each suspect: fetch content + identify suspect lines
6. Persist results + broadcast via WebSocket
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.deep_dive import DeepDiveResult
from app.services.github import (
    get_commit_diff,
    get_file_content,
    get_recent_commits,
    get_repo_tree,
)
from app.services.llm import identify_suspect_lines, rank_suspect_files
from app.ws_manager import manager

logger = logging.getLogger(__name__)

COMMITS_TO_FETCH = 5
TOP_N_SUSPECTS = 5


async def _send_agent_status(
    incident_id: str, status: str, message: str,
) -> None:
    await manager.send(
        incident_id,
        {
            "type": "agent_status",
            "incident_id": incident_id,
            "status": status,
            "last_message": message,
        },
    )


async def _broadcast_results(
    incident_id: str, results: list[DeepDiveResult],
) -> None:
    payload: list[dict[str, Any]] = []
    for r in results:
        payload.append({
            "id": str(r.id),
            "incident_id": incident_id,
            "suspect_file": r.suspect_file,
            "suspect_lines": r.suspect_lines,
            "confidence": r.confidence,
            "evidence_json": r.evidence_json,
            "rank": r.rank,
        })

    await manager.send(
        incident_id,
        {
            "type": "deep_dive_update",
            "incident_id": incident_id,
            "results": payload,
        },
    )


async def run_deep_dive(
    incident_id: str,
    github_token: str,
    repo_full_name: str,
    transcript_summary: str,
    db: AsyncSession | None = None,
) -> list[DeepDiveResult]:
    """Run the full deep-dive investigation pipeline.

    Can be called from the deep_dive router (manual trigger) or automatically
    from the transcript parser after enough context accumulates.
    """
    await _send_agent_status(incident_id, "investigating", "Starting repository analysis")

    try:
        results = await _pipeline(
            incident_id, github_token, repo_full_name, transcript_summary, db,
        )
        status_msg = f"Found {len(results)} suspect file(s)"
        await _send_agent_status(incident_id, "listening", status_msg)
        return results
    except Exception:
        logger.exception("Deep dive pipeline failed", extra={"incident_id": incident_id})
        await _send_agent_status(incident_id, "listening", "Deep dive failed — see logs")
        return []


async def _pipeline(
    incident_id: str,
    github_token: str,
    repo_full_name: str,
    transcript_summary: str,
    db: AsyncSession | None,
) -> list[DeepDiveResult]:

    # ── Step 1: repo tree ──
    await _send_agent_status(incident_id, "investigating", "Fetching repository file tree")
    file_tree = await get_repo_tree(github_token, repo_full_name)
    logger.info("Deep dive: %d files in tree for %s", len(file_tree), repo_full_name)

    # ── Step 2: recent commits + diffs ──
    await _send_agent_status(incident_id, "investigating", "Analyzing recent commits")
    commits = await get_recent_commits(github_token, repo_full_name, limit=COMMITS_TO_FETCH)

    commit_diffs: list[str] = []
    for commit in commits:
        try:
            diff = await get_commit_diff(github_token, repo_full_name, commit["sha"])
            commit_diffs.append(diff)
        except Exception:
            logger.warning("Could not fetch diff for %s", commit["sha"])
            commit_diffs.append("")

    combined_diff_context = "\n---\n".join(
        f"Commit {c['sha'][:8]}: {c['message']}\n{d}"
        for c, d in zip(commits, commit_diffs)
        if d
    )

    # ── Step 3: LLM ranking ──
    await _send_agent_status(incident_id, "investigating", "Ranking suspect files with AI")
    ranked = await rank_suspect_files(
        transcript_summary, file_tree, commits, top_n=TOP_N_SUSPECTS,
    )
    if not ranked:
        logger.info("Deep dive: LLM returned no suspect files")
        return []

    # ── Step 4: fetch content + identify lines for each suspect ──
    await _send_agent_status(
        incident_id, "investigating",
        f"Inspecting {len(ranked)} suspect file(s)",
    )

    results: list[DeepDiveResult] = []
    for rank_idx, suspect in enumerate(ranked, start=1):
        file_path = suspect.get("file", "")
        confidence = float(suspect.get("confidence", 0.0))
        reason = suspect.get("reason", "")

        try:
            content = await get_file_content(github_token, repo_full_name, file_path)
        except Exception:
            logger.warning("Could not fetch file content for %s; skipping", file_path)
            continue

        suspect_lines = await identify_suspect_lines(
            content, transcript_summary, combined_diff_context,
        )

        evidence: dict[str, Any] = {"reasoning": reason}
        if commits:
            evidence["commit_sha"] = commits[0]["sha"]
            evidence["commit_message"] = commits[0]["message"]
        if suspect_lines and "explanation" in suspect_lines:
            evidence["line_explanation"] = suspect_lines["explanation"]

        line_data: dict[str, int] | None = None
        if suspect_lines and "start" in suspect_lines and "end" in suspect_lines:
            line_data = {"start": suspect_lines["start"], "end": suspect_lines["end"]}

        result = DeepDiveResult(
            incident_id=uuid.UUID(incident_id),
            suspect_file=file_path,
            suspect_lines=line_data,
            confidence=confidence,
            evidence_json=evidence,
            rank=rank_idx,
        )
        results.append(result)

    # ── Step 5: persist ──
    if results:
        own_session = db is None
        session = db if db is not None else async_session_maker()

        if own_session:
            async with session as s:
                s.add_all(results)
                await s.commit()
        else:
            session.add_all(results)
            await session.commit()

    # ── Step 6: broadcast ──
    await _broadcast_results(incident_id, results)

    return results
