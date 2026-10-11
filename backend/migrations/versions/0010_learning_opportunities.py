"""Persist reviewed learning opportunities."""
from alembic import op
import sqlalchemy as sa
revision = "0010_learning_opportunities"
down_revision = "0009_roster_student_code"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("learning_opportunities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("source_url", sa.String(2048), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("history", sa.JSON(), nullable=False),
        sa.CheckConstraint("status IN ('DRAFT','PUBLISHED','RETIRED')", name="ck_opportunity_status"))

def downgrade():
    op.drop_table("learning_opportunities")
