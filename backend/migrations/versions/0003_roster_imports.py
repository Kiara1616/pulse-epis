"""Add period-scoped padrón imports, rejections and historical enrollment fields."""

from alembic import op
import sqlalchemy as sa


revision = "0003_roster_imports"
down_revision = "0002_authentication"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("enrollments", sa.Column("school", sa.String(length=150), nullable=True))
    op.add_column(
        "enrollments",
        sa.Column("study_plan", sa.String(length=120), nullable=True),
    )

    uuid_type = sa.Uuid()
    op.create_table(
        "roster_imports",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("period_id", uuid_type, nullable=False),
        sa.Column("actor_user_id", uuid_type, nullable=True),
        sa.Column("source_sha256", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("accepted_rows", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("rejected_rows", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('APPLIED', 'REJECTED')",
            name="ck_roster_import_status",
        ),
        sa.CheckConstraint(
            "total_rows >= 0 AND accepted_rows >= 0 AND rejected_rows >= 0",
            name="ck_roster_import_counts_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["period_id"], ["academic_periods.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "period_id",
            "source_sha256",
            name="uq_roster_import_period_hash",
        ),
    )
    op.create_index(
        "ix_roster_imports_period_created",
        "roster_imports",
        ["period_id", "created_at"],
        unique=False,
    )
    op.create_index("ix_roster_imports_status", "roster_imports", ["status"], unique=False)

    op.create_table(
        "roster_import_rejections",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("import_id", uuid_type, nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("field_name", sa.String(length=64), nullable=False),
        sa.Column("reason_code", sa.String(length=64), nullable=False),
        sa.Column("message", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(
            ["import_id"], ["roster_imports.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "import_id",
            "row_number",
            "field_name",
            "reason_code",
            name="uq_roster_rejection_location",
        ),
    )
    op.create_index(
        "ix_roster_rejections_import",
        "roster_import_rejections",
        ["import_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_roster_rejections_import", table_name="roster_import_rejections")
    op.drop_table("roster_import_rejections")
    op.drop_index("ix_roster_imports_status", table_name="roster_imports")
    op.drop_index("ix_roster_imports_period_created", table_name="roster_imports")
    op.drop_table("roster_imports")
    op.drop_column("enrollments", "study_plan")
    op.drop_column("enrollments", "school")
