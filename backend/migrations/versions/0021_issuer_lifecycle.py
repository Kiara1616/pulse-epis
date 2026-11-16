"""Add safe archive and restore lifecycle to issuer entities."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0021_issuer_lifecycle"
down_revision = "0020_issuer_resolution"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("issuers") as batch:
        batch.add_column(
            sa.Column(
                "is_active",
                sa.Boolean(),
                server_default=sa.true(),
                nullable=False,
            )
        )
        batch.add_column(sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
        batch.create_index("ix_issuers_active_name", ["is_active", "name"])


def downgrade() -> None:
    with op.batch_alter_table("issuers") as batch:
        batch.drop_index("ix_issuers_active_name")
        batch.drop_column("archived_at")
        batch.drop_column("is_active")
