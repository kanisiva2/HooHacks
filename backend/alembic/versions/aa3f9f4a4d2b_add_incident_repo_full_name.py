"""add incident repo full name

Revision ID: aa3f9f4a4d2b
Revises: ca0622a58ebd
Create Date: 2026-03-22 10:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "aa3f9f4a4d2b"
down_revision: Union[str, None] = "ca0622a58ebd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("incidents", sa.Column("repo_full_name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("incidents", "repo_full_name")
