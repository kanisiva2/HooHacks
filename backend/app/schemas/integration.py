from uuid import UUID

from pydantic import BaseModel


class IntegrationStatus(BaseModel):
    has_github: bool
    has_jira: bool


class ConnectRequest(BaseModel):
    workspace_id: UUID
