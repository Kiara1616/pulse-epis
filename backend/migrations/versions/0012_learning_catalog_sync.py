"""Add public catalog sources and external opportunity visits."""
import sqlalchemy as sa
from alembic import op

revision = "0012_learning_catalog_sync"
down_revision = "0011_student_full_name"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "learning_catalog_sources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("provider", sa.String(150), nullable=False),
        sa.Column("feed_url", sa.String(2048), nullable=False, unique=True),
        sa.Column("format", sa.String(10), nullable=False),
        sa.Column("default_skills", sa.JSON(), nullable=False),
        sa.Column("default_requirements", sa.JSON(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        sa.Column("last_sync_summary", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("format IN ('JSON','RSS')", name="ck_learning_catalog_source_format"),
    )
    op.create_table(
        "learning_opportunity_visits",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("offer_id", sa.Uuid(), sa.ForeignKey("learning_offers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_learning_opportunity_visits_student_id", "learning_opportunity_visits", ["student_id"])
    op.create_index("ix_learning_opportunity_visits_offer_id", "learning_opportunity_visits", ["offer_id"])

def downgrade():
    op.drop_table("learning_opportunity_visits")
    op.drop_table("learning_catalog_sources")
