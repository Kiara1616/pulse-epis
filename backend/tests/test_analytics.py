from datetime import date
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.analytics.service import AnalyticsService
from backend.app.auth.dependencies import get_current_user
from backend.app.auth.models import AuthenticatedUser, Role
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import (
    AcademicPeriod,
    Certification,
    FactCertification,
    FactStudentPeriod,
    Issuer,
    Skill,
    Student,
)
from backend.app.main import create_app


def _analytics_fixture():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    cutoff = date(2026, 9, 13)
    with factory.begin() as session:
        period = AcademicPeriod(code="2026-II", name="2026-II", starts_on=date(2026, 8, 1), ends_on=date(2026, 12, 31))
        aws = Issuer(name="AWS")
        cisco = Issuer(name="Cisco")
        cloud = Skill(name="Cloud Computing", category="Cloud")
        network = Skill(name="Networking", category="Infrastructure")
        students = [
            Student(student_key="anonymous-001", status="ACTIVE"),
            Student(student_key="anonymous-002", status="ACTIVE"),
            Student(student_key="anonymous-003", status="ACTIVE"),
        ]
        session.add_all([period, aws, cisco, cloud, network, *students])
        session.flush()
        session.add_all(
            [
                FactStudentPeriod(student_key="anonymous-001", period_id=period.id, cutoff_date=cutoff, cohort="2024", cycle="V", enrollment_status="ACTIVE", certification_count=1, approved_certification_count=1),
                FactStudentPeriod(student_key="anonymous-002", period_id=period.id, cutoff_date=cutoff, cohort="2024", cycle="V", enrollment_status="ACTIVE", certification_count=1, approved_certification_count=0),
                FactStudentPeriod(student_key="anonymous-003", period_id=period.id, cutoff_date=cutoff, cohort="2025", cycle="III", enrollment_status="ACTIVE", certification_count=1, approved_certification_count=1),
            ]
        )
        certifications = [
            Certification(student_id=students[0].id, issuer_id=aws.id, credential_name="Cloud Practitioner", issued_on=date(2026, 8, 10), expires_on=date(2026, 10, 1), status="APPROVED"),
            Certification(student_id=students[1].id, issuer_id=cisco.id, credential_name="CCNA", issued_on=date(2026, 8, 11), status="REJECTED"),
            Certification(student_id=students[2].id, issuer_id=cisco.id, credential_name="Networking Basics", issued_on=date(2026, 8, 12), status="APPROVED"),
        ]
        session.add_all(certifications)
        session.flush()
        session.add_all(
            [
                FactCertification(certification_id=certifications[0].id, skill_id=cloud.id, cutoff_date=cutoff, period_id=period.id, issuer_id=aws.id, status="APPROVED", level="Fundamentals", issued_on=certifications[0].issued_on, expires_on=certifications[0].expires_on),
                FactCertification(certification_id=certifications[1].id, skill_id=network.id, cutoff_date=cutoff, period_id=period.id, issuer_id=cisco.id, status="REJECTED", level="Associate", issued_on=certifications[1].issued_on),
                FactCertification(certification_id=certifications[2].id, skill_id=network.id, cutoff_date=cutoff, period_id=period.id, issuer_id=cisco.id, status="APPROVED", level="Fundamentals", issued_on=certifications[2].issued_on),
            ]
        )
    return engine, factory


def test_overview_uses_only_approved_snapshot_facts_and_matches_sql_counts():
    engine, factory = _analytics_fixture()
    result = AnalyticsService(factory).overview(period_code="2026-II")

    assert result.filters.cutoff_date == date(2026, 9, 13)
    assert result.kpis.active_students == 3
    assert result.kpis.certified_students == 2
    assert result.kpis.approved_certifications == 2
    assert result.kpis.coverage_percent == 66.67
    assert result.kpis.expiring_soon == 1
    assert {item.name: item.value for item in result.by_issuer} == {"AWS": 1, "Cisco": 1}
    assert result.evolution[0].approved_certifications == 2
    assert {item.skill: item.gap_students for item in result.skill_gaps} == {"Cloud Computing": 2, "Networking": 2}
    engine.dispose()


