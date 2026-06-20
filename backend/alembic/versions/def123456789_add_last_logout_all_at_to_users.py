"""Add last_logout_all_at to users table

Revision ID: def123456789
Revises: cbdc66c5ab65
Create Date: 2026-06-19 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "def123456789"
down_revision = "abcd1234ef56"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "last_logout_all_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("users", "last_logout_all_at")
