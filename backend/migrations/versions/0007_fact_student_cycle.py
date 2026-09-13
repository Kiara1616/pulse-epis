"""Add cycle dimension to student-period facts.

Revision ID: 0007_fact_student_cycle
Revises: 0006_etl_quality
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_fact_student_cycle"
down_revision = "0006_etl_quality"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fact_student_period", sa.Column("cycle", sa.String(length=32), nullable=True))
    op.add_column("fact_certification", sa.Column("expires_on", sa.Date(), nullable=True))
    op.create_index(
        "ix_fact_student_period_period_cycle",
        "fact_student_period",
        ["period_id", "cycle"],
    )


def downgrade() -> None:
    op.drop_index("ix_fact_student_period_period_cycle", table_name="fact_student_period")
    op.drop_column("fact_student_period", "cycle")
    op.drop_column("fact_certification", "expires_on")
