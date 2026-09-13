import os
from datetime import date, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData, Table, create_engine, inspect, select
from sqlalchemy.exc import IntegrityError


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_CONFIG = REPOSITORY_ROOT / "backend" / "alembic.ini"
EXPECTED_TABLES = {
    "users",
    "students",
    "academic_periods",
    "enrollments",
    "issuers",
    "skills",
    "certifications",
    "certification_status_history",
    "certification_skills",
    "evidences",
    "validations",
    "audit_logs",
    "fact_student_period",
    "fact_certification",
    "roster_imports",
    "roster_import_rejections",
    "etl_runs",
    "etl_rejections",
}


def _alembic_config(database_url: str) -> Config:
    config = Config(str(ALEMBIC_CONFIG))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


def _database_id(database_url: str):
    return str(uuid4()) if database_url.startswith("sqlite") else uuid4()


@pytest.fixture
def database_url(tmp_path):
    configured_url = os.getenv("PULSE_DATABASE_URL") or os.getenv("DATABASE_URL")
    if configured_url:
        return configured_url
    return f"sqlite+pysqlite:///{(tmp_path / 'pulse-epis.db').as_posix()}"


def test_migration_creates_synthetic_schema_rejects_duplicates_and_reverses(database_url):
    config = _alembic_config(database_url)
    command.upgrade(config, "head")
    engine = create_engine(database_url)

    assert EXPECTED_TABLES.issubset(set(inspect(engine).get_table_names()))

    metadata = MetaData()
    metadata.reflect(bind=engine, only=EXPECTED_TABLES)
    users = Table("users", metadata, autoload_with=engine)
    students = Table("students", metadata, autoload_with=engine)
    periods = Table("academic_periods", metadata, autoload_with=engine)
    enrollments = Table("enrollments", metadata, autoload_with=engine)
    issuers = Table("issuers", metadata, autoload_with=engine)
    certifications = Table("certifications", metadata, autoload_with=engine)
    status_history = Table("certification_status_history", metadata, autoload_with=engine)

    assert "google_subject" in users.c
    assert {"school", "study_plan"}.issubset(set(enrollments.c.keys()))
    evidences = Table("evidences", metadata, autoload_with=engine)
    assert {
        "original_filename",
        "content_type",
        "byte_size",
        "retention_until",
    }.issubset(set(evidences.c.keys()))
    assert {
        "actor_user_id",
        "from_status",
        "to_status",
        "comment",
        "cutoff_date",
        "changed_at",
    }.issubset(set(status_history.c.keys()))

    user_id = _database_id(database_url)
    student_id = _database_id(database_url)
    period_id = _database_id(database_url)
    issuer_id = _database_id(database_url)
    certification_id = _database_id(database_url)
    issued_on = date(2026, 9, 13)

    with engine.begin() as connection:
        connection.execute(
            users.insert().values(
                id=user_id,
                email="synthetic.student@virtual.upt.pe",
                role="STUDENT",
            )
        )
        connection.execute(
            students.insert().values(
                id=student_id,
                user_id=user_id,
                student_key="student-synthetic-001",
                entry_year=2026,
            )
        )
        connection.execute(
            periods.insert().values(
                id=period_id,
                code="2026-I",
                name="2026-I",
                starts_on=date(2026, 3, 1),
                ends_on=date(2026, 7, 31),
            )
        )
        connection.execute(
            issuers.insert().values(
                id=issuer_id,
                name="Synthetic Issuer",
                website_url="https://example.com/issuer",
            )
        )
        connection.execute(
            enrollments.insert().values(
                id=_database_id(database_url),
                student_id=student_id,
                period_id=period_id,
                cycle="VI",
                cohort="2026",
            )
        )
        connection.execute(
            certifications.insert().values(
                id=certification_id,
                student_id=student_id,
                issuer_id=issuer_id,
                credential_name="Synthetic Cloud Fundamentals",
                issued_on=issued_on,
                source_url="https://example.com/certification/001",
            )
        )
        connection.execute(
            status_history.insert().values(
                id=_database_id(database_url),
                certification_id=certification_id,
                actor_user_id=user_id,
                from_status=None,
                to_status="PENDING",
                comment="Registro inicial",
                changed_at=datetime(2026, 9, 13),
            )
        )

        assert connection.scalar(select(users.c.email)) == "synthetic.student@virtual.upt.pe"
        assert connection.scalar(select(students.c.student_key)) == "student-synthetic-001"

    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(
                enrollments.insert().values(
                    id=_database_id(database_url),
                    student_id=student_id,
                    period_id=period_id,
                    cycle="VI",
                    cohort="2026",
                )
            )

    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(
                certifications.insert().values(
                    id=str(uuid4()),
                    student_id=student_id,
                    issuer_id=issuer_id,
                    credential_name="Synthetic Cloud Fundamentals",
                    issued_on=issued_on,
                    source_url="https://example.com/certification/duplicate",
                )
            )

    engine.dispose()
    command.downgrade(config, "base")
    downgraded_engine = create_engine(database_url)
    assert not EXPECTED_TABLES.intersection(set(inspect(downgraded_engine).get_table_names()))
    downgraded_engine.dispose()
