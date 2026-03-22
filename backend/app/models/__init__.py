"""
Import all models so SQLAlchemy registers them with Base.metadata.
E1 owns this file.
"""

from app.models.integration import Integration  # noqa: F401
from app.models.workspace import Workspace, WorkspaceMember  # noqa: F401