def test_overview_applies_cohort_cycle_issuer_and_level_filters():
    engine, factory = _analytics_fixture()
    result = AnalyticsService(factory).overview(
        period_code="2026-II", cohort="2024", cycle="V", issuer="AWS", level="Fundamentals"
    )

    assert result.kpis.active_students == 2
    assert result.kpis.certified_students == 1
    assert result.kpis.approved_certifications == 1
    assert result.kpis.coverage_percent == 50.0
    engine.dispose()


def test_missing_explicit_snapshot_is_not_reported_as_zero_activity():
    engine, factory = _analytics_fixture()
    service = AnalyticsService(factory)

    from backend.app.analytics.service import AnalyticsSnapshotNotFound

    try:
        service.overview(period_code="2026-II", cutoff_date=date(2026, 9, 12))
        raise AssertionError("Expected AnalyticsSnapshotNotFound")
    except AnalyticsSnapshotNotFound:
        pass
    finally:
        engine.dispose()


def test_expiring_soon_uses_immutable_snapshot_expiration():
    engine, factory = _analytics_fixture()
    service = AnalyticsService(factory)
    assert service.overview(period_code="2026-II").kpis.expiring_soon == 1

    with factory.begin() as session:
        certification = session.scalar(
            select(Certification).where(Certification.credential_name == "Cloud Practitioner")
        )
        certification.expires_on = date(2030, 1, 1)

    assert service.overview(period_code="2026-II").kpis.expiring_soon == 1
    engine.dispose()


def test_evolution_does_not_include_snapshots_after_requested_cutoff():
    engine, factory = _analytics_fixture()
    future_cutoff = date(2026, 9, 14)
    with factory.begin() as session:
        period = session.scalar(select(AcademicPeriod).where(AcademicPeriod.code == "2026-II"))
        session.add(
            FactStudentPeriod(
                student_key="anonymous-001",
                period_id=period.id,
                cutoff_date=future_cutoff,
                cohort="2024",
                cycle="V",
                enrollment_status="ACTIVE",
                certification_count=0,
                approved_certification_count=0,
            )
        )

    result = AnalyticsService(factory).overview(
        period_code="2026-II", cutoff_date=date(2026, 9, 13)
    )
    assert [point.cutoff_date for point in result.evolution] == [date(2026, 9, 13)]
    engine.dispose()


def test_valid_snapshot_without_active_students_returns_zero_metrics():
    engine, factory = _analytics_fixture()
    with factory.begin() as session:
        for fact in session.scalars(select(FactStudentPeriod)).all():
            fact.enrollment_status = "INACTIVE"

    result = AnalyticsService(factory).overview(period_code="2026-II")
    assert result.kpis.active_students == 0
    assert result.kpis.certified_students == 0
    assert result.kpis.coverage_percent == 0
    assert result.kpis.approved_certifications == 0
    engine.dispose()


def test_indicator_endpoints_require_permission_and_never_return_student_keys():
    engine, factory = _analytics_fixture()
    app = create_app(
        settings=Settings(environment="test", log_level="WARNING"),
        analytics_service=AnalyticsService(factory),
    )
    admin = AuthenticatedUser(id=uuid4(), email="admin@virtual.upt.pe", role=Role.ADMIN)
    app.dependency_overrides[get_current_user] = lambda: admin

    with TestClient(app) as client:
        periods = client.get("/api/v1/indicators/periods")
        overview = client.get("/api/v1/indicators/overview", params={"period_code": "2026-II"})
        dictionary = client.get("/api/v1/indicators/dictionary")

    assert periods.status_code == 200
    assert periods.json()[0]["code"] == "2026-II"
    assert periods.json()[0]["latest_cutoff_date"] == "2026-09-13"
    assert overview.status_code == 200
    assert dictionary.status_code == 200
    assert "anonymous-" not in overview.text
    assert {item["id"] for item in dictionary.json()} == {
        "active_students", "certified_students", "coverage_percent", "approved_certifications", "expiring_soon"
    }
    engine.dispose()


def test_student_role_cannot_read_aggregate_indicators():
    engine, factory = _analytics_fixture()
    app = create_app(settings=Settings(environment="test", log_level="WARNING"), analytics_service=AnalyticsService(factory))
    student = AuthenticatedUser(id=uuid4(), email="student@virtual.upt.pe", role=Role.STUDENT)
    app.dependency_overrides[get_current_user] = lambda: student

    with TestClient(app) as client:
        response = client.get("/api/v1/indicators/overview", params={"period_code": "2026-II"})

    assert response.status_code == 403
    engine.dispose()
