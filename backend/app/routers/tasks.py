import logging
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user_id
from app.models.action_item import ActionItem
from app.models.incident import Incident
from app.models.integration import Integration
from app.models.workspace import WorkspaceMember
from app.schemas.action_item import ActionItemOut
from app.services.task_machine import sync_task_to_jira, _push_task_update

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


async def _get_task_or_404(db: AsyncSession, incident_id: uuid.UUID, task_id: uuid.UUID) -> ActionItem:
    result = await db.execute(select(ActionItem).where(ActionItem.id == task_id))
    task = result.scalar_one_or_none()
    if task is None or task.incident_id != incident_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


# ── Request schema ──

class TaskUpdate(BaseModel):
    owner: str | None = None
    priority: str | None = None
    status: Literal["proposed", "synced", "dismissed", "closed"] | None = None


# ── Endpoints ──

@router.get("/incidents/{incident_id}/tasks", response_model=list[ActionItemOut])
async def list_tasks(
    incident_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[ActionItemOut]:
    """List all action items for an incident, ordered by proposed_at."""
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)

    result = await db.execute(
        select(ActionItem)
        .where(ActionItem.incident_id == incident_id)
        .order_by(ActionItem.proposed_at.asc())
    )
    items = result.scalars().all()
    return [ActionItemOut.model_validate(item) for item in items]


@router.patch("/incidents/{incident_id}/tasks/{task_id}", response_model=ActionItemOut)
async def update_task(
    incident_id: uuid.UUID,
    task_id: uuid.UUID,
    body: TaskUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ActionItemOut:
    """Manually update a task's owner, priority, or status."""
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)
    task = await _get_task_or_404(db, incident_id, task_id)

    if body.owner is not None:
        task.owner = body.owner
    if body.priority is not None:
        task.priority = body.priority
    if body.status is not None:
        task.status = body.status

    await db.commit()
    return ActionItemOut.model_validate(task)


@router.post("/incidents/{incident_id}/tasks/{task_id}/approve", response_model=ActionItemOut)
async def approve_task(
    incident_id: uuid.UUID,
    task_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ActionItemOut:
    """Approve a proposed task — syncs it to Jira immediately."""
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)
    task = await _get_task_or_404(db, incident_id, task_id)

    if task.status not in ("proposed",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve task in '{task.status}' status",
        )

    # Fetch Jira integration for the workspace
    result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == incident.workspace_id,
            Integration.provider == "jira",
        )
    )
    jira_integration = result.scalar_one_or_none()

    if jira_integration:
        meta = jira_integration.metadata_json or {}
        cloud_id = meta.get("cloud_id")
        project_key = meta.get("default_project_key")

        if cloud_id and project_key:
            await sync_task_to_jira(
                task_id=str(task_id),
                incident_id=str(incident_id),
                jira_access_token=jira_integration.access_token,
                jira_cloud_id=cloud_id,
                jira_project_key=project_key,
            )
            # Re-fetch the task since sync_task_to_jira uses its own session
            await db.refresh(task)
            return ActionItemOut.model_validate(task)

    # No Jira integration — just move to synced without a Jira ticket
    task.status = "synced"
    from datetime import datetime
    task.synced_at = datetime.utcnow()
    await db.commit()
    await _push_task_update(str(incident_id), task)
    logger.info("Task %s approved without Jira (no integration)", task_id)
    return ActionItemOut.model_validate(task)


@router.post("/incidents/{incident_id}/tasks/{task_id}/dismiss", response_model=ActionItemOut)
async def dismiss_task(
    incident_id: uuid.UUID,
    task_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ActionItemOut:
    """Dismiss a proposed task — removes it from the board, no Jira sync."""
    incident = await _get_incident_or_404(db, incident_id)
    await _assert_workspace_member(db, incident.workspace_id, user_id)
    task = await _get_task_or_404(db, incident_id, task_id)

    if task.status not in ("proposed",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot dismiss task in '{task.status}' status",
        )

    task.status = "dismissed"
    await db.commit()
    await _push_task_update(str(incident_id), task)
    logger.info("Task %s dismissed", task_id)
    return ActionItemOut.model_validate(task)
