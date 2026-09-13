"""Reproducible, idempotent ETL from operational certifications to BI facts."""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_, delete, select
from sqlalchemy.orm import Session, sessionmaker

from ..db.models import (
    AcademicPeriod,
    Certification,
    CertificationSkill,
    Enrollment,
    EtlRejection,
    EtlRun,
    FactCertification,
    FactStudentPeriod,
    Issuer,
    Skill,
    Student,
)
from ..validation.service import effective_status
from .catalogs import normalize_issuer_name, normalize_level, normalize_skill_name


logger = logging.getLogger(__name__)

ETL_STATUSES = frozenset(
    {
        "PENDING",
        "UNDER_REVIEW",
        "APPROVED",
        "OBSERVED",
        "RESUBMITTED",
        "REJECTED",
        "EXPIRED",
    }
)


class EtlError(RuntimeError):
    """Base error for expected ETL failures."""


class EtlPeriodNotFound(EtlError):
    """The requested academic period does not exist."""


class EtlInvalid(EtlError):
    """The period or cutoff cannot produce a reproducible snapshot."""


@dataclass(frozen=True, slots=True)
class EtlSourceRecord:
    """A source row extracted from operational tables, without personal data."""

    row_number: int
    certification_id: UUID
    student_id: UUID
    student_key: str
    enrollment_status: str | None
    cohort: str | None
    issuer_id: UUID
    issuer_name: str
    issuer_website_url: str | None
    credential_name: str
    issued_on: date
    expires_on: date | None
    status: str
    skill_id: UUID | None
    skill_name: str | None
    skill_category: str | None
    level: str | None


@dataclass(frozen=True, slots=True)
class EtlEnrollmentSnapshot:
    student_id: UUID
    student_key: str
    period_id: UUID
    cohort: str | None
    cycle: str | None
    status: str


@dataclass(frozen=True, slots=True)
class EtlExtraction:
    period: AcademicPeriod
    records: tuple[EtlSourceRecord, ...]
    enrollments: tuple[EtlEnrollmentSnapshot, ...]
    source_sha256: str


@dataclass(frozen=True, slots=True)
class EtlRejectionView:
    row_number: int
    record_key: str | None
    field_name: str
    reason_code: str
    message: str


@dataclass(frozen=True, slots=True)
class EtlStagedRecord:
    source: EtlSourceRecord
    issuer_name: str
    skill_name: str
    level: str
    status: str


@dataclass(frozen=True, slots=True)
class EtlStage:
    records: tuple[EtlStagedRecord, ...]
    rejections: tuple[EtlRejectionView, ...]
    duplicate_rows: int


@dataclass(frozen=True, slots=True)
class EtlReport:
    id: UUID
    period_code: str
    cutoff_date: date
    source_sha256: str
    status: str
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    duplicate_rows: int
    quality_report: dict[str, Any]
    rejections: tuple[EtlRejectionView, ...]
    idempotent: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "period_code": self.period_code,
            "cutoff_date": self.cutoff_date.isoformat(),
            "source_sha256": self.source_sha256,
            "status": self.status,
            "total_rows": self.total_rows,
            "accepted_rows": self.accepted_rows,
            "rejected_rows": self.rejected_rows,
            "duplicate_rows": self.duplicate_rows,
            "quality_report": self.quality_report,
            "rejections": [asdict(rejection) for rejection in self.rejections],
            "idempotent": self.idempotent,
        }


