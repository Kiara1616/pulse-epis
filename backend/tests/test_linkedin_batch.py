"""Controlled LinkedIn batch selection does not spend Apify for ineligible rows."""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import AcademicPeriod, Enrollment, Student, User
from backend.app.db.session import create_session_factory
from backend.app.main import create_app


def test_batch_listing_and_skip_are_available_to_validator_without_cost_metadata(tmp_path):
    db = f"sqlite+pysqlite:///{(tmp_path / 'linkedin-batch.db').as_posix()}"
    factory = create_session_factory(db)
    Base.metadata.create_all(factory.kw["bind"])
    settings = Settings(
        environment="test",
        database_url=db,
        auth_provider="local",
        local_auth_seed=True,
        evidence_storage_path=str(tmp_path / "evidence"),
        log_level="WARNING",
    )
    app = create_app(settings=settings)

    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/local/login",
            json={"email": "admin@local.pulse-epis.test", "password": "pulse-local-demo"},
        )
        assert login.status_code == 200
        with factory.begin() as session:
            period = AcademicPeriod(
                code="2026-II",
                name="2026-II",
                starts_on=date(2026, 8, 17),
                ends_on=date(2026, 12, 18),
                status="OPEN",
            )
            session.add(period)
            session.flush()
            student = session.scalar(
                select(Student).join(User, User.id == Student.user_id).where(
                    User.email == "student@local.pulse-epis.test"
                )
            )
            assert student is not None
            session.add(
                Enrollment(
                    student_id=student.id,
                    period_id=period.id,
                    status="ACTIVE",
                    cycle="VIII",
                    school="EPIS",
                )
            )
        listing = client.get(
            "/api/v1/certifications/linkedin/batch/students",
            params={"period_code": "2026-II", "cycle": "VIII"},
        )
        assert listing.status_code == 200
        body = listing.json()
        assert "cost" not in body
        assert body["total"] == 1
        item = body["items"][0]
        assert item["linkedin_sync_status"] == "NEVER"
        assert item["selectable"] is False

        validator_login = client.post(
            "/api/v1/auth/local/login",
            json={"email": "validator@local.pulse-epis.test", "password": "pulse-local-demo"},
        )
        assert validator_login.status_code == 200
        run = client.post(
            "/api/v1/certifications/linkedin/batch/sync",
            json={"student_ids": [item["id"]]},
        )
        assert run.status_code == 200
        assert run.json()["skipped"] == 1
        assert run.json()["items"][0]["status"] == "SKIPPED"
