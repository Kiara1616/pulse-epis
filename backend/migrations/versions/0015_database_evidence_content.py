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
    op.drop_column("evidences", "content_bytes")
