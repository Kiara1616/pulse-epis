"""Curated external course discovery sources and observation history."""
import sqlalchemy as sa
from alembic import op

revision = "0013_learning_discovery"
down_revision = "0012_certification_catalog"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("learning_discovery_sources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("url", sa.String(2048), nullable=False, unique=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("terms_reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    with op.batch_alter_table("learning_courses") as batch:
        batch.add_column(sa.Column("discovery_source_id", sa.Uuid(), nullable=True))
        batch.add_column(sa.Column("content_hash", sa.String(64), nullable=True))
        batch.add_column(sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
        batch.create_foreign_key("fk_learning_course_discovery_source", "learning_discovery_sources", ["discovery_source_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_learning_courses_discovery_source_id", "learning_courses", ["discovery_source_id"])


def downgrade():
    op.drop_index("ix_learning_courses_discovery_source_id", table_name="learning_courses")
    with op.batch_alter_table("learning_courses") as batch:
        batch.drop_constraint("fk_learning_course_discovery_source", type_="foreignkey")
        batch.drop_column("last_seen_at")
        batch.drop_column("first_seen_at")
        batch.drop_column("content_hash")
        batch.drop_column("discovery_source_id")
    op.drop_table("learning_discovery_sources")
