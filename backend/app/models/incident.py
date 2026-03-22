import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False)  # "P1" | "P2" | "P3" | "P4"
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    # status: "active" | "resolved" | "closed"
    meeting_link: Mapped[str | None] = mapped_column(String, nullable=True)
    bot_session_id: Mapped[str | None] = mapped_column(String, nullable=True)  # Skribby bot ID
    audio_s3_key: Mapped[str | None] = mapped_column(String, nullable=True)
    transcript_s3_key: Mapped[str | None] = mapped_column(String, nullable=True)
    report_s3_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    events: Mapped[list["IncidentEvent"]] = relationship(
        "IncidentEvent", back_populates="incident", cascade="all, delete-orphan"
    )


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    # event_type: "bot_joined" | "task_created" | "deep_dive_started" | "deep_dive_completed"
    #             | "incident_resolved" | "incident_closed" | "voice_question" | "voice_answer"
    payload_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    incident: Mapped["Incident"] = relationship("Incident", back_populates="events")
