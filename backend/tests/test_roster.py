from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.auth.models import AuthenticatedUser, Role
from backend.app.auth.store import InMemoryUserDirectory
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import AcademicPeriod, Enrollment, RosterImport, Student, User
from backend.app.main import create_app
from backend.app.roster.parser import parse_roster_csv
from backend.app.roster.service import RosterImportService, pseudonymize_student_code


VALID_CSV = b"""code,email,school,plan,cycle,status,period
kz2023077087,student.one@virtual.upt.pe,EPIS,Plan 2020,VIII,ACTIVE,2026-II
kz2022011044,student.two@virtual.upt.pe,EPIS,Plan 2020,VI,ACTIVO,2026-II
"""


def make_settings() -> Settings:
    return Settings(
        environment="test",
        log_level="WARNING",
        auth_session_secret="test-session-secret",
        google_allowed_domains="virtual.upt.pe",
        roster_pseudonym_secret="test-roster-secret",
    )


def make_service() -> tuple[RosterImportService, sessionmaker[Session], AcademicPeriod, UUID, object]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    period = AcademicPeriod(
        id=uuid4(),
        code="2026-II",
        name="2026-II",
        starts_on=date(2026, 8, 1),
        ends_on=date(2026, 12, 31),
    )
    actor = User(id=uuid4(), email="admin@virtual.upt.pe", role="ADMIN")
    actor_id = actor.id
    with Session(engine) as session:
        session.add_all([period, actor])
        session.commit()
    return RosterImportService(session_factory, make_settings()), session_factory, period, actor_id, engine


def test_parser_reports_school_status_period_and_never_echoes_invalid_values():
    content = b"""code,email,school,plan,cycle,status,period
bad-code,student@outside.example,OTHER,,VI,UNKNOWN,2025-I
"""

    parsed = parse_roster_csv(content, period_code="2026-II", settings=make_settings())

    assert parsed.records == ()
    assert {rejection.reason_code for rejection in parsed.rejections} == {
        "EMAIL_DOMAIN_NOT_ALLOWED",
        "INVALID_SCHOOL",
        "INVALID_PLAN",
        "INVALID_STATUS",
        "PERIOD_MISMATCH",
    }
    assert all("student@outside" not in rejection.message for rejection in parsed.rejections)
    assert all("bad-code" not in rejection.message for rejection in parsed.rejections)


def test_import_is_atomic_pseudonymized_and_idempotent(caplog):
    service, session_factory, period, actor_id, engine = make_service()
    caplog.set_level("INFO", logger="backend.app.roster.service")

    report = service.import_csv(
        VALID_CSV,
        period_code="2026-II",
        actor_user_id=actor_id,
    )
    repeated = service.import_csv(
        VALID_CSV,
        period_code="2026-II",
        actor_user_id=actor_id,
    )

    assert report.status == "APPLIED"
    assert report.total_rows == 2
    assert report.accepted_rows == 2
    assert report.rejected_rows == 0
    assert report.idempotent is False
    assert repeated.id == report.id
    assert repeated.idempotent is True

    with session_factory() as session:
        assert session.scalar(select(func.count()).select_from(Student)) == 2
        assert session.scalar(select(func.count()).select_from(Enrollment)) == 2
        assert session.scalar(select(func.count()).select_from(RosterImport)) == 1
        students = session.scalars(select(Student).order_by(Student.student_key)).all()
        enrollments = session.scalars(select(Enrollment)).all()

    assert all(student.student_key.startswith("stu_") for student in students)
    assert all("kz2023" not in student.student_key for student in students)
    assert pseudonymize_student_code("kz2023077087", "test-roster-secret") in {
        student.student_key for student in students
    }
    assert {enrollment.school for enrollment in enrollments} == {"EPIS"}
    assert {enrollment.study_plan for enrollment in enrollments} == {"Plan 2020"}
    log_messages = " ".join(record.getMessage() for record in caplog.records)
    assert "student.one@virtual.upt.pe" not in log_messages
    assert "kz2023077087" not in log_messages
    engine.dispose()


def test_rejected_batch_does_not_apply_partial_students_and_history_is_period_scoped():
    service, session_factory, period, actor_id, engine = make_service()
    invalid_csv = b"""code,email,school,plan,cycle,status,period
kz2023077087,student.one@virtual.upt.pe,OTHER,Plan 2020,VIII,UNKNOWN,2026-II
kz2022011044,student.two@virtual.upt.pe,EPIS,Plan 2020,VI,ACTIVE,2025-I
"""

    rejected = service.import_csv(
        invalid_csv,
        period_code="2026-II",
        actor_user_id=actor_id,
    )

    assert rejected.status == "REJECTED"
    assert rejected.accepted_rows == 0
    assert rejected.rejected_rows == 2
    assert {item.reason_code for item in rejected.rejections} == {
        "INVALID_SCHOOL",
        "INVALID_STATUS",
        "PERIOD_MISMATCH",
    }
    assert rejected.rejected_rows == 2

    with session_factory() as session:
        assert session.scalar(select(func.count()).select_from(Student)) == 0
        assert session.scalar(select(func.count()).select_from(Enrollment)) == 0
    assert len(service.list_history(period_code="2026-II")) == 1
    engine.dispose()


def test_roster_endpoints_require_padron_permission():
    service, _, _, _, engine = make_service()
    directory = InMemoryUserDirectory(
        [
            AuthenticatedUser(
                id=uuid4(),
                email="validator@virtual.upt.pe",
                role=Role.VALIDATOR,
            )
        ]
    )
    app = create_app(
        settings=make_settings(),
        user_directory=directory,
        roster_import_service=service,
    )

    with TestClient(app) as client:
        upload = client.post(
            "/api/v1/padron/imports?period_code=2026-II",
            files={"file": ("padron.csv", VALID_CSV, "text/csv")},
        )
        history = client.get("/api/v1/padron/imports?period_code=2026-II")

    assert upload.status_code == 401
    assert history.status_code == 401
    engine.dispose()
