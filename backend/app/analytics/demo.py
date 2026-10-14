"""Reference indicators and records kept in an isolated, read-only database."""

from __future__ import annotations

import json
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ..db.base import Base
from ..db.models import (
    AcademicPeriod,
    Certification,
    FactCertification,
    FactStudentPeriod,
    Issuer,
    Skill,
    Student,
)
from ..demo_catalog import DEMO_CERTIFICATION_CATALOG
from .service import AnalyticsService


REFERENCE_STUDENT_ACCOUNTS = {
    "kz2023077087@virtual.upt.pe": "KZ2023077087",
    "vl2023076796@virtual.upt.pe": "VL2023076796",
}

REFERENCE_ENROLLMENT_TOTALS = {
    "2020-I": 224,
    "2020-II": 215,
    "2021-I": 258,
    "2021-II": 249,
    "2022-I": 268,
    "2022-II": 253,
    "2023-I": 266,
    "2023-II": 276,
    "2024-I": 309,
    "2024-II": 331,
    "2025-I": 340,
    "2025-II": 342,
    "2026-I": 350,
    "2026-II": 360,
}

_PERIOD_SPECS = json.loads(
    (Path(__file__).resolve().parents[2] / "data/academic-periods-upt.json").read_text(
        encoding="utf-8"
    )
)
_SESSION_FACTORY = None
_REFERENCE_CODES = frozenset(REFERENCE_STUDENT_ACCOUNTS.values())
_CYCLES = ("I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X")


def reference_enrollment_history() -> list[dict[str, int | str]]:
    """Return every academic period with its historical or reference basis."""

    return [
        {
            "period_code": period_code,
            "active_students": active_students,
            "basis": "reference" if period_code.startswith("2026-") else "history",
        }
        for period_code, active_students in REFERENCE_ENROLLMENT_TOTALS.items()
    ]


def _student_entry_year(index: int) -> int:
    blocks = (
        (224, 2016, 2020),
        (34, 2021, 2021),
        (10, 2022, 2022),
        (8, 2023, 2023),
        (55, 2024, 2024),
        (11, 2025, 2025),
        (18, 2026, 2026),
    )
    boundary = 0
    for size, first_year, last_year in blocks:
        if index < boundary + size:
            if first_year == last_year:
                return first_year
            return first_year + (index - boundary) % (last_year - first_year + 1)
        boundary += size
    return 2026


def _build_reference_students() -> list[Student]:
    by_year: dict[int, list[int]] = {}
    years = []
    for index in range(360):
        year = _student_entry_year(index)
        years.append(year)
        by_year.setdefault(year, []).append(index)

    account_indices = {
        "KZ2023077087": by_year[2023][0],
        "VL2023076796": by_year[2023][1],
    }
    codes_by_index = {index: code for code, index in account_indices.items()}
    return [
        Student(
            student_key=f"reference-student-{index + 1:04d}",
            student_code=codes_by_index.get(index, f"EPIS-REF-{index + 1:04d}"),
            entry_year=years[index],
            status="ACTIVE",
        )
        for index in range(360)
    ]


def _students_for_period(students: list[Student], year: int, count: int) -> list[Student]:
    eligible = [student for student in students if student.entry_year and student.entry_year <= year]
    eligible.sort(key=lambda student: (-int(student.entry_year or 0), student.student_key))
    preferred = [student for student in eligible if student.student_code in _REFERENCE_CODES]
    remaining = [student for student in eligible if student.student_code not in _REFERENCE_CODES]
    return (preferred + remaining)[:count]


