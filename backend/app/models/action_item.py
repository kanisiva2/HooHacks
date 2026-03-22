import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ActionItem(Base):
    __tablename__ = "action_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    normalized_task: Mapped[str] = mapped_column(String, nullable=False)
    owner: Mapped[str | None] = mapped_column(String, nullable=True)  # spoken name from transcript
    status: Mapped[str] = mapped_column(String, nullable=False, default="proposed")
    # status: "proposed" | "active" | "synced" | "reassigned" | "closed"
    priority: Mapped[str | None] = mapped_column(String, nullable=True)  # "high" | "medium" | "low"
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0.0–1.0 from LLM
    jira_issue_key: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "PROJ-123"
    proposed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
