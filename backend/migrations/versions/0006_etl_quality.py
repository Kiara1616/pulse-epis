"""Add ETL run traceability and data-quality rejection details.

Revision ID: 0006_etl_quality
Revises: 0005_validation_workflow
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_etl_quality"
down_revision: Union[str, None] = "0005_validation_workflow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "etl_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("period_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("cutoff_date", sa.Date(), nullable=False),
        sa.Column("source_sha256", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accepted_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rejected_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quality_report", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('APPLIED', 'REJECTED')",
            name="ck_etl_runs_status",
        ),
        sa.CheckConstraint(
            "total_rows >= 0 AND accepted_rows >= 0 AND rejected_rows >= 0 AND duplicate_rows >= 0",
            name="ck_etl_runs_counts_nonnegative",
        ),
        sa.ForeignKeyConstraint(["period_id"], ["academic_periods.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "period_id",
            "cutoff_date",
            "source_sha256",
            name="uq_etl_run_source",
        ),
    )
    op.create_index("ix_etl_runs_period_cutoff", "etl_runs", ["period_id", "cutoff_date"])
    op.create_index("ix_etl_runs_status_created", "etl_runs", ["status", "created_at"])

    op.create_table(
        "etl_rejections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("record_key", sa.String(length=128), nullable=True),
        sa.Column("field_name", sa.String(length=64), nullable=False),
        sa.Column("reason_code", sa.String(length=64), nullable=False),
        sa.Column("message", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["etl_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "run_id",
            "row_number",
            "field_name",
            "reason_code",
            name="uq_etl_rejection_detail",
        ),
    )
    op.create_index("ix_etl_rejections_run", "etl_rejections", ["run_id"])

    with op.batch_alter_table("fact_certification") as batch_op:
        batch_op.drop_constraint("ck_fact_certification_status", type_="check")
        batch_op.create_check_constraint(
            "ck_fact_certification_status",
            "status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'OBSERVED', 'RESUBMITTED', 'REJECTED', 'EXPIRED')",
        )


def downgrade() -> None:
    with op.batch_alter_table("fact_certification") as batch_op:
        batch_op.drop_constraint("ck_fact_certification_status", type_="check")
        batch_op.create_check_constraint(
            "ck_fact_certification_status",
            "status IN ('PENDING', 'APPROVED', 'OBSERVED', 'REJECTED', 'EXPIRED')",
        )

    op.drop_index("ix_etl_rejections_run", table_name="etl_rejections")
    op.drop_table("etl_rejections")
    op.drop_index("ix_etl_runs_status_created", table_name="etl_runs")
    op.drop_index("ix_etl_runs_period_cutoff", table_name="etl_runs")
    op.drop_table("etl_runs")
