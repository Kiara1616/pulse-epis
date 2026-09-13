"""Operational and analytical database models for Pulse EPIS."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from .base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('ADMIN', 'VALIDATOR', 'STUDENT')",
            name="ck_users_role",
        ),
        Index("ix_users_role_active", "role", "is_active"),
        Index("ix_users_google_subject", "google_subject", unique=True),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    google_subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="STUDENT")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'GRADUATED', 'UNKNOWN')",
            name="ck_students_status",
        ),
        Index("ix_students_status", "status"),
        Index("ix_students_entry_year", "entry_year"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    student_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    entry_year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AcademicPeriod(Base):
    __tablename__ = "academic_periods"
    __table_args__ = (
        CheckConstraint("ends_on >= starts_on", name="ck_period_dates"),
        CheckConstraint(
            "status IN ('OPEN', 'CLOSED')",
            name="ck_periods_status",
        ),
        Index("ix_academic_periods_status", "status"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OPEN")


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "period_id", name="uq_enrollment_student_period"),
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'GRADUATED')",
            name="ck_enrollments_status",
        ),
        Index("ix_enrollments_period_status", "period_id", "status"),
        Index("ix_enrollments_student", "student_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    student_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    period_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("academic_periods.id", ondelete="RESTRICT"), nullable=False
    )
    cycle: Mapped[str | None] = mapped_column(String(32), nullable=True)
    cohort: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")


class Issuer(Base):
    __tablename__ = "issuers"
    __table_args__ = (Index("ix_issuers_name", "name"),)

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    website_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Skill(Base):
    __tablename__ = "skills"
    __table_args__ = (Index("ix_skills_category", "category"),)

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Certification(Base):
    __tablename__ = "certifications"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "issuer_id",
            "credential_name",
            "issued_on",
            name="uq_certification_identity",
        ),
        UniqueConstraint(
            "issuer_id",
            "external_id",
            name="uq_certification_issuer_external_id",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'OBSERVED', 'REJECTED', 'EXPIRED')",
            name="ck_certifications_status",
        ),
        CheckConstraint(
            "expires_on IS NULL OR expires_on >= issued_on",
            name="ck_certification_dates",
        ),
        Index("ix_certifications_student_status", "student_id", "status"),
        Index("ix_certifications_issuer", "issuer_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    student_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    issuer_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("issuers.id", ondelete="RESTRICT"), nullable=False
    )
    credential_name: Mapped[str] = mapped_column(String(200), nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issued_on: Mapped[date] = mapped_column(Date, nullable=False)
    expires_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class CertificationSkill(Base):
    __tablename__ = "certification_skills"

    certification_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("certifications.id", ondelete="CASCADE"),
        primary_key=True,
    )
    skill_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("skills.id", ondelete="RESTRICT"), primary_key=True
    )
    level: Mapped[str | None] = mapped_column(String(50), nullable=True)


class Evidence(Base):
    __tablename__ = "evidences"
    __table_args__ = (
        UniqueConstraint(
            "certification_id", "sha256", name="uq_evidence_certification_hash"
        ),
        CheckConstraint(
            "source_url IS NOT NULL OR object_key IS NOT NULL",
            name="ck_evidence_locator",
        ),
        CheckConstraint(
            "evidence_type IN ('URL', 'FILE')",
            name="ck_evidence_type",
        ),
        Index("ix_evidences_certification", "certification_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    certification_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("certifications.id", ondelete="CASCADE"), nullable=False
    )
    evidence_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    object_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Validation(Base):
    __tablename__ = "validations"
    __table_args__ = (
        CheckConstraint(
            "decision IN ('APPROVED', 'OBSERVED', 'REJECTED')",
            name="ck_validations_decision",
        ),
        Index("ix_validations_certification", "certification_id"),
        Index("ix_validations_validator", "validator_user_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    certification_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("certifications.id", ondelete="CASCADE"), nullable=False
    )
    validator_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    comment: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_actor_created", "actor_user_id", "created_at"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    actor_user_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    before_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    after_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(150), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class FactStudentPeriod(Base):
    __tablename__ = "fact_student_period"
    __table_args__ = (
        CheckConstraint(
            "certification_count >= 0 AND approved_certification_count >= 0",
            name="ck_fact_student_period_counts_nonnegative",
        ),
        CheckConstraint(
            "approved_certification_count <= certification_count",
            name="ck_fact_student_period_counts_consistent",
        ),
        Index("ix_fact_student_period_period_cohort", "period_id", "cohort"),
    )

    student_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    period_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("academic_periods.id", ondelete="RESTRICT"), primary_key=True
    )
    cutoff_date: Mapped[date] = mapped_column(Date, primary_key=True)
    cohort: Mapped[str | None] = mapped_column(String(32), nullable=True)
    enrollment_status: Mapped[str] = mapped_column(String(20), nullable=False)
    certification_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    approved_certification_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    loaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class FactCertification(Base):
    __tablename__ = "fact_certification"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'OBSERVED', 'REJECTED', 'EXPIRED')",
            name="ck_fact_certification_status",
        ),
        Index("ix_fact_certification_period_status", "period_id", "status"),
        Index("ix_fact_certification_issuer", "issuer_id"),
    )

    certification_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("certifications.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    skill_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("skills.id", ondelete="RESTRICT"), primary_key=True
    )
    cutoff_date: Mapped[date] = mapped_column(Date, primary_key=True)
    period_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("academic_periods.id", ondelete="RESTRICT"), nullable=False
    )
    issuer_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("issuers.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issued_on: Mapped[date] = mapped_column(Date, nullable=False)
    loaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
