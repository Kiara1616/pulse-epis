"""Store student LinkedIn consent/sync state and certification provenance."""

from alembic import op
import sqlalchemy as sa


revision = "0019_linkedin_profile_sync"
down_revision = "0018_roster_reconcile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("students") as batch:
        batch.add_column(sa.Column("linkedin_url", sa.String(length=2048), nullable=True))
        batch.add_column(sa.Column("linkedin_consent_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("linkedin_last_sync_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(
            sa.Column(
                "linkedin_sync_status",
                sa.String(length=20),
                nullable=False,
                server_default="NEVER",
            )
        )
        batch.add_column(sa.Column("linkedin_sync_error", sa.String(length=500), nullable=True))
        batch.create_check_constraint(
            "ck_students_linkedin_sync_status",
            "linkedin_sync_status IN ('NEVER', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')",
        )

    with op.batch_alter_table("certifications") as batch:
        batch.add_column(
            sa.Column(
                "source_kind",
                sa.String(length=30),
                nullable=False,
                server_default="MANUAL",
            )
        )
        batch.add_column(sa.Column("source_external_id", sa.String(length=255), nullable=True))
        batch.create_check_constraint(
            "ck_certifications_source_kind",
            "source_kind IN ('MANUAL', 'LINKEDIN_PROFILE', 'LINKEDIN_PUBLICATION')",
        )

    op.create_index(
        "ix_certifications_source_kind",
        "certifications",
        ["source_kind"],
    )


def downgrade() -> None:
    op.drop_index("ix_certifications_source_kind", table_name="certifications")
    with op.batch_alter_table("certifications") as batch:
        batch.drop_constraint("ck_certifications_source_kind", type_="check")
        batch.drop_column("source_external_id")
        batch.drop_column("source_kind")
    with op.batch_alter_table("students") as batch:
        batch.drop_constraint("ck_students_linkedin_sync_status", type_="check")
        batch.drop_column("linkedin_sync_error")
        batch.drop_column("linkedin_sync_status")
        batch.drop_column("linkedin_last_sync_at")
        batch.drop_column("linkedin_consent_at")
        batch.drop_column("linkedin_url")
