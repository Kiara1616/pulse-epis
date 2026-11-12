"""Retain incomplete period roster rows for explicit admin reconciliation."""

from alembic import op
import sqlalchemy as sa


revision = "0014_roster_candidates"
down_revision = "0013_official_learning_catalog"
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid_type = sa.Uuid()
    op.create_table(
        "roster_candidates",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("period_id", uuid_type, nullable=False),
        sa.Column("source_sha256", sa.String(length=64), nullable=False),
        sa.Column("source_row", sa.Integer(), nullable=False),
        sa.Column("source_name", sa.String(length=200), nullable=False),
        sa.Column("source_cycle", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("cycle", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("student_code", sa.String(length=64), nullable=True),
        sa.Column("school", sa.String(length=150), nullable=False),
        sa.Column("study_plan", sa.String(length=120), nullable=False),
        sa.Column("student_status", sa.String(length=20), nullable=False),
        sa.Column("issue_code", sa.String(length=64), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("resolution_reason", sa.String(length=500), nullable=True),
        sa.Column("created_by", uuid_type, nullable=True),
        sa.Column("updated_by", uuid_type, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "state IN ('PENDING', 'RESOLVED', 'EXCLUDED')",
            name="ck_roster_candidate_state",
        ),
        sa.CheckConstraint(
            "student_status IN ('ACTIVE', 'INACTIVE', 'GRADUATED')",
            name="ck_roster_candidate_student_status",
        ),
        sa.ForeignKeyConstraint(
            ["period_id"], ["academic_periods.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "period_id",
            "source_sha256",
            "source_row",
            name="uq_roster_candidate_source_row",
        ),
    )
    op.create_index(
        "ix_roster_candidates_period_state",
        "roster_candidates",
        ["period_id", "state"],
    )


def downgrade() -> None:
    op.drop_index("ix_roster_candidates_period_state", table_name="roster_candidates")
    op.drop_table("roster_candidates")
