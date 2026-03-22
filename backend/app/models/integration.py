import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class Integration(Base):
    __tablename__ = "integrations"
    __table_args__ = (UniqueConstraint("workspace_id", "provider", name="uq_workspace_provider"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String, nullable=False)  # "github" | "jira"
    access_token: Mapped[str] = mapped_column(String, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(String, nullable=True)   # Jira only
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # Jira only
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # metadata_json stores:
    #   GitHub: {"default_repo": "owner/repo"}
    #   Jira:   {"cloud_id": "...", "site_url": "...", "default_project_key": "..."}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
