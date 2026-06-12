"""add_processing_status_to_session_documents

Revision ID: abcd1234ef56
Revises: 12c0b98ff310
Create Date: 2026-04-29 12:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "abcd1234ef56"
down_revision: Union[str, None] = "12c0b98ff310"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add processing_status column to session_documents table
    op.add_column(
        "session_documents",
        sa.Column(
            "processing_status",
            sa.String(),
            nullable=False,
            server_default="pending"
        )
    )


def downgrade() -> None:
    # Remove processing_status column
    op.drop_column("session_documents", "processing_status")
