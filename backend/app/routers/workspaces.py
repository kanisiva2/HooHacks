import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user_id
from app.models.workspace import Workspace, WorkspaceMember

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request / Response schemas (inline for Sprint 1; E3 will move to app/schemas/) ──

class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    owner_user_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberAdd(BaseModel):
    user_id: uuid.UUID
    role: str = "member"


class MemberResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Helpers ──

async def _assert_member(db: AsyncSession, workspace_id: uuid.UUID, user_id: str) -> None:
    """Raises 403 if the user is not a member of the workspace."""
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == uuid.UUID(user_id),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")


# ── Endpoints ──

@router.post("/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: WorkspaceCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """Create a new workspace. The requesting user is set as owner."""
    workspace = Workspace(
        name=body.name,
        owner_user_id=uuid.UUID(user_id),
    )
    db.add(workspace)
    await db.flush()  # flush to get workspace.id before creating member

    owner_member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=uuid.UUID(user_id),
        role="owner",
    )
    db.add(owner_member)
    await db.commit()

    logger.info("workspace_created workspace_id=%s user_id=%s name=%s", workspace.id, user_id, body.name)
    return WorkspaceResponse.model_validate(workspace)


@router.get("/workspaces", response_model=list[WorkspaceResponse])
async def list_workspaces(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[WorkspaceResponse]:
    """List all workspaces the requesting user is a member of."""
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == uuid.UUID(user_id))
        .order_by(Workspace.created_at.desc())
    )
    workspaces = result.scalars().all()
    return [WorkspaceResponse.model_validate(w) for w in workspaces]


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """Get a single workspace. User must be a member."""
    await _assert_member(db, workspace_id, user_id)

    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    return WorkspaceResponse.model_validate(workspace)


@router.post(
    "/workspaces/{workspace_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    workspace_id: uuid.UUID,
    body: MemberAdd,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> MemberResponse:
    """Add a member to a workspace. Requesting user must already be a member."""
    await _assert_member(db, workspace_id, user_id)

    # Check workspace exists
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    # Check not already a member
    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == body.user_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member")

    member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=body.user_id,
        role=body.role,
    )
    db.add(member)
    await db.commit()

    logger.info(
        "workspace_member_added workspace_id=%s new_user_id=%s role=%s added_by=%s",
        workspace_id, body.user_id, body.role, user_id,
    )
    return MemberResponse.model_validate(member)
