from datetime import date, datetime, timezone
import json
import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import select

from backend.app.db.models import (
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
from backend.app.db.session import create_session_factory
from backend.app.etl.service import EtlService
from backend.scripts_etl.main import export_lake_snapshot, scheduled_target, transform


def test_scheduled_target_uses_previous_day_in_lima(tmp_path):
    database_url = f"sqlite+pysqlite:///{(tmp_path / 'etl-schedule.db').as_posix()}"
    _migrate(database_url)
    factory = create_session_factory(database_url)
    with factory.begin() as session:
        session.add(AcademicPeriod(code="2026-II", name="Segundo periodo", starts_on=date(2026, 8, 1), ends_on=date(2026, 12, 31), status="OPEN"))
    assert scheduled_target(factory, now=datetime(2026, 10, 26, 5, 0, tzinfo=timezone.utc)) == ("2026-II", date(2026, 10, 25))


def test_lake_export_contains_only_pseudonymized_facts(tmp_path):
    database_url = f"sqlite+pysqlite:///{(tmp_path / 'etl-lake.db').as_posix()}"
    period_code, cutoff_date, _ = _seed_database(database_url)
    factory = create_session_factory(database_url)
    report = EtlService(factory).run(period_code, cutoff_date)
    partition = export_lake_snapshot(factory, report, tmp_path / "lake")
    manifest = json.loads((partition / "manifest.json").read_text(encoding="utf-8"))
    students = (partition / "fact_student_period.jsonl").read_text(encoding="utf-8")
    assert partition.name == f"cutoff_date={cutoff_date.isoformat()}"
    assert manifest["contains_personal_identifiers"] is False
    assert manifest["student_fact_rows"] == 1
    assert "stu-synthetic-001" in students
    assert "@" not in students


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _migrate(database_url: str) -> None:
    config = Config(str(REPOSITORY_ROOT / "backend" / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    # migrations/env.py intentionally prioritizes PULSE_DATABASE_URL for CI.
    # Override it temporarily so these isolated synthetic tests migrate the
    # same SQLite database that they use for their sessions.
    previous = {
        key: os.environ.get(key) for key in ("PULSE_DATABASE_URL", "DATABASE_URL")
    }
    os.environ["PULSE_DATABASE_URL"] = database_url
    os.environ.pop("DATABASE_URL", None)
    try:
        command.upgrade(config, "head")
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def _seed_database(database_url: str, *, missing_skill: bool = False):
    _migrate(database_url)
    factory = create_session_factory(database_url)
    with factory.begin() as session:
        period = AcademicPeriod(
            code="2026-II",
            name="2026-II",
            starts_on=date(2026, 8, 1),
            ends_on=date(2026, 12, 31),
        )
        student = Student(student_key="stu-synthetic-001", entry_year=2026)
        issuer = Issuer(name="Amazon Web Services Training and Certification")
        enrollment = Enrollment(
            student_id=student.id,
            period_id=period.id,
            cohort="2026",
            status="ACTIVE",
        )
        certification = Certification(
            student_id=student.id,
            issuer_id=issuer.id,
            credential_name="AWS Cloud Practitioner",
            issued_on=date(2026, 8, 15),
            status="APPROVED",
        )
        session.add_all([period, student, issuer])
        session.flush()
        enrollment.student_id = student.id
        enrollment.period_id = period.id
        certification.student_id = student.id
        certification.issuer_id = issuer.id
        session.add_all([enrollment, certification])
        session.flush()
        if not missing_skill:
            skill = Skill(name="Cloud Computing", category="Cloud")
            session.add(skill)
            session.flush()
            session.add(
                CertificationSkill(
                    certification_id=certification.id,
                    skill_id=skill.id,
                    level="fundamentals",
                )
            )
        return period.code, date(2026, 9, 13), certification.id


def test_transform_normalizes_catalogs_without_personal_email_data():
    result = transform(
        [
            {
                "issuer_name": "Amazon Web Services Training and Certification",
                "credential_name": "AWS Cloud Practitioner",
                "skill_name": " Cloud   Computing ",
                "level": "fundamental",
                "status": "approved",
                "student_key": "stu-synthetic-001",
            }
        ]
    )

    assert result == [
        {
            "student_key": "stu-synthetic-001",
            "issuer_name": "AWS",
            "credential_name": "AWS Cloud Practitioner",
            "skill_name": "Cloud Computing",
            "level": "Fundamentals",
            "status": "APPROVED",
        }
    ]


def test_etl_is_idempotent_and_publishes_normalized_facts(tmp_path):
    database_url = f"sqlite+pysqlite:///{(tmp_path / 'etl.db').as_posix()}"
    period_code, cutoff_date, certification_id = _seed_database(database_url)
    service = EtlService(create_session_factory(database_url))

    first = service.run(period_code, cutoff_date)
    second = service.run(period_code, cutoff_date)

    assert first.status == "APPLIED"
    assert first.accepted_rows == 1
    assert first.enrollment_rows == 1
    assert first.active_enrollment_rows == 1
    assert first.to_dict()["enrollment_rows"] == 1
    assert first.to_dict()["active_enrollment_rows"] == 1
    assert first.to_dict()["created_at"] == first.created_at.isoformat()
    assert first.to_dict()["completed_at"] == first.completed_at.isoformat()
    assert second.id == first.id
    assert second.idempotent is True
    assert second.source_sha256 == first.source_sha256
    assert second.enrollment_rows == 1
    assert second.active_enrollment_rows == 1

    with create_session_factory(database_url)() as session:
        fact = session.scalar(
            select(FactCertification).where(FactCertification.certification_id == certification_id)
        )
        student_fact = session.scalar(
            select(FactStudentPeriod).where(FactStudentPeriod.student_key == "stu-synthetic-001")
        )
        assert fact is not None
        assert fact.level == "Fundamentals"
        assert fact.status == "APPROVED"
        assert student_fact is not None
        assert student_fact.certification_count == 1
        assert student_fact.approved_certification_count == 1
        assert session.scalar(select(EtlRun).where(EtlRun.id == first.id)) is not None


def test_etl_history_backfills_enrollment_counts_for_legacy_applied_runs(tmp_path):
    database_url = f"sqlite+pysqlite:///{(tmp_path / 'etl-legacy-counts.db').as_posix()}"
    period_code, cutoff_date, _ = _seed_database(database_url)
    factory = create_session_factory(database_url)
    service = EtlService(factory)
    report = service.run(period_code, cutoff_date)

    with factory.begin() as session:
        run = session.get(EtlRun, report.id)
        assert run is not None
        run.quality_report = {
            key: value
            for key, value in (run.quality_report or {}).items()
            if key not in {"enrollment_rows", "active_enrollment_rows"}
        }

    legacy_report = service.history(period_code)[0]

    assert legacy_report.id == report.id
    assert legacy_report.enrollment_rows == 1
    assert legacy_report.active_enrollment_rows == 1


def test_etl_records_rejection_cause_and_does_not_publish_invalid_source(tmp_path):
    database_url = f"sqlite+pysqlite:///{(tmp_path / 'etl-rejected.db').as_posix()}"
    period_code, cutoff_date, _ = _seed_database(database_url, missing_skill=True)
    service = EtlService(create_session_factory(database_url))

    report = service.run(period_code, cutoff_date)

    assert report.status == "REJECTED"
    assert report.accepted_rows == 0
    assert report.enrollment_rows == 1
    assert report.active_enrollment_rows == 1
    assert report.rejections[0].reason_code == "MISSING_SKILL"
    with create_session_factory(database_url)() as session:
        assert session.scalars(select(FactCertification)).all() == []
        assert session.scalar(select(EtlRejection).where(EtlRejection.run_id == report.id)) is not None


def test_rejected_rerun_keeps_the_last_published_snapshot(tmp_path):
    database_url = f"sqlite+pysqlite:///{(tmp_path / 'etl-atomic.db').as_posix()}"
    period_code, cutoff_date, certification_id = _seed_database(database_url)
    service = EtlService(create_session_factory(database_url))
    applied = service.run(period_code, cutoff_date)

    with create_session_factory(database_url).begin() as session:
        certification = session.get(Certification, certification_id)
        assert certification is not None
        certification.credential_name = "AWS Cloud Practitioner Updated"
        certification_skill = session.scalar(
            select(CertificationSkill).where(
                CertificationSkill.certification_id == certification_id
            )
        )
        assert certification_skill is not None
        session.delete(certification_skill)

    rejected = service.run(period_code, cutoff_date)

    assert applied.status == "APPLIED"
    assert rejected.status == "REJECTED"
    with create_session_factory(database_url)() as session:
        facts = session.scalars(select(FactCertification)).all()
        assert len(facts) == 1
        assert facts[0].certification_id == certification_id
