import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import String, DateTime, Float, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class DeepDiveResult(Base):
    __tablename__ = "deep_dive_results"
    __table_args__ = (
        Index("ix_deep_dive_results_incident_rank", "incident_id", "rank"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    suspect_file: Mapped[str] = mapped_column(String, nullable=False)  # repo-relative path
    suspect_lines: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # suspect_lines: {"start": int, "end": int}
    confidence: Mapped[float] = mapped_column(Float, nullable=False)  # 0.0–1.0
    evidence_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # evidence_json: {"reasoning": str, "commit_sha": str, "commit_message": str}
    rank: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 = most suspect
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
