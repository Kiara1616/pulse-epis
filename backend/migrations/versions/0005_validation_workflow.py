"""Add certification validation workflow and immutable status history."""

from alembic import op
import sqlalchemy as sa


revision = "0005_validation_workflow"
down_revision = "0004_certification_evidence"
branch_labels = None
depends_on = None


_OLD_STATUS_CHECK = "status IN ('PENDING', 'APPROVED', 'OBSERVED', 'REJECTED', 'EXPIRED')"
_NEW_STATUS_CHECK = "status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'OBSERVED', 'RESUBMITTED', 'REJECTED', 'EXPIRED')"
_STATUS_VALUES = "'PENDING', 'UNDER_REVIEW', 'APPROVED', 'OBSERVED', 'RESUBMITTED', 'REJECTED', 'EXPIRED'"


def upgrade() -> None:
    with op.batch_alter_table("certifications") as batch_op:
        batch_op.drop_constraint("ck_certifications_status", type_="check")
        batch_op.create_check_constraint("ck_certifications_status", _NEW_STATUS_CHECK)

    op.create_table(
        "certification_status_history",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("certification_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("from_status", sa.String(length=20), nullable=True),
        sa.Column("to_status", sa.String(length=20), nullable=False),
        sa.Column("comment", sa.String(length=2000), nullable=True),
        sa.Column("cutoff_date", sa.Date(), nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            f"from_status IS NULL OR from_status IN ({_STATUS_VALUES})",
            name="ck_certification_history_from_status",
        ),
        sa.CheckConstraint(
            f"to_status IN ({_STATUS_VALUES})",
            name="ck_certification_history_to_status",
        ),
        sa.ForeignKeyConstraint(
            ["certification_id"],
            ["certifications.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_certification_history_certification_changed",
        "certification_status_history",
        ["certification_id", "changed_at"],
        unique=False,
    )
    op.create_index(
        "ix_certification_history_actor",
        "certification_status_history",
        ["actor_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_certification_history_actor",
        table_name="certification_status_history",
    )
    op.drop_index(
        "ix_certification_history_certification_changed",
        table_name="certification_status_history",
    )
    op.drop_table("certification_status_history")
    with op.batch_alter_table("certifications") as batch_op:
        batch_op.drop_constraint("ck_certifications_status", type_="check")
        batch_op.create_check_constraint("ck_certifications_status", _OLD_STATUS_CHECK)