@lru_cache(maxsize=1)
def demo_analytics() -> AnalyticsService:
    """Create the shared reference dataset without touching the operational DB."""

    global _SESSION_FACTORY
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    _SESSION_FACTORY = factory
    catalogs = [
        (spec.issuer_name, spec.credential_name, spec.website_url, spec.skills)
        for spec in DEMO_CERTIFICATION_CATALOG
    ]
    with factory.begin() as session:
        issuers = {
            name: Issuer(name=name, website_url=website)
            for name, _, website, _ in catalogs
        }
        skills = {
            name: Skill(name=name)
            for _, _, _, credential_skills in catalogs
            for name, _ in credential_skills
        }
        students = _build_reference_students()
        session.add_all([*issuers.values(), *skills.values(), *students])
        session.flush()

        for period_index, spec in enumerate(_PERIOD_SPECS):
            start = date.fromisoformat(spec["starts_on"])
            end = date.fromisoformat(spec["ends_on"])
            period = AcademicPeriod(
                code=spec["code"], name=spec["code"], starts_on=start, ends_on=end
            )
            session.add(period)
            session.flush()

            active_count = REFERENCE_ENROLLMENT_TOTALS[spec["code"]]
            period_students = _students_for_period(students, start.year, active_count)
            cutoff = min(end, date(2026, 10, 10))
            records = []

            for index, student in enumerate(period_students):
                is_account_record = student.student_code in _REFERENCE_CODES
                # Every period has approved credentials across the catalog. The
                # two linked student accounts keep a credential in each period
                # in which their 2023 cohort is active.
                if not is_account_record and (index % 5 == 0 or index >= 35 + period_index * 8):
                    continue
                catalog_index = (index + period_index) % len(catalogs)
                issuer_name, credential_name, _, credential_skills = catalogs[catalog_index]
                issued = start + timedelta(days=10 + index % 35)
                certification = Certification(
                    student_id=student.id,
                    issuer_id=issuers[issuer_name].id,
                    credential_name=credential_name,
                    issued_on=issued,
                    expires_on=cutoff + timedelta(days=45 + index % 180),
                    status="APPROVED",
                )
                session.add(certification)
                session.flush()
                records.append((student, certification, credential_skills))

                if is_account_record or index % 7 == 0:
                    secondary_index = (catalog_index + 1) % len(catalogs)
                    other_issuer, other_credential, _, other_skills = catalogs[secondary_index]
                    other = Certification(
                        student_id=student.id,
                        issuer_id=issuers[other_issuer].id,
                        credential_name=other_credential,
                        issued_on=issued + timedelta(days=1),
                        expires_on=cutoff + timedelta(days=90 + index % 160),
                        status="APPROVED",
                    )
                    session.add(other)
                    session.flush()
                    records.append((student, other, other_skills))

            points = sorted({start + timedelta(days=14), start + timedelta(days=35), cutoff})
            for point in points:
                certifications_per_student: dict[str, int] = {}
                for student, certification, credential_skills in records:
                    if certification.issued_on > point:
                        continue
                    certifications_per_student[student.student_key] = (
                        certifications_per_student.get(student.student_key, 0) + 1
                    )
                    session.add_all(
                        FactCertification(
                            certification_id=certification.id,
                            skill_id=skills[skill_name].id,
                            cutoff_date=point,
                            period_id=period.id,
                            issuer_id=certification.issuer_id,
                            status="APPROVED",
                            level=skill_level,
                            issued_on=certification.issued_on,
                            expires_on=certification.expires_on,
                        )
                        for skill_name, skill_level in credential_skills
                    )

                for index, student in enumerate(period_students):
                    count = certifications_per_student.get(student.student_key, 0)
                    session.add(
                        FactStudentPeriod(
                            student_key=student.student_key,
                            period_id=period.id,
                            cutoff_date=point,
                            cohort=str(student.entry_year or start.year),
                            cycle=_CYCLES[index % len(_CYCLES)],
                            enrollment_status="ACTIVE",
                            certification_count=count,
                            approved_certification_count=count,
                        )
                    )
    return AnalyticsService(factory)


def _student_display_name(student: Student) -> str:
    if student.student_code == "KZ2023077087":
        return "Cuenta KZ"
    if student.student_code == "VL2023076796":
        return "Cuenta VL"
    suffix = (student.student_code or "").rsplit("-", 1)[-1]
    return f"Estudiante EPIS {suffix}"


