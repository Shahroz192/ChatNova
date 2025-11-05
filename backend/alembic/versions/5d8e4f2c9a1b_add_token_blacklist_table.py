"""Add token blacklist table for session invalidation

Revision ID: 5d8e4f2c9a1b
Revises:
Create Date: 2025-10-31 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "token_blacklist_table"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create token_blacklist table
    op.create_table(
        "token_blacklist",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Primary key",
        ),
        sa.Column(
            "token_jti",
            sa.String(length=255),
            nullable=False,
            comment="JWT ID for tracking",
        ),
        sa.Column(
            "token_type",
            sa.String(length=50),
            nullable=True,
            comment="Type of token (access, refresh)",
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            nullable=True,
            comment="User ID associated with this token",
        ),
        sa.Column(
            "token_content",
            sa.Text(),
            nullable=False,
            comment="Full token content for reference",
        ),
        sa.Column(
            "reason",
            sa.String(length=100),
            nullable=True,
            comment="Reason for blacklisting (logout, security, expiry)",
        ),
        sa.Column(
            "blacklisted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            comment="When token was blacklisted",
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When token naturally expires",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("idx_token_jti", "token_jti"),
        sa.Index("idx_user_id", "user_id"),
        sa.Index("idx_expires_at", "expires_at"),
        sa.UniqueConstraint("token_jti"),
    )


def downgrade() -> None:
    # Drop token_blacklist table
    op.drop_table("token_blacklist")
