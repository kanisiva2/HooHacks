from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    owner_user_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MemberAdd(BaseModel):
    user_id: str
    role: str = "member"
