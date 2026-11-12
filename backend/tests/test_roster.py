from __future__ import annotations

from io import BytesIO
from datetime import date
from uuid import UUID, uuid4

from openpyxl import Workbook
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.auth.models import AuthenticatedUser, Role
from backend.app.auth.store import InMemoryUserDirectory
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import AcademicPeriod, Enrollment, RosterCandidate, RosterImport, Student, User
from backend.app.main import create_app
from backend.app.roster.parser import parse_roster_candidate_upload, parse_roster_csv
from backend.app.roster.service import RosterImportService, pseudonymize_student_code
from backend.app.roster.preview import preview_periods


VALID_CSV = b"""code,email,school,plan,cycle,status,period
kz2023077087,student.one@virtual.upt.pe,EPIS,Plan 2020,VIII,ACTIVE,2026-II
kz2022011044,student.two@virtual.upt.pe,EPIS,Plan 2020,VI,ACTIVO,2026-II
"""


def test_roster_preserves_confirmed_name_with_student_identity():
    service, session_factory, _, actor_id, _ = make_service()
    content = ("code,email,school,plan,cycle,status,period,name\n"
               "2023077087,kz2023077087@virtual.upt.pe,EPIS,2026 II,VIII,ACTIVE,2026-II,Cuenta KZ\n").encode()

    report = service.import_csv(content, period_code="2026-II", actor_user_id=actor_id)

    assert report.status == "APPLIED"
    with session_factory() as session:
        student = session.scalar(select(Student).where(Student.student_code == "2023077087"))
        assert student is not None
        assert student.full_name == "Cuenta KZ"
        assert session.scalar(select(User.email).where(User.id == student.user_id)) == "kz2023077087@virtual.upt.pe"


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


def make_roster_workbook(*, duplicate_roster_sheet: bool = False) -> bytes:
    workbook = Workbook()
    workbook.active.title = "Resumen"
    workbook.active.append(["Resumen de carga"])
    roster = workbook.create_sheet("Padron Pulse 2026-II")
    roster.append(["Padrón autorizado"])
    roster.append(["Notas de carga"])
    roster.append(["code", "email", "school", "plan", "cycle", "status", "period", "name"])
    roster.append(["2023077087", "kz2023077087@virtual.upt.pe", "EPIS", "2026-II", "VIII", "ACTIVE", "2026-II", "Estudiante de prueba"])
    roster.append(["2023077088", "kz2023077088@virtual.upt.pe", "EPIS", "2026-II", "VII", "ACTIVE", "2026-II", "Otro estudiante"])
    pending = workbook.create_sheet("Pendientes conciliacion")
    pending.append(["Pendientes de conciliación"])
    pending.append(["source_row", "name", "period", "cycle", "email", "proposed_code", "issue_code"])
    pending.append([10, "Pendiente de prueba", "2026-II", "V", None, None, "MISSING_EMAIL"])
    if duplicate_roster_sheet:
        second = workbook.create_sheet("Otra lista")
        second.append(["code", "email", "school", "plan", "cycle", "status", "period"])
        second.append(["2023077099", "kz2023077099@virtual.upt.pe", "EPIS", "2026-II", "I", "ACTIVE", "2026-II"])
    content = BytesIO()
    workbook.save(content)
    return content.getvalue()


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


def test_roster_rejects_staff_domain_even_when_google_allows_staff():
    content = b"code,email,school,plan,cycle,status,period\n2023077087,student@upt.edu.pe,EPIS,Plan 2020,VIII,ACTIVE,2026-II\n"
    settings = make_settings().model_copy(update={"google_allowed_domains": "virtual.upt.pe,upt.edu.pe"})

    parsed = parse_roster_csv(content, period_code="2026-II", settings=settings)

    assert parsed.records == ()
    assert [item.reason_code for item in parsed.rejections] == ["EMAIL_DOMAIN_NOT_ALLOWED"]


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
        assert client.get("/api/v1/padron/periods").status_code == 401
        assert client.post("/api/v1/padron/periods", json={"code": "2025-I", "starts_on": "2025-03-01", "ends_on": "2025-07-31"}).status_code == 401
        assert client.post("/api/v1/padron/preview", files={"file": ("roster.csv", VALID_CSV)}).status_code == 401

    assert upload.status_code == 401
    assert history.status_code == 401
    engine.dispose()


