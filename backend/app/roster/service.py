"""Transactional persistence and reconciliation for padrón CSV imports."""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID, uuid4

from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import Settings
from ..db.models import (
    AcademicPeriod,
    Enrollment,
    RosterImport,
    RosterImportRejection,
    Student,
    User,
)
from .parser import ParsedRoster, RosterRecord, RosterRejection, normalize_text, parse_roster_csv


logger = logging.getLogger(__name__)
_ENTRY_YEAR_PATTERN = re.compile(r"20\d{2}")


class RosterPeriodNotFound(RuntimeError):
    """The requested academic period has not been provisioned."""


class RosterServiceUnavailable(RuntimeError):
    """The database needed for a padrón operation is unavailable."""


class RosterImportServiceProtocol(Protocol):
    def import_csv(
        self,
        content: bytes,
        *,
        period_code: str,
        actor_user_id: UUID | None,
    ) -> "ImportReport":
        """Import a period-scoped CSV and return a non-sensitive report."""

    def list_history(self, *, period_code: str) -> list["ImportHistory"]:
        """Return import history without raw source data."""


@dataclass(frozen=True, slots=True)
class ImportReport:
    id: UUID
    period_code: str
    status: str
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    rejections: tuple[RosterRejection, ...]
    idempotent: bool


@dataclass(frozen=True, slots=True)
class ImportHistory:
    id: UUID
    period_code: str
    status: str
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    created_at: datetime
    completed_at: datetime | None


