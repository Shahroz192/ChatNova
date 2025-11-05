"""update_mcp_server_schema

Revision ID: 87fbb1b8c005
Revises: 331904c9c90e
Create Date: 2025-10-20 21:14:11.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "87fbb1b8c005"
down_revision = "331904c9c90e"
previous_revision = "331904c9c90e"
branch_labels = None
depends_on = None


def upgrade():
    # Drop the old columns and index
    op.drop_index("ix_user_mcp_servers_server_name", table_name="user_mcp_servers")
    op.drop_column("user_mcp_servers", "server_name")
    op.drop_column("user_mcp_servers", "server_config")

    # Add the new column
    op.add_column(
        "user_mcp_servers", sa.Column("mcp_servers_config", sa.String(), nullable=True)
    )


def downgrade():
    # Add back the old columns
    op.add_column(
        "user_mcp_servers", sa.Column("server_name", sa.String(), nullable=True)
    )
    op.add_column(
        "user_mcp_servers", sa.Column("server_config", sa.String(), nullable=True)
    )

    # Add back the index
    op.create_index(
        "ix_user_mcp_servers_server_name",
        "user_mcp_servers",
        ["server_name"],
        unique=False,
    )

    # Drop the new column
    op.drop_column("user_mcp_servers", "mcp_servers_config")
