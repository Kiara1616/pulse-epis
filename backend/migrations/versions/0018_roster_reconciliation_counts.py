"""Record period-scoped deactivations made during roster reconciliation."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0018_roster_reconcile"
down_revision = "0017_authorized_course_feed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "roster_imports",
        sa.Column("deactivated_rows", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("roster_imports", "deactivated_rows")
