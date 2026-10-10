"""Idempotent synthetic roster and certification seed for the pilot environment.

The seed is opt-in through ``PULSE_DEMO_DATA_SEED=true``. It uses students
already present in the authorized roster, adds only a couple of clearly marked
fallback demo students when a cohort is missing, and publishes period facts
through the same ETL used by the production dashboard.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from .demo_catalog import DEMO_CERTIFICATION_CATALOG, DemoCertificationSpec
from .db.models import (
    AcademicPeriod,
    Certification,
    CertificationSkill,
    CertificationStatusHistory,
    Enrollment,
    Issuer,
    Skill,
    Student,
    User,
)
from .etl.service import EtlService
from .roster.service import pseudonymize_student_code
from .core.config import Settings


logger = logging.getLogger(__name__)

_SEED_VERSION = "v1"
_SEED_AS_OF = date(2026, 10, 10)
_FOCUS_STUDENTS = (
    ("kz2023077087", "kz2023077087@virtual.upt.pe"),
    ("vl2023076796", "vl2023076796@virtual.upt.pe"),
)
_DEMO_PERIODS_PATH = Path(__file__).resolve().parents[1] / "data" / "academic-periods-upt.json"
_CYCLE_NAMES = ("I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X")


@dataclass(frozen=True, slots=True)
class DemoSeedReport:
    """Small operational summary suitable for startup logs."""

    periods: int
    students: int
    enrollments: int
    certifications: int
    snapshots: int


def _entry_year(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"20\d{2}", value)
    return int(match.group(0)) if match else None


def _slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return normalized or "credential"


def _period_specs() -> list[dict[str, str]]:
    return json.loads(_DEMO_PERIODS_PATH.read_text(encoding="utf-8"))


def _get_or_create_issuer(session: Session, spec: DemoCertificationSpec) -> Issuer:
    issuer = session.scalar(select(Issuer).where(Issuer.name == spec.issuer_name))
    if issuer is None:
        issuer = Issuer(name=spec.issuer_name, website_url=spec.website_url)
        session.add(issuer)
        session.flush()
    elif not issuer.website_url:
        issuer.website_url = spec.website_url
    return issuer


def _get_or_create_skill(session: Session, name: str) -> Skill:
    skill = session.scalar(select(Skill).where(Skill.name == name))
    if skill is None:
        skill = Skill(name=name, category="Certificaciones tecnológicas")
        session.add(skill)
        session.flush()
    return skill


def _find_student(session: Session, code: str, email: str) -> Student | None:
    student = session.scalar(
        select(Student).where(func.lower(Student.student_code) == code.casefold())
    )
    if student is not None:
        return student
    user = session.scalar(select(User).where(func.lower(User.email) == email.casefold()))
    return session.scalar(select(Student).where(Student.user_id == user.id)) if user else None


def _ensure_focus_student(session: Session, settings: Settings, code: str, email: str) -> tuple[Student, bool]:
    user = session.scalar(select(User).where(func.lower(User.email) == email.casefold()))
    student = _find_student(session, code, email)
    created = False

    if user is None:
        user = User(id=uuid4(), email=email, role="STUDENT", is_active=True)
        session.add(user)
        session.flush()

    if student is None:
        student = Student(
            id=uuid4(),
            user_id=user.id,
            student_key=pseudonymize_student_code(code, settings.roster_pseudonym_secret),
            student_code=code,
            entry_year=_entry_year(code),
            status="ACTIVE",
        )
        session.add(student)
        session.flush()
        created = True
    else:
        if student.student_code is None:
            student.student_code = code
        if student.user_id is None and user.id is not None:
            student.user_id = user.id
        student.entry_year = student.entry_year or _entry_year(code)
        student.status = "ACTIVE"
    return student, created


def _ensure_fallback_cohorts(session: Session) -> tuple[list[Student], int]:
    """Add non-login demo rows only when the roster lacks 2020 or 2026 cohorts."""

    students = list(session.scalars(select(Student).order_by(Student.student_code, Student.id)))
    created = 0
    for year in (2020, 2026):
        if any(student.entry_year == year for student in students):
            continue
        for ordinal in range(1, 3):
            code = f"demo-{year}-{ordinal:03d}"
            student = Student(
                id=uuid4(),
                student_key=f"demo-student-{year}-{ordinal:03d}",
                student_code=code,
                entry_year=year,
                status="ACTIVE",
            )
            session.add(student)
            students.append(student)
            created += 1
    if created:
        session.flush()
    return students, created


def _ensure_enrollment(
    session: Session,
    student: Student,
    period: AcademicPeriod,
    position: int,
) -> bool:
    if student.entry_year is not None and student.entry_year > period.starts_on.year:
        return False
    enrollment = session.scalar(
        select(Enrollment).where(
            Enrollment.student_id == student.id,
            Enrollment.period_id == period.id,
        )
    )
    if enrollment is not None:
        return False
    term_offset = 0 if period.code.endswith("-I") else 1
    cycles_since_entry = 1
    if student.entry_year is not None:
        cycles_since_entry = max(
            1,
            (period.starts_on.year - student.entry_year) * 2 + term_offset + 1,
        )
    session.add(
        Enrollment(
            id=uuid4(),
            student_id=student.id,
            period_id=period.id,
            cycle=_CYCLE_NAMES[min(cycles_since_entry - 1, len(_CYCLE_NAMES) - 1)],
            cohort=str(student.entry_year) if student.entry_year is not None else None,
            school="EPIS",
            study_plan="Datos sintéticos de demostración",
            status="ACTIVE",
        )
    )
    return True


def _ensure_certification(
    session: Session,
    student: Student,
    position: int,
    spec_index: int,
    issuer: Issuer,
    skills: dict[str, Skill],
) -> bool:
    code = student.student_code or student.student_key
    external_id = f"DEMO-{_SEED_VERSION}-{_slug(code)}-{_slug(issuer.name)}"
    existing = session.scalar(
        select(Certification).where(
            Certification.issuer_id == issuer.id,
            Certification.external_id == external_id,
        )
    )
    if existing is not None:
        for skill_name, level in DEMO_CERTIFICATION_CATALOG[spec_index].skills:
            skill = skills[skill_name]
            if session.scalar(
                select(CertificationSkill).where(
                    CertificationSkill.certification_id == existing.id,
                    CertificationSkill.skill_id == skill.id,
                )
            ) is None:
                session.add(
                    CertificationSkill(
                        certification_id=existing.id,
                        skill_id=skill.id,
                        level=level,
                    )
                )
        return False

    entry_year = student.entry_year or 2023
    is_focus_student = (student.student_code or "").casefold() in {
        code for code, _ in _FOCUS_STUDENTS
    }
    issue_year = (
        2025 + ((position + spec_index) % 2)
        if is_focus_student
        else min(2026, max(2020, entry_year + ((position + spec_index) % 3)))
    )
    max_month = 9 if issue_year == 2026 else 12
    month = 1 + ((position * 3 + spec_index * 2) % max_month)
    issued_on = date(issue_year, month, 10 + ((position + spec_index) % 15))
    expires_on = date(issue_year + 3, month, issued_on.day)
    certification = Certification(
        id=uuid4(),
        student_id=student.id,
        issuer_id=issuer.id,
        credential_name=DEMO_CERTIFICATION_CATALOG[spec_index].credential_name,
        external_id=external_id,
        issued_on=issued_on,
        expires_on=expires_on,
        status="APPROVED",
        source_url=None,
    )
    session.add(certification)
    session.flush()
    for skill_name, level in DEMO_CERTIFICATION_CATALOG[spec_index].skills:
        session.add(
            CertificationSkill(
                certification_id=certification.id,
                skill_id=skills[skill_name].id,
                level=level,
            )
        )
    session.add(
        CertificationStatusHistory(
            id=uuid4(),
            certification_id=certification.id,
            actor_user_id=None,
            from_status=None,
            to_status="APPROVED",
            comment="Registro sintético de demostración; reemplazar con evidencia institucional verificada.",
            cutoff_date=None,
        )
    )
    return True


def _selected_spec_indexes(student: Student, position: int) -> Iterable[int]:
    code = (student.student_code or "").casefold()
    if code in {code for code, _ in _FOCUS_STUDENTS}:
        return range(len(DEMO_CERTIFICATION_CATALOG))
    selected = {position % len(DEMO_CERTIFICATION_CATALOG)}
    if position % 3 == 0:
        selected.add((position + 2) % len(DEMO_CERTIFICATION_CATALOG))
    return sorted(selected)


def seed_demo_data(
    session_factory: sessionmaker[Session],
    settings: Settings,
) -> DemoSeedReport:
    """Create demo records and publish one snapshot for every 2020–2026 period."""

    period_count = 0
    student_count = 0
    enrollment_count = 0
    certification_count = 0
    with session_factory.begin() as session:
        periods: list[AcademicPeriod] = []
        for spec in _period_specs():
            period = session.scalar(
                select(AcademicPeriod).where(AcademicPeriod.code == spec["code"])
            )
            if period is None:
                period = AcademicPeriod(
                    id=uuid4(),
                    code=spec["code"],
                    name=spec["code"],
                    starts_on=date.fromisoformat(spec["starts_on"]),
                    ends_on=date.fromisoformat(spec["ends_on"]),
                    status="CLOSED" if spec["code"] != "2026-II" else "OPEN",
                )
                session.add(period)
                session.flush()
                period_count += 1
            periods.append(period)

        for code, email in _FOCUS_STUDENTS:
            _, created = _ensure_focus_student(session, settings, code, email)
            student_count += int(created)
        students, fallback_created = _ensure_fallback_cohorts(session)
        student_count += fallback_created
        students = sorted(students, key=lambda item: (item.student_code or item.student_key, str(item.id)))

        issuers = {
            spec.issuer_name: _get_or_create_issuer(session, spec)
            for spec in DEMO_CERTIFICATION_CATALOG
        }
        skills = {
            skill_name: _get_or_create_skill(session, skill_name)
            for spec in DEMO_CERTIFICATION_CATALOG
            for skill_name, _ in spec.skills
        }

        for position, student in enumerate(students):
            for period in periods:
                enrollment_count += int(_ensure_enrollment(session, student, period, position))
            for spec_index in _selected_spec_indexes(student, position):
                spec = DEMO_CERTIFICATION_CATALOG[spec_index]
                certification_count += int(
                    _ensure_certification(
                        session,
                        student,
                        position,
                        spec_index,
                        issuers[spec.issuer_name],
                        skills,
                    )
                )

    snapshot_count = 0
    etl = EtlService(session_factory)
    for spec in _period_specs():
        period_end = date.fromisoformat(spec["ends_on"])
        cutoff = min(period_end, _SEED_AS_OF)
        report = etl.run(spec["code"], cutoff)
        if report.status != "APPLIED":
            logger.warning(
                "Synthetic demo seed left operational snapshot unpublished period=%s status=%s rejected_rows=%s; review ETL quality report",
                spec["code"],
                report.status,
                report.rejected_rows,
            )
            continue
        snapshot_count += 1

    logger.info(
        "Synthetic demo data seed completed periods=%s new_students=%s new_enrollments=%s new_certifications=%s snapshots=%s",
        len(_period_specs()),
        student_count,
        enrollment_count,
        certification_count,
        snapshot_count,
    )
    return DemoSeedReport(
        periods=len(_period_specs()),
        students=student_count,
        enrollments=enrollment_count,
        certifications=certification_count,
        snapshots=snapshot_count,
    )


__all__ = ["DemoSeedReport", "seed_demo_data"]