def test_period_catalog_does_not_require_published_indicators():
    service, _, _, _, engine = make_service()
    assert [p.code for p in service.list_periods()] == ["2026-II"]
    service.create_period(code="2025-II", starts_on=date(2025, 8, 1), ends_on=date(2025, 12, 31))
    assert [p.code for p in service.list_periods()] == ["2026-II", "2025-II"]
    import pytest
    with pytest.raises(ValueError):
        service.create_period(code="2025-II", starts_on=date(2025, 8, 1), ends_on=date(2025, 12, 31))
    engine.dispose()


def test_three_period_csv_keeps_enrollments_and_history_separate():
    service, session_factory, _, actor_id, engine = make_service()
    service.create_period(code="2025-I", starts_on=date(2025, 3, 1), ends_on=date(2025, 7, 31))
    service.create_period(code="2025-II", starts_on=date(2025, 8, 1), ends_on=date(2025, 12, 31))
    content = b"code,email,school,plan,cycle,status,period\n" + b"\n".join(
        f"kz2023077087,student.one@virtual.upt.pe,EPIS,Plan 2020,{cycle},ACTIVE,{period}".encode()
        for period, cycle in [("2025-I", "VI"), ("2025-II", "VII"), ("2026-II", "VIII")]
    )
    assert preview_periods(content, make_settings()) == [
        {"code": "2026-II", "rows": 1}, {"code": "2025-II", "rows": 1}, {"code": "2025-I", "rows": 1},
    ]
    reports = []
    for code in ["2025-I", "2025-II", "2026-II"]:
        report = service.import_csv(content, period_code=code, actor_user_id=actor_id, selected_period_only=True)
        assert report.status == "APPLIED"
        assert report.total_rows == report.accepted_rows == 1
        assert len(service.list_history(period_code=code)) == 1
        reports.append(report)
    repeated = service.import_csv(content, period_code="2025-I", actor_user_id=actor_id, selected_period_only=True)
    assert repeated.idempotent and repeated.id == reports[0].id
    with session_factory() as session:
        assert session.scalar(select(func.count()).select_from(Student)) == 1
        assert session.scalar(select(func.count()).select_from(Enrollment)) == 3
        assert {e.cycle for e in session.scalars(select(Enrollment))} == {"VI", "VII", "VIII"}
    engine.dispose()


def test_selected_period_preserves_original_row_numbers_and_rejects_atomically():
    content = b"""code,email,school,plan,cycle,status,period
kz2023077087,student.one@virtual.upt.pe,EPIS,Plan 2020,VI,ACTIVE,2025-I
kz2022011044,student.two@virtual.upt.pe,OTHER,Plan 2020,VII,ACTIVE,2026-II
"""
    parsed = parse_roster_csv(content, period_code="2026-II", settings=make_settings(), selected_period_only=True)
    assert parsed.total_rows == 1
    assert parsed.rejections[0].row_number == 3
    assert {r.reason_code for r in parsed.rejections} == {"INVALID_SCHOOL"}


def test_preview_validates_headers_and_missing_periods_without_echoing_student_data():
    import pytest
    for content in [b"period\n2025-I", VALID_CSV.replace(b"2026-II", b"private-personal-value")]:
        with pytest.raises(ValueError) as error:
            preview_periods(content, make_settings())
        assert "private-personal-value" not in str(error.value)


def test_preview_accepts_the_optional_confirmed_student_name_column():
    content = (
        b"code,email,school,plan,cycle,status,period,name\n"
        b"2023077087,kz2023077087@virtual.upt.pe,EPIS,2026 II,VIII,ACTIVE,2026-II,Cuenta KZ\n"
    )

    assert preview_periods(content, make_settings()) == [{"code": "2026-II", "rows": 1}]


