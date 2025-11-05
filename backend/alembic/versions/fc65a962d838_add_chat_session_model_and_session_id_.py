"""Add ChatSession model and session_id to Message model

Revision ID: fc65a962d838
Revises: 9790ecd14c4e
Create Date: 2024-10-16 13:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "fc65a962d838"
down_revision = "9790ecd14c4e"
branch_labels = None
depends_on = None


def upgrade():
    # Create chat_sessions table
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_sessions_id"), "chat_sessions", ["id"], unique=False)
    op.create_index(
        op.f("ix_chat_sessions_title"), "chat_sessions", ["title"], unique=False
    )
    op.create_index(
        op.f("ix_chat_sessions_user_id"), "chat_sessions", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_chat_sessions_created_at"),
        "chat_sessions",
        ["created_at"],
        unique=False,
    )

    # Add session_id column to messages table
    op.add_column(
        "messages",
        sa.Column(
            "session_id", sa.Integer(), sa.ForeignKey("chat_sessions.id"), nullable=True
        ),
    )
    op.create_index(
        op.f("ix_messages_session_id"), "messages", ["session_id"], unique=False
    )


def downgrade():
    # Drop session_id column from messages table
    op.drop_index(op.f("ix_messages_session_id"), table_name="messages")
    op.drop_column("messages", "session_id")

    # Drop chat_sessions table
    op.drop_index(op.f("ix_chat_sessions_created_at"), table_name="chat_sessions")
    op.drop_index(op.f("ix_chat_sessions_user_id"), table_name="chat_sessions")
    op.drop_index(op.f("ix_chat_sessions_title"), table_name="chat_sessions")
    op.drop_index(op.f("ix_chat_sessions_id"), table_name="chat_sessions")
    op.drop_table("chat_sessions")
