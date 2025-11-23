"""Add session_id column to messages table

Revision ID: 3bff5f5bc4c8
Revises: 87fbb1b8c005
Create Date: 2025-10-22 13:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "3bff5f5bc4c8"
down_revision = "87fbb1b8c005"
branch_labels = None
depends_on = None


def upgrade():
    # Add the session_id column to messages table
    op.add_column(
        "messages",
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("chat_sessions.id"),
            nullable=True,
        ),
    )
    # Create index for session_id
    op.create_index(
        op.f("ix_messages_session_id"), "messages", ["session_id"], unique=False
    )


def downgrade():
    # Drop index for session_id if it exists
    try:
        op.drop_index(op.f("ix_messages_session_id"), table_name="messages")
    except Exception:
        # Index might not exist from previous migration runs
        pass
    
    # Drop session_id column from messages table if it exists
    try:
        op.drop_column("messages", "session_id")
    except Exception:
        # Column might not exist from previous migration runs
        pass
