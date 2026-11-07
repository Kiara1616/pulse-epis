"""Administrator-owned issuer and credential catalog with student proposals."""

from uuid import uuid4
import unicodedata

import sqlalchemy as sa
from alembic import op

revision = "0012_certification_catalog"
down_revision = "0011_learning_convergence"
branch_labels = None
depends_on = None


def key(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value.casefold())
    return " ".join("".join(c for c in folded if not unicodedata.combining(c)).split())


def upgrade() -> None:
    op.add_column("issuers", sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("skills", sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_table("issuer_aliases",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("issuer_id", sa.Uuid(), sa.ForeignKey("issuers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("normalized_name", sa.String(150), nullable=False, unique=True),
    )
    op.create_index("ix_issuer_aliases_issuer_id", "issuer_aliases", ["issuer_id"])
    op.create_table("credential_catalog",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("issuer_id", sa.Uuid(), sa.ForeignKey("issuers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("normalized_name", sa.String(200), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("issuer_id", "normalized_name", name="uq_credential_catalog_identity"),
    )
    op.create_index("ix_credential_catalog_issuer_id", "credential_catalog", ["issuer_id"])
    op.create_table("credential_catalog_skills",
        sa.Column("credential_id", sa.Uuid(), sa.ForeignKey("credential_catalog.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("skill_id", sa.Uuid(), sa.ForeignKey("skills.id", ondelete="RESTRICT"), primary_key=True),
    )
    op.create_table("catalog_proposals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("proposed_name", sa.String(200), nullable=False),
        sa.Column("issuer_id", sa.Uuid(), sa.ForeignKey("issuers.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("resolved_id", sa.Uuid(), nullable=True),
        sa.Column("reviewer_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_catalog_proposals_student_id", "catalog_proposals", ["student_id"])
    op.create_table("certification_submission_drafts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("form_data", sa.JSON(), nullable=False),
        sa.Column("proposal_ids", sa.JSON(), nullable=False),
        sa.Column("evidence_object_key", sa.String(512), nullable=True),
        sa.Column("evidence_filename", sa.String(255), nullable=True),
        sa.Column("evidence_content_type", sa.String(100), nullable=True),
        sa.Column("evidence_sha256", sa.String(64), nullable=True),
        sa.Column("evidence_size", sa.Integer(), nullable=True),
        sa.Column("submitted_certification_id", sa.Uuid(), sa.ForeignKey("certifications.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_certification_submission_drafts_student_id", "certification_submission_drafts", ["student_id"])
    with op.batch_alter_table("certifications") as batch:
        batch.add_column(sa.Column("catalog_credential_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key("fk_certification_catalog_credential", "credential_catalog", ["catalog_credential_id"], ["id"], ondelete="RESTRICT")

    connection = op.get_bind()
    issuers = sa.table("issuers", sa.column("id", sa.Uuid()), sa.column("name", sa.String()))
    aliases = sa.table("issuer_aliases", sa.column("id", sa.Uuid()), sa.column("issuer_id", sa.Uuid()), sa.column("name", sa.String()), sa.column("normalized_name", sa.String()))
    for issuer_id, name in connection.execute(sa.select(issuers.c.id, issuers.c.name)):
        normalized = key(name)
        if not connection.scalar(sa.select(aliases.c.id).where(aliases.c.normalized_name == normalized)):
            connection.execute(aliases.insert().values(id=uuid4(), issuer_id=issuer_id, name=name, normalized_name=normalized))
    certs = sa.table("certifications", sa.column("id", sa.Uuid()), sa.column("issuer_id", sa.Uuid()), sa.column("credential_name", sa.String()), sa.column("catalog_credential_id", sa.Uuid()))
    catalog = sa.table("credential_catalog", sa.column("id", sa.Uuid()), sa.column("issuer_id", sa.Uuid()), sa.column("name", sa.String()), sa.column("normalized_name", sa.String()), sa.column("active", sa.Boolean()))
    mappings: dict[tuple[object, str], object] = {}
    for cert_id, issuer_id, name in connection.execute(sa.select(certs.c.id, certs.c.issuer_id, certs.c.credential_name)):
        identity = (issuer_id, key(name))
        catalog_id = mappings.get(identity)
        if catalog_id is None:
            catalog_id = uuid4()
            mappings[identity] = catalog_id
            connection.execute(catalog.insert().values(id=catalog_id, issuer_id=issuer_id, name=name, normalized_name=identity[1], active=True))
        connection.execute(certs.update().where(certs.c.id == cert_id).values(catalog_credential_id=catalog_id))
    links = sa.table("certification_skills", sa.column("certification_id", sa.Uuid()), sa.column("skill_id", sa.Uuid()))
    defaults = sa.table("credential_catalog_skills", sa.column("credential_id", sa.Uuid()), sa.column("skill_id", sa.Uuid()))
    seen: set[tuple[object, object]] = set()
    for credential_id, skill_id in connection.execute(sa.select(certs.c.catalog_credential_id, links.c.skill_id).select_from(certs.join(links, certs.c.id == links.c.certification_id))):
        pair = (credential_id, skill_id)
        if pair not in seen:
            seen.add(pair)
            connection.execute(defaults.insert().values(credential_id=credential_id, skill_id=skill_id))


def downgrade() -> None:
    op.drop_table("certification_submission_drafts")
    with op.batch_alter_table("certifications") as batch:
        batch.drop_constraint("fk_certification_catalog_credential", type_="foreignkey")
        batch.drop_column("catalog_credential_id")
    op.drop_table("catalog_proposals")
    op.drop_table("credential_catalog_skills")
    op.drop_table("credential_catalog")
    op.drop_table("issuer_aliases")
    op.drop_column("skills", "active")
    op.drop_column("issuers", "active")
