from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SuspectFile(BaseModel):
    file_path: str
    confidence: float
    reason: str


class DeepDiveResultOut(BaseModel):
    id: UUID
    incident_id: UUID
    suspect_file: str
    suspect_lines_start: int | None = None
    suspect_lines_end: int | None = None
    confidence: float
    evidence_json: dict[str, Any] | None = None
    rank: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