def stage_source_records(
    records: tuple[EtlSourceRecord, ...], cutoff_date: date
) -> EtlStage:
    """Validate and normalize all rows before allowing any publication."""

    staged: list[EtlStagedRecord] = []
    rejections: list[EtlRejectionView] = []
    seen_keys: dict[tuple[UUID, str], int] = {}
    duplicate_rows = 0

    for record in records:
        record_key = str(record.certification_id)
        errors: list[tuple[str, str, str]] = []

        if not record.student_key:
            errors.append(("student_key", "MISSING_STUDENT_KEY", "student_key es obligatorio"))
        elif "@" in record.student_key:
            errors.append(
                ("student_key", "EMAIL_AS_STUDENT_KEY", "student_key no puede contener un correo")
            )
        if not record.credential_name.strip():
            errors.append(
                ("credential_name", "MISSING_CREDENTIAL_NAME", "credential_name es obligatorio")
            )
        if not record.issuer_name.strip():
            errors.append(("issuer_name", "MISSING_ISSUER", "issuer_name es obligatorio"))
        if record.enrollment_status is None:
            errors.append(
                ("enrollment", "MISSING_ENROLLMENT", "el estudiante no está matriculado en el periodo")
            )
        if record.skill_id is None or not normalize_skill_name(record.skill_name):
            errors.append(("skill", "MISSING_SKILL", "la certificación debe tener una skill catalogada"))
        if record.status.strip().upper() not in ETL_STATUSES:
            errors.append(("status", "INVALID_STATUS", "status no pertenece al flujo de certificaciones"))
        if record.issued_on > cutoff_date:
            errors.append(("issued_on", "ISSUED_AFTER_CUTOFF", "issued_on supera el cutoff solicitado"))
        if record.expires_on is not None and record.expires_on < record.issued_on:
            errors.append(("expires_on", "INVALID_DATE_RANGE", "expires_on no puede preceder a issued_on"))

        issuer_name = normalize_issuer_name(record.issuer_name)
        skill_name = normalize_skill_name(record.skill_name)
        level = normalize_level(record.level, record.credential_name)
        status = effective_status(record.status.strip().upper(), record.expires_on, cutoff_date)
        duplicate_key = (record.certification_id, skill_name.casefold())
        if duplicate_key in seen_keys:
            duplicate_rows += 1
            errors.append(("skill", "DUPLICATE_SOURCE_ROW", "la certificación y skill aparecen más de una vez"))
        else:
            seen_keys[duplicate_key] = record.row_number

        for field_name, reason_code, message in errors:
            rejections.append(
                EtlRejectionView(
                    row_number=record.row_number,
                    record_key=record_key,
                    field_name=field_name,
                    reason_code=reason_code,
                    message=message,
                )
            )

        if not errors:
            staged.append(
                EtlStagedRecord(
                    source=record,
                    issuer_name=issuer_name,
                    skill_name=skill_name,
                    level=level,
                    status=status,
                )
            )

    return EtlStage(tuple(staged), tuple(rejections), duplicate_rows)


