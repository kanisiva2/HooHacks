import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user_id
from app.models.action_item import ActionItem
from app.models.incident import Incident
from app.models.workspace import WorkspaceMember
from app.schemas.action_item import ActionItemOut

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


# ── Request schema ──

class TaskUpdate(BaseModel):
    owner: str | None = None
    priority: str | None = None
    status: Literal["proposed", "active", "synced", "reassigned", "closed"] | None = None


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

    result = await db.execute(select(ActionItem).where(ActionItem.id == task_id))
    task = result.scalar_one_or_none()
    if task is None or task.incident_id != incident_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if body.owner is not None:
        task.owner = body.owner
    if body.priority is not None:
        task.priority = body.priority
    if body.status is not None:
        task.status = body.status

    await db.commit()
    return ActionItemOut.model_validate(task)
