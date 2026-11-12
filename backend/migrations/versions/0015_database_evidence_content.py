"""Store newly uploaded private certification evidence in the database."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0015_database_evidence_content"
down_revision = "0014_roster_candidates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "evidences",
        sa.Column("content_bytes", sa.LargeBinary(), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    stored_evidence_exists = bind.scalar(
        sa.text(
            "SELECT EXISTS "
            "(SELECT 1 FROM evidences WHERE content_bytes IS NOT NULL)"
        )
    )
    if stored_evidence_exists:
        raise RuntimeError(
            "Refusing to remove stored certification evidence. Back up or export "
            "the evidence bytes before downgrading this migration."
        )
    op.drop_column("evidences", "content_bytes")
