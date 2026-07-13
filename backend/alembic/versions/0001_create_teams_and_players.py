"""create teams and players tables

Revision ID: 0001
Revises:
Create Date: 2026-07-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("abbreviation", sa.String(length=3), nullable=False),
        sa.Column("conference", sa.String(length=20), nullable=True),
        sa.Column("division", sa.String(length=20), nullable=True),
    )
    op.create_index("ix_teams_external_id", "teams", ["external_id"], unique=True)

    op.create_table(
        "players",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(length=50), nullable=False),
        sa.Column("last_name", sa.String(length=50), nullable=False),
        sa.Column("position", sa.String(length=10), nullable=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_players_external_id", "players", ["external_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_players_external_id", table_name="players")
    op.drop_table("players")
    op.drop_index("ix_teams_external_id", table_name="teams")
    op.drop_table("teams")
