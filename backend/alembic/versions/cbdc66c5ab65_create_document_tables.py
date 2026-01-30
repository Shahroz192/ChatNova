"""create_document_tables

Revision ID: cbdc66c5ab65
Revises: cf67e6d30a3a
Create Date: 2026-01-29 23:59:10.576195

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "cbdc66c5ab65"
down_revision: Union[str, None] = "cf67e6d30a3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if vector type exists
    conn = op.get_bind()
    res = conn.execute(
        sa.text("SELECT count(*) FROM pg_type WHERE typname = 'vector'")
    ).scalar()
    has_vector = res > 0

    if has_vector:
        from pgvector.sqlalchemy import Vector

        embedding_type = Vector(768)
    else:
        # Fallback to ARRAY of Floats if pgvector is missing
        embedding_type = sa.ARRAY(sa.Float)

    op.create_table(
        "session_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["session_id"], ["chat_sessions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_session_documents_id"), "session_documents", ["id"], unique=False
    )

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", embedding_type, nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["document_id"], ["session_documents.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_document_chunks_id"), "document_chunks", ["id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_document_chunks_id"), table_name="document_chunks")
    op.drop_table("document_chunks")
    op.drop_index(op.f("ix_session_documents_id"), table_name="session_documents")
    op.drop_table("session_documents")
