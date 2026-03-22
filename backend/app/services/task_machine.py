"""
Task state machine — extracts tasks from transcript, manages stabilization
timers, and syncs to Jira.

States: proposed → active → synced  (with a reassigned branch that re-syncs).
A 15-second stabilization window prevents noisy early discussion from creating
duplicate Jira tickets.
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
from app.models.action_item import ActionItem
from app.services.llm import detect_reassignment, extract_tasks_from_chunk
from app.services.jira import create_jira_issue
from app.ws_manager import manager

logger = logging.getLogger(__name__)

STABILIZATION_SECONDS = 15

_pending_timers: dict[str, asyncio.Task[None]] = {}


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

async def _get_active_tasks(
    db: AsyncSession, incident_id: str,
) -> list[ActionItem]:
    result = await db.execute(
        select(ActionItem).where(
            ActionItem.incident_id == uuid.UUID(incident_id),
            ActionItem.status.in_(["active", "synced", "proposed"]),
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
    tasks = await _get_active_tasks(db, incident_id)
    return _tasks_as_summary(tasks)


# ---------------------------------------------------------------------------
# Jira sync
# ---------------------------------------------------------------------------

async def _sync_to_jira(
    task_id: str,
    incident_id: str,
    jira_access_token: str,
    jira_cloud_id: str,
    jira_project_key: str,
) -> None:
    """Create a Jira issue for the task. On failure, revert status to active."""
    async with async_session_maker() as db:
        result = await db.execute(
            select(ActionItem).where(ActionItem.id == uuid.UUID(task_id))
        )
        task = result.scalar_one_or_none()
        if task is None:
            return

        try:
            jira_result = await create_jira_issue(
                access_token=jira_access_token,
                cloud_id=jira_cloud_id,
                project_key=jira_project_key,
                summary=task.normalized_task,
                description=f"Owner (from call): {task.owner or 'Unassigned'}",
                priority="High" if task.priority in ("P1", "P2") else "Medium",
            )
            task.jira_issue_key = jira_result.get("key")
            task.status = "synced"
            task.synced_at = datetime.now(timezone.utc)
            await db.commit()

            logger.info(
                "Task synced to Jira: %s → %s",
                task_id, task.jira_issue_key,
            )
        except Exception:
            logger.exception("Jira sync failed for task %s; reverting to active", task_id)
            task.status = "active"
            await db.commit()

        await _push_task_update(incident_id, task)


# ---------------------------------------------------------------------------
# Stabilization timer
# ---------------------------------------------------------------------------

async def _stabilize_and_sync(
    task_id: str,
    incident_id: str,
    jira_access_token: str | None,
    jira_cloud_id: str | None,
    jira_project_key: str | None,
) -> None:
    """Wait for the stabilization window, then promote and sync."""
    try:
        await asyncio.sleep(STABILIZATION_SECONDS)
    except asyncio.CancelledError:
        _pending_timers.pop(task_id, None)
        return

    _pending_timers.pop(task_id, None)

    async with async_session_maker() as db:
        result = await db.execute(
            select(ActionItem).where(ActionItem.id == uuid.UUID(task_id))
        )
        task = result.scalar_one_or_none()
        if task is None:
            return

        if task.status != "proposed":
            return

        task.status = "active"
        await db.commit()
        await _push_task_update(incident_id, task)

    if jira_access_token and jira_cloud_id and jira_project_key:
        await _sync_to_jira(
            task_id, incident_id,
            jira_access_token, jira_cloud_id, jira_project_key,
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
    2. Extract new task proposals and start stabilization timers.
    """
    # ── 1. Reassignment detection ──
    active_tasks = await _get_active_tasks(db, incident_id)
    if active_tasks:
        reassignment = await detect_reassignment(
            text, _tasks_as_summary(active_tasks),
        )
        if reassignment:
            await _handle_reassignment(
                reassignment, incident_id, db,
                jira_access_token, jira_cloud_id, jira_project_key,
            )

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

        await _push_task_update(incident_id, task)

        timer = asyncio.create_task(
            _stabilize_and_sync(
                str(task.id), incident_id,
                jira_access_token, jira_cloud_id, jira_project_key,
            )
        )
        _pending_timers[str(task.id)] = timer

        logger.info("Proposed task %s: %s", task.id, task_text)


# ---------------------------------------------------------------------------
# Reassignment handler
# ---------------------------------------------------------------------------

async def _handle_reassignment(
    reassignment: dict[str, str],
    incident_id: str,
    db: AsyncSession,
    jira_access_token: str | None,
    jira_cloud_id: str | None,
    jira_project_key: str | None,
) -> None:
    task_id = reassignment.get("task_id", "")
    new_owner = reassignment.get("new_owner", "")

    # Cancel any pending stabilization timer BEFORE creating a new one (Rule §9).
    existing_timer = _pending_timers.pop(task_id, None)
    if existing_timer is not None:
        existing_timer.cancel()

    result = await db.execute(
        select(ActionItem).where(ActionItem.id == uuid.UUID(task_id))
    )
    task = result.scalar_one_or_none()
    if task is None:
        logger.warning("Reassignment target task %s not found", task_id)
        return

    previous_owner = task.owner
    task.owner = new_owner
    task.status = "reassigned"
    await db.commit()

    logger.info(
        "Task %s reassigned: %s → %s",
        task_id, previous_owner, new_owner,
    )

    await _push_task_update(incident_id, task)

    # Re-sync to Jira: start a new stabilization timer for the reassigned task
    # so the Jira ticket gets updated after the dust settles.
    if jira_access_token and jira_cloud_id and jira_project_key:
        timer = asyncio.create_task(
            _stabilize_and_sync(
                task_id, incident_id,
                jira_access_token, jira_cloud_id, jira_project_key,
            )
        )
        _pending_timers[task_id] = timer
