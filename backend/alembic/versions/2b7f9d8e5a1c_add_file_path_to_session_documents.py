"""add_file_path_to_session_documents

Revision ID: 2b7f9d8e5a1c
Revises: cbdc66c5ab65
Create Date: 2026-02-03 15:02:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2b7f9d8e5a1c"
down_revision: Union[str, None] = "cbdc66c5ab65"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("session_documents", sa.Column("file_path", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("session_documents", "file_path")
