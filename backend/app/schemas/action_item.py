from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ActionItemOut(BaseModel):
    id: UUID
    incident_id: UUID
    normalized_task: str
    owner: str | None = None
    status: str
    priority: str | None = None
    confidence: float | None = None
    jira_issue_key: str | None = None
    proposed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskDecision(BaseModel):
    task: str
    owner: str | None = None
    priority: str | None = None
    confidence: float | None = None