def test_xlsx_preview_reads_only_the_roster_sheet_and_does_not_expose_names():
    content = make_roster_workbook()

    preview = preview_periods(content, make_settings(), "estudiantes_pulse.xlsx")

    assert preview == [{"code": "2026-II", "rows": 2}]
    assert "Estudiante de prueba" not in str(preview)


def test_xlsx_import_is_idempotent_and_keeps_excel_source_row_numbers():
    service, session_factory, _, actor_id, engine = make_service()
    content = make_roster_workbook()

    report = service.import_csv(
        content,
        period_code="2026-II",
        actor_user_id=actor_id,
        filename="estudiantes_pulse.xlsx",
    )
    repeated = service.import_csv(
        content,
        period_code="2026-II",
        actor_user_id=actor_id,
        filename="estudiantes_pulse.xlsx",
    )

    assert report.status == "APPLIED"
    assert report.total_rows == report.accepted_rows == 2
    assert repeated.idempotent and repeated.id == report.id
    with session_factory() as session:
        assert session.scalar(select(func.count()).select_from(Student)) == 2
        assert session.scalar(select(func.count()).select_from(Enrollment)) == 2
    engine.dispose()


def test_xlsx_preview_rejects_multiple_roster_sheets():
    import pytest

    with pytest.raises(ValueError, match="una sola hoja"):
        preview_periods(make_roster_workbook(duplicate_roster_sheet=True), make_settings(), "padron.xlsx")


def test_candidate_parser_reads_only_pending_sheet_and_targets_requested_period():
    candidates = parse_roster_candidate_upload(
        make_roster_workbook(),
        filename="estudiantes_pulse.xlsx",
        period_code="2026-II",
        settings=make_settings(),
    )

    assert len(candidates) == 1
    assert candidates[0].source_row == 10
    assert candidates[0].cycle == "V"
    assert candidates[0].issue_code == "MISSING_EMAIL"
    assert candidates[0].email == candidates[0].code == ""


def test_admin_can_reconcile_pending_candidate_into_period_roster():
    from backend.app.auth.dependencies import get_current_user

    service, session_factory, _, actor_id, engine = make_service()
    actor = AuthenticatedUser(id=actor_id, email="admin@virtual.upt.pe", role=Role.ADMIN)
    app = create_app(
        settings=make_settings(),
        user_directory=InMemoryUserDirectory([actor]),
        roster_import_service=service,
    )
    app.state.session_factory = session_factory

    def current_user():
        return actor

    app.dependency_overrides[get_current_user] = current_user
    with TestClient(app) as client:
        imported = client.post(
            "/api/v1/padron/candidates/import?period_code=2026-II",
            files={"file": ("estudiantes_pulse.xlsx", make_roster_workbook(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert imported.status_code == 200, imported.text
        assert imported.json()["added"] == 1

        listing = client.get("/api/v1/padron/candidates?period_code=2026-II&state=ALL")
        assert listing.status_code == 200, listing.text
        candidate = listing.json()["items"][0]
        candidate["name"] = "Pendiente de prueba confirmado"
        candidate["email"] = "zz2023077099@virtual.upt.pe"
        candidate["student_code"] = "2023077099"
        candidate["cycle"] = "V"
        candidate["school"] = "EPIS"
        candidate["study_plan"] = "2026-II"
        candidate["student_status"] = "ACTIVE"
        saved = client.put(f"/api/v1/padron/candidates/{candidate['id']}", json=candidate)
        assert saved.status_code == 200, saved.text

        resolved = client.post(f"/api/v1/padron/candidates/{candidate['id']}/reconcile")
        assert resolved.status_code == 200, resolved.text
        assert resolved.json()["state"] == "RESOLVED"

    with session_factory() as session:
        student = session.scalar(select(Student).where(Student.student_code == "2023077099"))
        assert student is not None
        assert student.full_name == "Pendiente de prueba confirmado"
        assert session.scalar(select(func.count()).select_from(Enrollment)) == 1
        assert session.scalar(select(RosterCandidate.state)) == "RESOLVED"
    engine.dispose()
