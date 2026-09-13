"""Add private evidence metadata and retention controls."""

from alembic import op
import sqlalchemy as sa


revision = "0004_certification_evidence"
down_revision = "0003_roster_imports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "evidences",
        sa.Column("original_filename", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "evidences",
        sa.Column("content_type", sa.String(length=100), nullable=True),
    )
    op.add_column("evidences", sa.Column("byte_size", sa.Integer(), nullable=True))
    op.add_column(
        "evidences",
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=True),
    )
    with op.batch_alter_table("evidences") as batch_op:
        batch_op.create_check_constraint(
            "ck_evidence_byte_size_nonnegative",
            "byte_size IS NULL OR byte_size >= 0",
        )
    op.create_index(
        "ix_evidences_retention",
        "evidences",
        ["retention_until"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_evidences_retention", table_name="evidences")
    with op.batch_alter_table("evidences") as batch_op:
        batch_op.drop_constraint("ck_evidence_byte_size_nonnegative", type_="check")
    op.drop_column("evidences", "retention_until")
    op.drop_column("evidences", "byte_size")
    op.drop_column("evidences", "content_type")
    op.drop_column("evidences", "original_filename")
