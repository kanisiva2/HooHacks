"""
Task state machine — extracts tasks from transcript and manages task lifecycle.

States: proposed → synced  (user must approve via the dashboard).
Verbal reassignment moves a synced task back to proposed for re-approval.
Dismissed tasks are hidden from the board and never synced.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.action_item import ActionItem
from app.services.llm import detect_reassignment, extract_tasks_from_chunk
from app.services.jira import create_jira_issue, update_jira_assignee, get_jira_users
from app.ws_manager import manager

logger = logging.getLogger(__name__)

_task_source_text: dict[str, str] = {}


# ---------------------------------------------------------------------------
# WebSocket helpers
# ---------------------------------------------------------------------------

def _task_to_ws_payload(incident_id: str, task: ActionItem) -> dict[str, Any]:
    return {
        "type": "action_item_update",
        "incident_id": incident_id,
        "id": str(task.id),
        "normalized_task": task.normalized_task,
        "owner": task.owner,
        "status": task.status,
        "priority": task.priority,
        "confidence": task.confidence,
        "jira_issue_key": task.jira_issue_key,
        "proposed_at": task.proposed_at.isoformat() if task.proposed_at else None,
        "synced_at": task.synced_at.isoformat() if task.synced_at else None,
    }


async def _push_task_update(incident_id: str, task: ActionItem) -> None:
    await manager.send(incident_id, _task_to_ws_payload(incident_id, task))


# ---------------------------------------------------------------------------
# Active task helpers
# ---------------------------------------------------------------------------

async def _get_existing_tasks(
    db: AsyncSession, incident_id: str,
) -> list[ActionItem]:
    result = await db.execute(
        select(ActionItem).where(
            ActionItem.incident_id == uuid.UUID(incident_id),
            ActionItem.status.in_(["proposed", "synced"]),
        )
    )
    return list(result.scalars().all())


def _tasks_as_summary(tasks: list[ActionItem]) -> list[dict[str, Any]]:
    return [
        {
            "id": str(t.id),
            "normalized_task": t.normalized_task,
            "owner": t.owner,
            "status": t.status,
        }
        for t in tasks
    ]


async def get_active_tasks_summary(
    db: AsyncSession, incident_id: str,
) -> list[dict[str, Any]]:
    tasks = await _get_existing_tasks(db, incident_id)
    return _tasks_as_summary(tasks)


# ---------------------------------------------------------------------------
# Jira sync — called from the /approve endpoint
# ---------------------------------------------------------------------------

async def _resolve_jira_assignee(
    owner_name: str | None,
    jira_access_token: str,
    jira_cloud_id: str,
) -> str | None:
    """Best-effort match of a spoken owner name to a Jira account ID."""
    if not owner_name:
        return None
    try:
        users = await get_jira_users(jira_access_token, jira_cloud_id, owner_name)
        if users:
            logger.info(
                "Matched spoken owner '%s' → Jira user %s (%s)",
                owner_name, users[0]["displayName"], users[0]["accountId"],
            )
            return users[0]["accountId"]
        logger.info("No Jira user match for spoken owner '%s'", owner_name)
    except Exception:
        logger.exception("Jira user search failed for '%s'", owner_name)
    return None


async def sync_task_to_jira(
    task_id: str,
    incident_id: str,
    jira_access_token: str,
    jira_cloud_id: str,
    jira_project_key: str,
) -> None:
    """Sync a single task to Jira. Called when the user approves a task."""
    async with async_session_maker() as db:
        result = await db.execute(
            select(ActionItem).where(ActionItem.id == uuid.UUID(task_id))
        )
        task = result.scalar_one_or_none()
        if task is None:
            return

        try:
            if task.jira_issue_key:
                await _update_jira_issue(
                    task, jira_access_token, jira_cloud_id,
                )
                task.status = "synced"
                task.synced_at = datetime.utcnow()
                await db.commit()
                logger.info(
                    "Task re-synced to Jira (update): %s → %s",
                    task_id, task.jira_issue_key,
                )
            else:
                assignee_id = await _resolve_jira_assignee(
                    task.owner, jira_access_token, jira_cloud_id,
                )

                description = f"Owner (from call): {task.owner or 'Unassigned'}"
                jira_result = await create_jira_issue(
                    access_token=jira_access_token,
                    cloud_id=jira_cloud_id,
                    project_key=jira_project_key,
                    summary=task.normalized_task,
                    description=description,
                    priority="High" if task.priority in ("P1", "P2") else "Medium",
                    assignee_account_id=assignee_id,
                    source_transcript=_task_source_text.pop(task_id, None),
                )
                task.jira_issue_key = jira_result.get("key")
                task.status = "synced"
                task.synced_at = datetime.utcnow()
                await db.commit()
                logger.info(
                    "Task synced to Jira (create): %s → %s",
                    task_id, task.jira_issue_key,
                )
        except Exception:
            logger.exception("Jira sync failed for task %s; keeping as proposed", task_id)
            task.status = "proposed"
            await db.commit()

        await _push_task_update(incident_id, task)


async def _update_jira_issue(
    task: ActionItem,
    jira_access_token: str,
    jira_cloud_id: str,
) -> None:
    """Best-effort Jira assignee update for reassigned tasks."""
    if not task.owner or not task.jira_issue_key:
        return

    try:
        users = await get_jira_users(jira_access_token, jira_cloud_id, task.owner)
        if users:
            await update_jira_assignee(
                jira_access_token, jira_cloud_id,
                task.jira_issue_key, users[0]["accountId"],
            )
            logger.info(
                "Jira assignee updated: %s → %s (%s)",
                task.jira_issue_key, task.owner, users[0]["accountId"],
            )
        else:
            logger.warning(
                "No Jira user match for '%s'; skipping assignee update on %s",
                task.owner, task.jira_issue_key,
            )
    except Exception:
        logger.exception(
            "Jira assignee update failed for %s", task.jira_issue_key,
        )


# ---------------------------------------------------------------------------
# Main entry point — called from transcript_parser
# ---------------------------------------------------------------------------

async def process_transcript_chunk(
    incident_id: str,
    speaker: str,
    text: str,
    db: AsyncSession,
    jira_access_token: str | None = None,
    jira_cloud_id: str | None = None,
    jira_project_key: str | None = None,
) -> None:
    """Process a final transcript chunk through the task state machine.

    1. Check for reassignments of existing tasks.
    2. Extract new task proposals (stay in proposed until user approves).
    """
    # ── 1. Reassignment detection ──
    existing_tasks = await _get_existing_tasks(db, incident_id)
    if existing_tasks:
        reassignment = await detect_reassignment(
            text, _tasks_as_summary(existing_tasks),
        )
        if reassignment:
            await _handle_reassignment(reassignment, incident_id, db)

    # ── 2. New task extraction ──
    proposals = await extract_tasks_from_chunk(text, speaker)
    for proposal in proposals:
        task_text = proposal.get("task", "").strip()
        if not task_text:
            continue

        task = ActionItem(
            incident_id=uuid.UUID(incident_id),
            normalized_task=task_text,
            owner=proposal.get("owner"),
            status="proposed",
            priority=proposal.get("priority"),
            confidence=proposal.get("confidence"),
        )
        db.add(task)
        await db.flush()
        await db.commit()

        task_id_str = str(task.id)
        _task_source_text[task_id_str] = text

        await _push_task_update(incident_id, task)
        logger.info("Proposed task %s: %s", task_id_str, task_text)


# ---------------------------------------------------------------------------
# Reassignment handler
# ---------------------------------------------------------------------------

async def _handle_reassignment(
    reassignment: dict[str, str],
    incident_id: str,
    db: AsyncSession,
) -> None:
    task_id = reassignment.get("task_id", "")
    new_owner = reassignment.get("new_owner", "")

    result = await db.execute(
        select(ActionItem).where(ActionItem.id == uuid.UUID(task_id))
    )
    task = result.scalar_one_or_none()
    if task is None:
        logger.warning("Reassignment target task %s not found", task_id)
        return

    previous_owner = task.owner
    task.owner = new_owner
    task.status = "proposed"
    await db.commit()

    logger.info(
        "Task %s reassigned: %s → %s (moved back to proposed)",
        task_id, previous_owner, new_owner,
    )

    await _push_task_update(incident_id, task)
