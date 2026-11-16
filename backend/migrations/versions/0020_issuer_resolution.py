"""Add the canonical issuer catalog and validator requests for new issuers."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0020_issuer_resolution"
down_revision = "0019_linkedin_profile_sync"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("issuers") as batch:
        batch.add_column(sa.Column("logo_url", sa.String(length=2048), nullable=True))

    op.create_table(
        "issuer_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("certification_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("raw_name", sa.String(length=150), nullable=False),
        sa.Column("website_url", sa.String(length=2048), nullable=True),
        sa.Column("note", sa.String(length=2000), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="PENDING", nullable=False),
        sa.Column("resolved_issuer_id", sa.Uuid(), nullable=True),
        sa.Column("decision_actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("decision_comment", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED')",
            name="ck_issuer_requests_status",
        ),
        sa.ForeignKeyConstraint(["certification_id"], ["certifications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_issuer_id"], ["issuers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["decision_actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_issuer_requests_status_created",
        "issuer_requests",
        ["status", "created_at"],
    )
    op.create_index(
        "ix_issuer_requests_certification",
        "issuer_requests",
        ["certification_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_issuer_requests_certification", table_name="issuer_requests")
    op.drop_index("ix_issuer_requests_status_created", table_name="issuer_requests")
    op.drop_table("issuer_requests")
    with op.batch_alter_table("issuers") as batch:
        batch.drop_column("logo_url")
