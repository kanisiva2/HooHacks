from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator


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

    @model_validator(mode="before")
    @classmethod
    def flatten_suspect_lines(cls, data: Any) -> Any:
        # Convert ORM object to dict so Pydantic can process it cleanly
        if hasattr(data, "__tablename__"):
            lines = getattr(data, "suspect_lines", None) or {}
            return {
                "id": data.id,
                "incident_id": data.incident_id,
                "suspect_file": data.suspect_file,
                "suspect_lines_start": lines.get("start") if isinstance(lines, dict) else None,
                "suspect_lines_end": lines.get("end") if isinstance(lines, dict) else None,
                "confidence": data.confidence,
                "evidence_json": data.evidence_json,
                "rank": data.rank,
                "created_at": data.created_at,
            }
        # Plain dict case (e.g. from API tests)
        if isinstance(data, dict) and "suspect_lines" in data:
            lines = data.pop("suspect_lines", None) or {}
            data.setdefault("suspect_lines_start", lines.get("start") if isinstance(lines, dict) else None)
            data.setdefault("suspect_lines_end", lines.get("end") if isinstance(lines, dict) else None)
        return data
