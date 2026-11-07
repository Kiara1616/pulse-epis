"""Join the historical preview and current learning branches.

Legacy opportunities remain in their original table for audit. Safe rows are
copied as DETECTED courses so an administrator must review them again.
"""

import json
from datetime import date
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "0011_learning_convergence"
down_revision = ("0010_learning_opportunities", "0010_learning_domain")
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if "learning_opportunities" not in inspector.get_table_names():
        return
    legacy = sa.table(
        "learning_opportunities",
        sa.column("source_url", sa.String),
        sa.column("status", sa.String),
        sa.column("details", sa.JSON),
    )
    courses = sa.table(
        "learning_courses",
        sa.column("id", sa.Uuid),
        sa.column("title", sa.String),
        sa.column("provider", sa.String),
        sa.column("source_url", sa.String),
        sa.column("checked_on", sa.Date),
        sa.column("requirements", sa.JSON),
        sa.column("skills", sa.JSON),
        sa.column("status", sa.String),
    )
    for row in connection.execute(sa.select(legacy.c.source_url, legacy.c.details)):
        details = row.details
        if isinstance(details, str):
            details = json.loads(details)
        if not isinstance(details, dict):
            continue
        url = str(row.source_url or "").strip()
        if not url or connection.scalar(sa.select(courses.c.id).where(courses.c.source_url == url)):
            continue
        checked = details.get("checked_on")
        try:
            checked_on = date.fromisoformat(checked) if checked else date.today()
        except (TypeError, ValueError):
            checked_on = date.today()
        connection.execute(courses.insert().values(
            id=uuid4(),
            title=str(details.get("title") or "Oportunidad por revisar")[:200],
            provider=str(details.get("provider") or "Fuente pendiente")[:150],
            source_url=url[:2048],
            checked_on=checked_on,
            requirements=list(details.get("prerequisites") or []),
            skills=list(details.get("skills") or []),
            status="DETECTED",
        ))


def downgrade() -> None:
    # Imported courses may have been edited after review; never remove them.
    pass
