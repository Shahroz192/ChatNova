"""Add ui_data to messages

Revision ID: 7e2f4b9a1c3d
Revises: def123456789
Create Date: 2026-06-19 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "7e2f4b9a1c3d"
down_revision = "def123456789"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("messages", sa.Column("ui_data", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("messages", "ui_data")
