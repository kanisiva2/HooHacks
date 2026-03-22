import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Float, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class TranscriptChunk(Base):
    __tablename__ = "transcript_chunks"
    __table_args__ = (
        Index("ix_transcript_chunks_incident_start", "incident_id", "start_ts"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    speaker: Mapped[str | None] = mapped_column(String, nullable=True)  # diarization label from Deepgram
    text: Mapped[str] = mapped_column(String, nullable=False)
    start_ts: Mapped[float | None] = mapped_column(Float, nullable=True)  # seconds from meeting start
    end_ts: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
