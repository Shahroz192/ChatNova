"""enable_pgvector_extension

Revision ID: cf67e6d30a3a
Revises: fa5839e0d71a
Create Date: 2026-01-29 23:21:03.310171

"""

from typing import Sequence, Union
import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "cf67e6d30a3a"
down_revision: Union[str, None] = "fa5839e0d71a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Check if vector extension is available in pg_available_extensions
    res = conn.execute(
        sa.text("SELECT count(*) FROM pg_available_extensions WHERE name = 'vector'")
    ).scalar()
    if res > 0:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    else:
        print("Warning: pgvector extension not available in pg_available_extensions.")


def downgrade() -> None:
    conn = op.get_bind()
    res = conn.execute(
        sa.text("SELECT count(*) FROM pg_available_extensions WHERE name = 'vector'")
    ).scalar()
    if res > 0:
        op.execute("DROP EXTENSION IF EXISTS vector")
