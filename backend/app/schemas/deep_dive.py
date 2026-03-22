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


class FixSuggestionOut(BaseModel):
    incident_id: UUID
    result_id: UUID
    repo_full_name: str
    file_path: str
    line_start: int
    line_end: int
    summary: str
    rationale: str
    risk_notes: str
    replacement_code: str
    original_code: str
    updated_code: str
    diff: str
    file_sha: str
    base_branch: str


class ApplyFixSuggestionRequest(BaseModel):
    replacement_code: str
    summary: str
    rationale: str
    risk_notes: str
    file_sha: str
    open_pr: bool = False


class ApplyFixSuggestionResponse(BaseModel):
    branch_name: str
    commit_sha: str | None = None
    pull_request_url: str | None = None
    pull_request_number: int | None = None
