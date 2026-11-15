"""Register the repository-managed authorized course catalog feed."""

from __future__ import annotations

from uuid import uuid4

import sqlalchemy as sa
from alembic import op


revision = "0017_authorized_course_feed"
down_revision = "0016_expand_course_catalog"
branch_labels = None
depends_on = None


FEED_URL = "https://raw.githubusercontent.com/Kiara1616/pulse-epis/main/backend/data/course-catalog-feed.json"


def upgrade():
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "INSERT INTO learning_catalog_sources "
            "(id, provider, feed_url, format, default_skills, default_requirements, active) "
            "VALUES (:id, :provider, :feed_url, 'JSON', :default_skills, :default_requirements, true) "
            "ON CONFLICT (feed_url) DO UPDATE SET "
            "provider = EXCLUDED.provider, format = EXCLUDED.format, "
            "default_skills = EXCLUDED.default_skills, "
            "default_requirements = EXCLUDED.default_requirements, active = true"
        ).bindparams(
            sa.bindparam("default_skills", type_=sa.JSON()),
            sa.bindparam("default_requirements", type_=sa.JSON()),
        ),
        {
            "id": str(uuid4()),
            "provider": "Pulse EPIS · catálogo curado U2",
            "feed_url": FEED_URL,
            "default_skills": ["Tecnologías de información"],
            "default_requirements": ["Consultar requisitos en el enlace oficial"],
        },
    )


def downgrade():
    connection = op.get_bind()
    connection.execute(
        sa.text("DELETE FROM learning_catalog_sources WHERE feed_url = :feed_url"),
        {"feed_url": FEED_URL},
    )