def _certification_records(session, period_id, cutoff: date, students: list[Student]) -> dict[str, list[dict[str, object]]]:
    if not students:
        return {}
    student_by_id = {student.id: student for student in students}
    rows = session.execute(
        select(FactCertification, Certification, Student, Issuer, Skill)
        .join(Certification, Certification.id == FactCertification.certification_id)
        .join(Student, Student.id == Certification.student_id)
        .join(Issuer, Issuer.id == FactCertification.issuer_id)
        .join(Skill, Skill.id == FactCertification.skill_id)
        .where(
            FactCertification.period_id == period_id,
            FactCertification.cutoff_date == cutoff,
            FactCertification.status == "APPROVED",
            Certification.student_id.in_(student_by_id),
        )
        .order_by(Certification.issued_on, Certification.credential_name, Skill.name)
    ).all()
    certifications: dict[tuple[str, str], dict[str, object]] = {}
    for fact, certification, student, issuer, skill in rows:
        key = (student.student_key, str(certification.id))
        item = certifications.setdefault(
            key,
            {
                "id": str(certification.id),
                "issuer": issuer.name,
                "credential_name": certification.credential_name,
                "issued_on": certification.issued_on.isoformat(),
                "expires_on": certification.expires_on.isoformat() if certification.expires_on else None,
                "status": "APPROVED",
                "skills": [],
                "traceability": {
                    "source": "EXAMPLE",
                    "student": {
                        "role": "STUDENT",
                        "reference": student.student_code,
                        "action": "Evento de ejemplo: registro asociado al perfil académico",
                        "date": certification.issued_on.isoformat(),
                    },
                    "validator": {
                        "role": "VALIDATOR",
                        "action": "Evento de ejemplo: certificación aprobada",
                        "date": min(cutoff, certification.issued_on + timedelta(days=7)).isoformat(),
                    },
                    "administrator": {
                        "role": "ADMIN",
                        "action": "Evento de ejemplo: incluida en el corte de indicadores",
                        "date": cutoff.isoformat(),
                    },
                },
            },
        )
        skills_list = item["skills"]
        assert isinstance(skills_list, list)
        if not any(entry["name"] == skill.name for entry in skills_list):
            skills_list.append({"name": skill.name, "level": fact.level})
        certifications.setdefault(key, item)

    grouped: dict[str, list[dict[str, object]]] = {}
    for (student_key, _), item in certifications.items():
        grouped.setdefault(student_key, []).append(item)
    return grouped


def demo_student_directory(
    *, period_code: str | None = None, q: str = "", offset: int = 0, limit: int = 25
) -> dict[str, object]:
    """Return role-restricted reference students for administration and validation."""

    demo_analytics()
    assert _SESSION_FACTORY is not None
    with _SESSION_FACTORY() as session:
        period = None
        if period_code:
            period = session.scalar(select(AcademicPeriod).where(AcademicPeriod.code == period_code))
        else:
            period = session.scalar(select(AcademicPeriod).order_by(AcademicPeriod.starts_on.desc()))
        if period is None:
            return {
                "dataset": "demo",
                "reference_label": "Datos de referencia · no oficiales",
                "period_code": period_code,
                "cutoff_date": None,
                "total": 0,
                "items": [],
            }
        cutoff = session.scalar(
            select(func.max(FactStudentPeriod.cutoff_date)).where(FactStudentPeriod.period_id == period.id)
        )
        if cutoff is None:
            return {
                "dataset": "demo",
                "reference_label": "Datos de referencia · no oficiales",
                "period_code": period.code,
                "cutoff_date": None,
                "total": 0,
                "items": [],
            }
        facts = session.scalars(
            select(FactStudentPeriod).where(
                FactStudentPeriod.period_id == period.id,
                FactStudentPeriod.cutoff_date == cutoff,
                FactStudentPeriod.enrollment_status == "ACTIVE",
            )
        ).all()
        students = session.scalars(
            select(Student).where(Student.student_key.in_([fact.student_key for fact in facts]))
        ).all()
        student_by_key = {student.student_key: student for student in students}
        term_students = [student_by_key[fact.student_key] for fact in facts if fact.student_key in student_by_key]
        certification_map = _certification_records(session, period.id, cutoff, term_students)
        cycle_by_key = {fact.student_key: fact.cycle for fact in facts}
        cohort_by_key = {fact.student_key: fact.cohort for fact in facts}
        search = q.strip().casefold()
        matched = []
        for student in term_students:
            email = next(
                (account for account, code in REFERENCE_STUDENT_ACCOUNTS.items() if code == student.student_code),
                None,
            )
            display_name = _student_display_name(student)
            searchable = " ".join(filter(None, (display_name, student.student_code, email))).casefold()
            if search and search not in searchable:
                continue
            matched.append(
                {
                    "id": student.student_key,
                    "code": student.student_code,
                    "display_name": display_name,
                    "email": email,
                    "cycle": cycle_by_key.get(student.student_key),
                    "cohort": cohort_by_key.get(student.student_key),
                    "status": "ACTIVE",
                    "certifications": certification_map.get(student.student_key, []),
                }
            )
        account_order = {
            code: index for index, code in enumerate(REFERENCE_STUDENT_ACCOUNTS.values())
        }
        matched.sort(
            key=lambda item: (
                account_order.get(str(item["code"]), len(account_order)),
                str(item["code"]),
            )
        )
        total = len(matched)
        return {
            "dataset": "demo",
            "reference_label": "Datos de referencia · no oficiales",
            "period_code": period.code,
            "cutoff_date": cutoff.isoformat(),
            "total": total,
            "items": matched[offset : offset + limit],
        }


