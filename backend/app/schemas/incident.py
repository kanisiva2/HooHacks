from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class IncidentCreate(BaseModel):
    workspace_id: UUID
    title: str
    severity: str
    meeting_link: str | None = None


class IncidentUpdate(BaseModel):
    status: str | None = None
    title: str | None = None


class IncidentResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    severity: str
    status: str
    meeting_link: str | None = None
    bot_session_id: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