def pseudonymize_student_code(code: str, secret: str | SecretStr) -> str:
    """Create a stable, non-reversible student key from an authorized code."""

    secret_value = secret.get_secret_value() if isinstance(secret, SecretStr) else secret
    digest = hmac.new(
        secret_value.encode("utf-8"),
        code.strip().casefold().encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    # Keep the key under the existing 64-character database column limit.
    return f"stu_{digest[:56]}"


def _entry_year(code: str) -> int | None:
    match = _ENTRY_YEAR_PATTERN.search(code)
    return int(match.group(0)) if match else None


def _db_rejection(
    record: RosterRecord,
    field_name: str,
    reason_code: str,
    message: str,
) -> RosterRejection:
    return RosterRejection(record.row_number, field_name, reason_code, message)


class RosterImportService:
    """Apply a validated padrón batch atomically to the operational schema."""

    def __init__(self, session_factory: sessionmaker[Session], settings: Settings) -> None:
        self._session_factory = session_factory
        self._settings = settings

    def _period(self, session: Session, period_code: str) -> AcademicPeriod | None:
        normalized = normalize_text(period_code).casefold()
        return session.scalar(
            select(AcademicPeriod).where(func.lower(AcademicPeriod.code) == normalized)
        )

    def _existing_import(
        self,
        session: Session,
        period_id: UUID,
        source_sha256: str,
    ) -> RosterImport | None:
        return session.scalar(
            select(RosterImport).where(
                RosterImport.period_id == period_id,
                RosterImport.source_sha256 == source_sha256,
            )
        )

    def _report_from_record(
        self,
        session: Session,
        record: RosterImport,
        period_code: str,
        *,
        idempotent: bool,
    ) -> ImportReport:
        rejections = tuple(
            RosterRejection(
                row_number=rejection.row_number,
                field_name=rejection.field_name,
                reason_code=rejection.reason_code,
                message=rejection.message,
            )
            for rejection in session.scalars(
                select(RosterImportRejection)
                .where(RosterImportRejection.import_id == record.id)
                .order_by(
                    RosterImportRejection.row_number,
                    RosterImportRejection.field_name,
                    RosterImportRejection.reason_code,
                )
            ).all()
        )
        return ImportReport(
            id=record.id,
            period_code=period_code,
            status=record.status,
            total_rows=record.total_rows,
            accepted_rows=record.accepted_rows,
            rejected_rows=record.rejected_rows,
            rejections=rejections,
            idempotent=idempotent,
        )

    def _reconciliation_rejections(
        self,
        session: Session,
        records: tuple[RosterRecord, ...],
    ) -> tuple[RosterRejection, ...]:
        rejections: list[RosterRejection] = []
        for record in records:
            student_key = pseudonymize_student_code(
                record.code,
                self._settings.roster_pseudonym_secret,
            )
            student = session.scalar(
                select(Student).where(Student.student_key == student_key)
            )
            user = session.scalar(
                select(User).where(func.lower(User.email) == record.email)
            )

            if student is not None and student.user_id is not None:
                linked_user = session.get(User, student.user_id)
                if linked_user is not None and linked_user.email.casefold() != record.email:
                    rejections.append(
                        _db_rejection(
                            record,
                            "email",
                            "IDENTITY_CONFLICT",
                            "Student code is already linked to another email.",
                        )
                    )
                if user is not None and user.id != student.user_id:
                    rejections.append(
                        _db_rejection(
                            record,
                            "email",
                            "EMAIL_ALREADY_LINKED",
                            "Email is already linked to another student.",
                        )
                    )
            elif user is not None:
                linked_student = session.scalar(
                    select(Student).where(Student.user_id == user.id)
                )
                if linked_student is not None:
                    rejections.append(
                        _db_rejection(
                            record,
                            "code",
                            "EMAIL_ALREADY_LINKED",
                            "Email is already linked to another student.",
                        )
                    )

            if user is not None and user.role != "STUDENT":
                rejections.append(
                    _db_rejection(
                        record,
                        "email",
                        "ACCOUNT_ROLE_CONFLICT",
                        "Email belongs to a non-student account.",
                    )
                )
        return tuple(rejections)

    def _apply_record(
        self,
        session: Session,
        record: RosterRecord,
        period_id: UUID,
    ) -> None:
        student_key = pseudonymize_student_code(
            record.code,
            self._settings.roster_pseudonym_secret,
        )
        student = session.scalar(select(Student).where(Student.student_key == student_key))
        user = session.scalar(select(User).where(func.lower(User.email) == record.email))

        if student is None:
            if user is None:
                user = User(id=uuid4(), email=record.email, role="STUDENT")
                session.add(user)
                session.flush()
            student = Student(
                id=uuid4(),
                user_id=user.id,
                student_key=student_key,
                entry_year=_entry_year(record.code),
                status=record.status,
            )
            session.add(student)
        else:
            if student.user_id is None:
                if user is None:
                    user = User(id=uuid4(), email=record.email, role="STUDENT")
                    session.add(user)
                    session.flush()
                student.user_id = user.id
            student.status = record.status
            student.entry_year = student.entry_year or _entry_year(record.code)

        session.flush()
        enrollment = session.scalar(
            select(Enrollment).where(
                Enrollment.student_id == student.id,
                Enrollment.period_id == period_id,
            )
        )
        if enrollment is None:
            enrollment = Enrollment(
                id=uuid4(),
                student_id=student.id,
                period_id=period_id,
                cycle=record.cycle,
                cohort=str(student.entry_year) if student.entry_year else None,
                school=record.school,
                study_plan=record.plan,
                status=record.status,
            )
            session.add(enrollment)
        else:
            enrollment.cycle = record.cycle
            enrollment.cohort = str(student.entry_year) if student.entry_year else None
            enrollment.school = record.school
            enrollment.study_plan = record.plan
            enrollment.status = record.status

    def import_csv(
        self,
        content: bytes,
        *,
        period_code: str,
        actor_user_id: UUID | None,
    ) -> ImportReport:
        normalized_period_code = normalize_text(period_code)
        source_sha256 = hashlib.sha256(content).hexdigest()

        with self._session_factory() as session:
            period = self._period(session, normalized_period_code)
            if period is None:
                raise RosterPeriodNotFound("Academic period is not provisioned")
            existing = self._existing_import(session, period.id, source_sha256)
            if existing is not None:
                return self._report_from_record(
                    session,
                    existing,
                    period.code,
                    idempotent=True,
                )

        parsed: ParsedRoster = parse_roster_csv(
            content,
            period_code=normalized_period_code,
            settings=self._settings,
        )

        session = self._session_factory()
        try:
            with session.begin():
                period = self._period(session, normalized_period_code)
                if period is None:
                    raise RosterPeriodNotFound("Academic period is not provisioned")
                existing = self._existing_import(session, period.id, source_sha256)
                if existing is not None:
                    return self._report_from_record(
                        session,
                        existing,
                        period.code,
                        idempotent=True,
                    )

                reconciliation_rejections = self._reconciliation_rejections(
                    session,
                    parsed.records,
                )
                all_rejections = parsed.rejections + reconciliation_rejections
                accepted_rows = len(parsed.records) if not all_rejections else 0
                rejected_row_numbers = {
                    rejection.row_number
                    for rejection in all_rejections
                    if rejection.row_number > 0
                }
                import_record = RosterImport(
                    id=uuid4(),
                    period_id=period.id,
                    actor_user_id=actor_user_id,
                    source_sha256=source_sha256,
                    status="REJECTED" if all_rejections else "APPLIED",
                    total_rows=parsed.total_rows,
                    accepted_rows=accepted_rows,
                    rejected_rows=len(rejected_row_numbers),
                    completed_at=datetime.now(timezone.utc),
                )
                session.add(import_record)
                session.flush()
                session.add_all(
                    [
                        RosterImportRejection(
                            id=uuid4(),
                            import_id=import_record.id,
                            row_number=rejection.row_number,
                            field_name=rejection.field_name,
                            reason_code=rejection.reason_code,
                            message=rejection.message,
                        )
                        for rejection in all_rejections
                    ]
                )
                if not all_rejections:
                    for record in parsed.records:
                        self._apply_record(session, record, period.id)
                session.flush()
                logger.info(
                    "Roster import completed import_id=%s period_id=%s status=%s total_rows=%s accepted_rows=%s rejected_rows=%s source_sha256=%s",
                    import_record.id,
                    period.id,
                    import_record.status,
                    import_record.total_rows,
                    import_record.accepted_rows,
                    import_record.rejected_rows,
                    source_sha256,
                )
                return self._report_from_record(
                    session,
                    import_record,
                    period.code,
                    idempotent=False,
                )
        except RosterPeriodNotFound:
            raise
        except Exception as exc:
            # Do not log `exc`: database errors may echo bound email/code values.
            logger.error("Roster import failed and transaction was rolled back")
            raise RosterServiceUnavailable("Roster import could not be completed") from exc
        finally:
            session.close()

    def list_history(self, *, period_code: str) -> list[ImportHistory]:
        with self._session_factory() as session:
            period = self._period(session, period_code)
            if period is None:
                raise RosterPeriodNotFound("Academic period is not provisioned")
            records = session.scalars(
                select(RosterImport)
                .where(RosterImport.period_id == period.id)
                .order_by(RosterImport.created_at.desc())
            ).all()
            return [
                ImportHistory(
                    id=record.id,
                    period_code=period.code,
                    status=record.status,
                    total_rows=record.total_rows,
                    accepted_rows=record.accepted_rows,
                    rejected_rows=record.rejected_rows,
                    created_at=record.created_at,
                    completed_at=record.completed_at,
                )
                for record in records
            ]


class UnavailableRosterImportService:
    """Explicit failure mode when `PULSE_DATABASE_URL` is absent."""

    def _raise(self) -> None:
        raise RosterServiceUnavailable("PULSE_DATABASE_URL is not configured")

    def import_csv(
        self,
        content: bytes,
        *,
        period_code: str,
        actor_user_id: UUID | None,
    ) -> ImportReport:
        self._raise()
        raise AssertionError("unreachable")

    def list_history(self, *, period_code: str) -> list[ImportHistory]:
        self._raise()
        return []


__all__ = [
    "ImportHistory",
    "ImportReport",
    "RosterImportService",
    "RosterImportServiceProtocol",
    "RosterPeriodNotFound",
    "RosterServiceUnavailable",
    "UnavailableRosterImportService",
    "pseudonymize_student_code",
]