def demo_validation_records(*, period_code: str | None = None) -> dict[str, object]:
    """Return a read-only, role-linked view of the shared reference records."""

    directory = demo_student_directory(period_code=period_code, limit=500)
    students = directory["items"]
    assert isinstance(students, list)
    items = [
        {
            "student_key": student["id"],
            "student_code": student["code"],
            "display_name": student["display_name"],
            "email": student["email"],
            "cycle": student["cycle"],
            "cohort": student["cohort"],
            "certifications": student["certifications"],
        }
        for student in students
        if student["certifications"]
    ]
    account_order = {code: index for index, code in enumerate(REFERENCE_STUDENT_ACCOUNTS.values())}
    items.sort(
        key=lambda item: (
            account_order.get(str(item["student_code"]), len(account_order)),
            str(item["student_code"]),
        )
    )
    certifications = sum(len(item["certifications"]) for item in items)
    return {
        "dataset": "demo",
        "reference_label": "Datos de referencia · no oficiales",
        "period_code": directory["period_code"],
        "cutoff_date": directory["cutoff_date"],
        "total_students": directory["total"],
        "students_with_certifications": len(items),
        "total_certifications": certifications,
        "items": items,
    }


def reference_student_profile(email: str) -> dict[str, object] | None:
    """Return only the reference history explicitly linked to this account."""

    code = REFERENCE_STUDENT_ACCOUNTS.get(email.strip().casefold())
    if code is None:
        return None
    demo_analytics()
    assert _SESSION_FACTORY is not None
    with _SESSION_FACTORY() as session:
        student = session.scalar(select(Student).where(Student.student_code == code))
        if student is None:
            return None
        rows = session.execute(
            select(FactStudentPeriod, AcademicPeriod)
            .join(AcademicPeriod, AcademicPeriod.id == FactStudentPeriod.period_id)
            .where(FactStudentPeriod.student_key == student.student_key)
            .order_by(AcademicPeriod.starts_on, FactStudentPeriod.cutoff_date)
        ).all()
        latest_by_period: dict[str, tuple[FactStudentPeriod, AcademicPeriod]] = {}
        for fact, period in rows:
            previous = latest_by_period.get(period.code)
            if previous is None or fact.cutoff_date > previous[0].cutoff_date:
                latest_by_period[period.code] = (fact, period)
        periods = []
        for fact, period in latest_by_period.values():
            if fact.enrollment_status != "ACTIVE":
                continue
            records = _certification_records(session, period.id, fact.cutoff_date, [student])
            periods.append(
                {
                    "period_code": period.code,
                    "cutoff_date": fact.cutoff_date.isoformat(),
                    "cycle": fact.cycle,
                    "cohort": fact.cohort,
                    "certifications": records.get(student.student_key, []),
                }
            )
        return {
            "dataset": "demo",
            "reference_label": "Datos de referencia · no oficiales",
            "student": {
                "code": student.student_code,
                "display_name": _student_display_name(student),
                "email": email.strip().casefold(),
            },
            "periods": periods,
        }


__all__ = [
    "REFERENCE_ENROLLMENT_TOTALS",
    "REFERENCE_STUDENT_ACCOUNTS",
    "demo_analytics",
    "demo_student_directory",
    "demo_validation_records",
    "reference_enrollment_history",
    "reference_student_profile",
]
