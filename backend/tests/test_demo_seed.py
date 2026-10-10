from __future__ import annotations

from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.analytics.service import AnalyticsService
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import AcademicPeriod, Certification, EtlRun, FactStudentPeriod, Issuer, Student, User
from backend.app.db.session import create_session_factory
from backend.app.demo_seed import seed_demo_data
from backend.app.main import create_app


def test_demo_seed_is_idempotent_and_covers_focus_students(tmp_path: Path):
    database_url = f"sqlite+pysqlite:///{(tmp_path / 'demo-seed.db').as_posix()}"
    factory = create_session_factory(database_url)
    Base.metadata.create_all(factory.kw["bind"])
    settings = Settings(
        environment="test",
        database_url=database_url,
        roster_pseudonym_secret="test-roster-secret",
        evidence_access_secret="test-evidence-secret",
    )

    first = seed_demo_data(factory, settings)
    second = seed_demo_data(factory, settings)

    assert first.periods == second.periods == 14
    assert first.snapshots == second.snapshots == 14
    with Session(factory.kw["bind"]) as session:
        assert session.scalar(select(func.count()).select_from(AcademicPeriod)) == 14
        assert session.scalar(select(func.count()).select_from(FactStudentPeriod)) > 0
        focus_students = session.scalars(
            select(Student).where(
                Student.student_code.in_(["kz2023077087", "vl2023076796"])
            )
        ).all()
        assert len(focus_students) == 2
        for student in focus_students:
            assert student.user_id is not None
            assert session.scalar(
                select(func.count()).select_from(Certification).where(
                    Certification.student_id == student.id
                )
            ) == 5
        assert {
            user.email
            for user in session.scalars(
                select(User).where(
                    User.email.in_([
                        "kz2023077087@virtual.upt.pe",
                        "vl2023076796@virtual.upt.pe",
                    ])
                )
            ).all()
        } == {
            "kz2023077087@virtual.upt.pe",
            "vl2023076796@virtual.upt.pe",
        }

    overview = AnalyticsService(factory).overview(period_code="2026-II")
    assert {item.name for item in overview.by_issuer} == {
        "AWS",
        "Cisco",
        "Grafana",
        "Neo4j",
        "Oracle",
    }


def test_demo_seed_does_not_block_restart_on_pending_certification_without_skills(tmp_path: Path):
    database_url = f"sqlite+pysqlite:///{(tmp_path / 'demo-restart.db').as_posix()}"
    factory = create_session_factory(database_url)
    Base.metadata.create_all(factory.kw["bind"])
    settings = Settings(
        environment="test",
        database_url=database_url,
        demo_data_seed=True,
        roster_pseudonym_secret="test-roster-secret",
        evidence_access_secret="test-evidence-secret",
        log_level="WARNING",
    )

    seed_demo_data(factory, settings)
    with factory.begin() as session:
        student = session.scalar(
            select(Student).where(Student.student_code == "kz2023077087")
        )
        issuer = session.scalar(select(Issuer).where(Issuer.name == "AWS"))
        assert student is not None and issuer is not None
        session.add(
            Certification(
                id=uuid4(),
                student_id=student.id,
                issuer_id=issuer.id,
                credential_name="Operativa pendiente sin skill",
                external_id="OPS-PENDING-WITHOUT-SKILL",
                issued_on=date(2026, 9, 1),
                status="PENDING",
            )
        )

    for _ in range(2):
        app = create_app(settings=settings)
        with TestClient(app) as client:
            assert client.get("/ready").status_code == 200

    with Session(factory.kw["bind"]) as session:
        assert session.scalar(
            select(func.count()).select_from(Certification).where(
                Certification.external_id == "OPS-PENDING-WITHOUT-SKILL"
            )
        ) == 1
        assert session.scalar(
            select(func.count()).select_from(EtlRun).where(EtlRun.status == "REJECTED")
        ) > 0