class EtlService:
    """Extract operational records and atomically publish analytical facts."""

    def __init__(self, session_factory: sessionmaker[Session]):
        self._session_factory = session_factory

    def extract(self, period_code: str, cutoff_date: date) -> EtlExtraction:
        with self._session_factory() as session:
            period = session.scalar(
                select(AcademicPeriod).where(AcademicPeriod.code == period_code.strip())
            )
            if period is None:
                raise EtlPeriodNotFound(f"No existe el periodo académico {period_code!r}")
            self._validate_cutoff(period, cutoff_date)

            enrollment_rows = session.execute(
                select(Enrollment, Student)
                .join(Student, Student.id == Enrollment.student_id)
                .where(Enrollment.period_id == period.id)
                .order_by(Student.student_key)
            ).all()
            enrollments = tuple(
                EtlEnrollmentSnapshot(
                    student_id=student.id,
                    student_key=student.student_key,
                    period_id=period.id,
                    cohort=enrollment.cohort,
                    cycle=enrollment.cycle,
                    status=enrollment.status,
                )
                for enrollment, student in enrollment_rows
            )

            rows = session.execute(
                select(Certification, Student, Issuer, Enrollment, CertificationSkill, Skill)
                .join(Student, Student.id == Certification.student_id)
                .join(Issuer, Issuer.id == Certification.issuer_id)
                .outerjoin(
                    Enrollment,
                    and_(
                        Enrollment.student_id == Student.id,
                        Enrollment.period_id == period.id,
                    ),
                )
                .outerjoin(
                    CertificationSkill,
                    CertificationSkill.certification_id == Certification.id,
                )
                .outerjoin(Skill, Skill.id == CertificationSkill.skill_id)
                .order_by(Certification.id, CertificationSkill.skill_id)
            ).all()

            records = tuple(
                EtlSourceRecord(
                    row_number=index,
                    certification_id=certification.id,
                    student_id=student.id,
                    student_key=student.student_key,
                    enrollment_status=enrollment.status if enrollment else None,
                    cohort=enrollment.cohort if enrollment else None,
                    issuer_id=issuer.id,
                    issuer_name=issuer.name,
                    issuer_website_url=issuer.website_url,
                    credential_name=certification.credential_name,
                    issued_on=certification.issued_on,
                    expires_on=certification.expires_on,
                    status=certification.status,
                    skill_id=certification_skill.skill_id if certification_skill else None,
                    skill_name=skill.name if skill else None,
                    skill_category=skill.category if skill else None,
                    level=certification_skill.level if certification_skill else None,
                )
                for index, (
                    certification,
                    student,
                    issuer,
                    enrollment,
                    certification_skill,
                    skill,
                ) in enumerate(rows, start=1)
            )

            source_payload = {
                "period_code": period.code,
                "cutoff_date": cutoff_date.isoformat(),
                "enrollments": [
                    {
                        "student_id": str(enrollment.student_id),
                        "student_key": enrollment.student_key,
                        "cohort": enrollment.cohort,
                        "cycle": enrollment.cycle,
                        "status": enrollment.status,
                    }
                    for enrollment in enrollments
                ],
                "records": [self._jsonable(record) for record in records],
            }
            source_sha256 = hashlib.sha256(
                json.dumps(source_payload, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode(
                    "utf-8"
                )
            ).hexdigest()
            return EtlExtraction(period, records, enrollments, source_sha256)

    def run(
        self,
        period_code: str,
        cutoff_date: date,
        actor_user_id: UUID | None = None,
    ) -> EtlReport:
        """Run the pipeline; a repeated identical source returns the same run."""

        extraction = self.extract(period_code, cutoff_date)
        stage = stage_source_records(extraction.records, cutoff_date)
        rejected_rows = len({rejection.row_number for rejection in stage.rejections})
        accepted_rows = 0 if stage.rejections else len(stage.records)
        quality_report = {
            "total_rows": len(extraction.records),
            "accepted_rows": accepted_rows,
            "rejected_rows": rejected_rows,
            "duplicate_rows": stage.duplicate_rows,
            "completeness_percent": round(
                (accepted_rows / len(extraction.records) * 100) if extraction.records else 100.0,
                2,
            ),
            "status_counts": self._status_counts(stage.records if not stage.rejections else ()),
            "source": "operational_database",
        }

        with self._session_factory.begin() as session:
            existing = session.scalar(
                select(EtlRun).where(
                    EtlRun.period_id == extraction.period.id,
                    EtlRun.cutoff_date == cutoff_date,
                    EtlRun.source_sha256 == extraction.source_sha256,
                )
            )
            if existing is not None:
                return self._report(session, existing, idempotent=True)

            run = EtlRun(
                period_id=extraction.period.id,
                actor_user_id=actor_user_id,
                cutoff_date=cutoff_date,
                source_sha256=extraction.source_sha256,
                status="REJECTED" if stage.rejections else "APPLIED",
                total_rows=len(extraction.records),
                accepted_rows=accepted_rows,
                rejected_rows=rejected_rows,
                duplicate_rows=stage.duplicate_rows,
                quality_report=quality_report,
                completed_at=datetime.now(timezone.utc),
            )
            session.add(run)
            session.flush()

            session.add_all(
                EtlRejection(
                    run_id=run.id,
                    row_number=rejection.row_number,
                    record_key=rejection.record_key,
                    field_name=rejection.field_name,
                    reason_code=rejection.reason_code,
                    message=rejection.message,
                )
                for rejection in stage.rejections
            )

            if not stage.rejections:
                self._publish(
                    session,
                    extraction.period,
                    cutoff_date,
                    extraction.enrollments,
                    stage.records,
                )

            session.flush()
            return self._report(session, run, idempotent=False)

    def history(self, period_code: str, cutoff_date: date | None = None) -> tuple[EtlReport, ...]:
        with self._session_factory() as session:
            period = session.scalar(select(AcademicPeriod).where(AcademicPeriod.code == period_code.strip()))
            if period is None:
                raise EtlPeriodNotFound(f"No existe el periodo académico {period_code!r}")
            statement = select(EtlRun).where(EtlRun.period_id == period.id).order_by(EtlRun.created_at.desc())
            if cutoff_date is not None:
                statement = statement.where(EtlRun.cutoff_date == cutoff_date)
            return tuple(self._report(session, run, idempotent=False) for run in session.scalars(statement).all())

    @staticmethod
    def _validate_cutoff(period: AcademicPeriod, cutoff_date: date) -> None:
        if cutoff_date < period.starts_on or cutoff_date > period.ends_on:
            raise EtlInvalid(
                f"cutoff_date debe estar dentro del periodo {period.code} ({period.starts_on} - {period.ends_on})"
            )

    @staticmethod
    def _jsonable(record: EtlSourceRecord) -> dict[str, Any]:
        payload = asdict(record)
        return {key: (str(value) if isinstance(value, UUID) else value.isoformat() if isinstance(value, date) else value) for key, value in payload.items()}

    @staticmethod
    def _status_counts(records: tuple[EtlStagedRecord, ...]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for record in records:
            counts[record.status] = counts.get(record.status, 0) + 1
        return dict(sorted(counts.items()))

    @staticmethod
    def _report(session: Session, run: EtlRun, *, idempotent: bool) -> EtlReport:
        rejections = tuple(
            EtlRejectionView(
                row_number=rejection.row_number,
                record_key=rejection.record_key,
                field_name=rejection.field_name,
                reason_code=rejection.reason_code,
                message=rejection.message,
            )
            for rejection in session.scalars(
                select(EtlRejection)
                .where(EtlRejection.run_id == run.id)
                .order_by(EtlRejection.row_number, EtlRejection.id)
            ).all()
        )
        return EtlReport(
            id=run.id,
            period_code=session.scalar(select(AcademicPeriod.code).where(AcademicPeriod.id == run.period_id)),
            cutoff_date=run.cutoff_date,
            source_sha256=run.source_sha256,
            status=run.status,
            total_rows=run.total_rows,
            accepted_rows=run.accepted_rows,
            rejected_rows=run.rejected_rows,
            duplicate_rows=run.duplicate_rows,
            quality_report=run.quality_report or {},
            rejections=rejections,
            idempotent=idempotent,
        )

    @staticmethod
    def _publish(
        session: Session,
        period: AcademicPeriod,
        cutoff_date: date,
        enrollments: tuple[EtlEnrollmentSnapshot, ...],
        records: tuple[EtlStagedRecord, ...],
    ) -> None:
        """Replace one snapshot inside the same transaction as its ETL run."""

        session.execute(
            delete(FactCertification).where(
                FactCertification.period_id == period.id,
                FactCertification.cutoff_date == cutoff_date,
            )
        )
        session.execute(
            delete(FactStudentPeriod).where(
                FactStudentPeriod.period_id == period.id,
                FactStudentPeriod.cutoff_date == cutoff_date,
            )
        )

        issuer_cache: dict[str, Issuer] = {}
        skill_cache: dict[str, Skill] = {}
        certification_ids_by_student: dict[UUID, set[UUID]] = {}
        approved_ids_by_student: dict[UUID, set[UUID]] = {}

        for record in records:
            issuer = issuer_cache.get(record.issuer_name)
            if issuer is None:
                issuer = session.scalar(select(Issuer).where(Issuer.name == record.issuer_name))
                if issuer is None:
                    issuer = Issuer(
                        name=record.issuer_name,
                        website_url=record.source.issuer_website_url,
                    )
                    session.add(issuer)
                    session.flush()
                issuer_cache[record.issuer_name] = issuer

            skill = skill_cache.get(record.skill_name)
            if skill is None:
                skill = session.scalar(select(Skill).where(Skill.name == record.skill_name))
                if skill is None:
                    skill = Skill(
                        name=record.skill_name,
                        category=record.source.skill_category,
                    )
                    session.add(skill)
                    session.flush()
                skill_cache[record.skill_name] = skill

            session.add(
                FactCertification(
                    certification_id=record.source.certification_id,
                    skill_id=skill.id,
                    cutoff_date=cutoff_date,
                    period_id=period.id,
                    issuer_id=issuer.id,
                    status=record.status,
                    level=record.level,
                    issued_on=record.source.issued_on,
                    expires_on=record.source.expires_on,
                )
            )
            certification_ids_by_student.setdefault(record.source.student_id, set()).add(
                record.source.certification_id
            )
            if record.status == "APPROVED":
                approved_ids_by_student.setdefault(record.source.student_id, set()).add(
                    record.source.certification_id
                )

        for enrollment in enrollments:
            session.add(
                FactStudentPeriod(
                    student_key=enrollment.student_key,
                    period_id=period.id,
                    cutoff_date=cutoff_date,
                    cohort=enrollment.cohort,
                    cycle=enrollment.cycle,
                    enrollment_status=enrollment.status,
                    certification_count=len(certification_ids_by_student.get(enrollment.student_id, set())),
                    approved_certification_count=len(approved_ids_by_student.get(enrollment.student_id, set())),
                )
            )
