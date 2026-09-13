"""Create the operational and analytical Pulse EPIS schema."""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid_type = sa.Uuid()

    op.create_table(
        "users",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column(
            "role", sa.String(length=20), nullable=False, server_default=sa.text("'STUDENT'")
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "role IN ('ADMIN', 'VALIDATOR', 'STUDENT')",
            name="ck_users_role",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_role_active", "users", ["role", "is_active"], unique=False)

    op.create_table(
        "students",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("user_id", uuid_type, nullable=True),
        sa.Column("student_key", sa.String(length=64), nullable=False),
        sa.Column("entry_year", sa.SmallInteger(), nullable=True),
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default=sa.text("'ACTIVE'")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'GRADUATED', 'UNKNOWN')",
            name="ck_students_status",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_key", name="uq_students_student_key"),
        sa.UniqueConstraint("user_id", name="uq_students_user"),
    )
    op.create_index("ix_students_status", "students", ["status"], unique=False)
    op.create_index("ix_students_entry_year", "students", ["entry_year"], unique=False)

    op.create_table(
        "academic_periods",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default=sa.text("'OPEN'")
        ),
        sa.CheckConstraint("ends_on >= starts_on", name="ck_period_dates"),
        sa.CheckConstraint("status IN ('OPEN', 'CLOSED')", name="ck_periods_status"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_academic_periods_code"),
    )
    op.create_index(
        "ix_academic_periods_status", "academic_periods", ["status"], unique=False
    )

    op.create_table(
        "enrollments",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("student_id", uuid_type, nullable=False),
        sa.Column("period_id", uuid_type, nullable=False),
        sa.Column("cycle", sa.String(length=32), nullable=True),
        sa.Column("cohort", sa.String(length=32), nullable=True),
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default=sa.text("'ACTIVE'")
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'GRADUATED')",
            name="ck_enrollments_status",
        ),
        sa.ForeignKeyConstraint(["period_id"], ["academic_periods.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "period_id", name="uq_enrollment_student_period"),
    )
    op.create_index(
        "ix_enrollments_period_status", "enrollments", ["period_id", "status"], unique=False
    )
    op.create_index("ix_enrollments_student", "enrollments", ["student_id"], unique=False)

    op.create_table(
        "issuers",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("website_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_issuers_name"),
    )
    op.create_index("ix_issuers_name", "issuers", ["name"], unique=False)

    op.create_table(
        "skills",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_skills_name"),
    )
    op.create_index("ix_skills_category", "skills", ["category"], unique=False)

    op.create_table(
        "certifications",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("student_id", uuid_type, nullable=False),
        sa.Column("issuer_id", uuid_type, nullable=False),
        sa.Column("credential_name", sa.String(length=200), nullable=False),
        sa.Column("external_id", sa.String(length=200), nullable=True),
        sa.Column("issued_on", sa.Date(), nullable=False),
        sa.Column("expires_on", sa.Date(), nullable=True),
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default=sa.text("'PENDING'")
        ),
        sa.Column("source_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'OBSERVED', 'REJECTED', 'EXPIRED')",
            name="ck_certifications_status",
        ),
        sa.CheckConstraint(
            "expires_on IS NULL OR expires_on >= issued_on",
            name="ck_certification_dates",
        ),
        sa.ForeignKeyConstraint(["issuer_id"], ["issuers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "student_id",
            "issuer_id",
            "credential_name",
            "issued_on",
            name="uq_certification_identity",
        ),
        sa.UniqueConstraint(
            "issuer_id", "external_id", name="uq_certification_issuer_external_id"
        ),
    )
    op.create_index(
        "ix_certifications_student_status", "certifications", ["student_id", "status"], unique=False
    )
    op.create_index("ix_certifications_issuer", "certifications", ["issuer_id"], unique=False)

    op.create_table(
        "certification_skills",
        sa.Column("certification_id", uuid_type, nullable=False),
        sa.Column("skill_id", uuid_type, nullable=False),
        sa.Column("level", sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(
            ["certification_id"], ["certifications.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("certification_id", "skill_id"),
    )

    op.create_table(
        "evidences",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("certification_id", uuid_type, nullable=False),
        sa.Column("evidence_type", sa.String(length=20), nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=True),
        sa.Column("object_key", sa.String(length=512), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "source_url IS NOT NULL OR object_key IS NOT NULL",
            name="ck_evidence_locator",
        ),
        sa.CheckConstraint("evidence_type IN ('URL', 'FILE')", name="ck_evidence_type"),
        sa.ForeignKeyConstraint(
            ["certification_id"], ["certifications.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "certification_id", "sha256", name="uq_evidence_certification_hash"
        ),
    )
    op.create_index(
        "ix_evidences_certification", "evidences", ["certification_id"], unique=False
    )

    op.create_table(
        "validations",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("certification_id", uuid_type, nullable=False),
        sa.Column("validator_user_id", uuid_type, nullable=False),
        sa.Column("decision", sa.String(length=20), nullable=False),
        sa.Column("comment", sa.String(length=2000), nullable=True),
        sa.Column(
            "decided_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "decision IN ('APPROVED', 'OBSERVED', 'REJECTED')",
            name="ck_validations_decision",
        ),
        sa.ForeignKeyConstraint(
            ["certification_id"], ["certifications.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["validator_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_validations_certification", "validations", ["certification_id"], unique=False
    )
    op.create_index(
        "ix_validations_validator", "validations", ["validator_user_id"], unique=False
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("actor_user_id", uuid_type, nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=True),
        sa.Column("before_data", sa.JSON(), nullable=True),
        sa.Column("after_data", sa.JSON(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=150), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_audit_logs_idempotency_key"),
    )
    op.create_index(
        "ix_audit_logs_actor_created", "audit_logs", ["actor_user_id", "created_at"], unique=False
    )
    op.create_index(
        "ix_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"], unique=False
    )

    op.create_table(
        "fact_student_period",
        sa.Column("student_key", sa.String(length=64), nullable=False),
        sa.Column("period_id", uuid_type, nullable=False),
        sa.Column("cutoff_date", sa.Date(), nullable=False),
        sa.Column("cohort", sa.String(length=32), nullable=True),
        sa.Column("enrollment_status", sa.String(length=20), nullable=False),
        sa.Column("certification_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "approved_certification_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "loaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "certification_count >= 0 AND approved_certification_count >= 0",
            name="ck_fact_student_period_counts_nonnegative",
        ),
        sa.CheckConstraint(
            "approved_certification_count <= certification_count",
            name="ck_fact_student_period_counts_consistent",
        ),
        sa.ForeignKeyConstraint(["period_id"], ["academic_periods.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("student_key", "period_id", "cutoff_date"),
    )
    op.create_index(
        "ix_fact_student_period_period_cohort",
        "fact_student_period",
        ["period_id", "cohort"],
        unique=False,
    )

    op.create_table(
        "fact_certification",
        sa.Column("certification_id", uuid_type, nullable=False),
        sa.Column("skill_id", uuid_type, nullable=False),
        sa.Column("cutoff_date", sa.Date(), nullable=False),
        sa.Column("period_id", uuid_type, nullable=False),
        sa.Column("issuer_id", uuid_type, nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("level", sa.String(length=50), nullable=True),
        sa.Column("issued_on", sa.Date(), nullable=False),
        sa.Column(
            "loaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'OBSERVED', 'REJECTED', 'EXPIRED')",
            name="ck_fact_certification_status",
        ),
        sa.ForeignKeyConstraint(
            ["certification_id"], ["certifications.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["issuer_id"], ["issuers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["period_id"], ["academic_periods.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("certification_id", "skill_id", "cutoff_date"),
    )
    op.create_index(
        "ix_fact_certification_period_status",
        "fact_certification",
        ["period_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_fact_certification_issuer", "fact_certification", ["issuer_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_fact_certification_issuer", table_name="fact_certification")
    op.drop_index("ix_fact_certification_period_status", table_name="fact_certification")
    op.drop_table("fact_certification")

    op.drop_index("ix_fact_student_period_period_cohort", table_name="fact_student_period")
    op.drop_table("fact_student_period")

    op.drop_index("ix_audit_logs_entity", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_created", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_validations_validator", table_name="validations")
    op.drop_index("ix_validations_certification", table_name="validations")
    op.drop_table("validations")

    op.drop_index("ix_evidences_certification", table_name="evidences")
    op.drop_table("evidences")
    op.drop_table("certification_skills")

    op.drop_index("ix_certifications_issuer", table_name="certifications")
    op.drop_index("ix_certifications_student_status", table_name="certifications")
    op.drop_table("certifications")

    op.drop_index("ix_skills_category", table_name="skills")
    op.drop_table("skills")
    op.drop_index("ix_issuers_name", table_name="issuers")
    op.drop_table("issuers")

    op.drop_index("ix_enrollments_student", table_name="enrollments")
    op.drop_index("ix_enrollments_period_status", table_name="enrollments")
    op.drop_table("enrollments")

    op.drop_index("ix_academic_periods_status", table_name="academic_periods")
    op.drop_table("academic_periods")
    op.drop_index("ix_students_entry_year", table_name="students")
    op.drop_index("ix_students_status", table_name="students")
    op.drop_table("students")
    op.drop_index("ix_users_role_active", table_name="users")
    op.drop_table("users")
