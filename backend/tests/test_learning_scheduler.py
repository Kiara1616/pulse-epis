from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.learning.models import LearningAudit, LearningCatalogSource, LearningCourse
from backend.app.main import create_app
from backend.app.api.routes import learning as learning_routes


def _app_context(secret="catalog-scheduler-secret"):
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    settings = Settings(
        environment="test",
        auth_session_secret="learning-scheduler-test-secret",
        etl_scheduler_secret=secret,
        log_level="WARNING",
    )
    app = create_app(settings=settings)
    app.state.session_factory = factory
    return app, factory, engine


def test_weekly_radar_requires_shared_scheduler_secret():
    app, _, engine = _app_context()
    with TestClient(app) as client:
        response = client.post("/api/v1/learning/scheduled/sources")
    assert response.status_code == 401
    engine.dispose()


def test_weekly_radar_skips_when_no_authorized_feeds_are_configured():
    app, _, engine = _app_context()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/learning/scheduled/sources",
            headers={"X-Pulse-ETL-Secret": "catalog-scheduler-secret"},
        )
    assert response.status_code == 200
    assert response.json() == {
        "status": "SKIPPED",
        "reason": "NO_ACTIVE_SOURCES",
        "sources_checked": 0,
        "created": 0,
        "skipped": 0,
    }
    engine.dispose()


def test_weekly_radar_detects_courses_but_does_not_publish_them(monkeypatch):
    app, factory, engine = _app_context()
    source_id = uuid4()
    with factory.begin() as session:
        session.add(
            LearningCatalogSource(
                id=source_id,
                provider="Proveedor de prueba",
                feed_url="https://catalog.example/courses.json",
                format="JSON",
                default_skills=["Python"],
                default_requirements=["Fundamentos"],
                active=True,
            )
        )
    feed_row = {"title": "Curso de prueba", "url": "https://catalog.example/python", "skills": ["Python"]}
    monkeypatch.setattr(learning_routes, "source_rows", lambda _: iter([dict(feed_row)]))
    with TestClient(app) as client:
        headers = {"X-Pulse-ETL-Secret": "catalog-scheduler-secret"}
        response = client.post("/api/v1/learning/scheduled/sources", headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()["created"] == 1
        assert response.json()["results"][0]["status"] == "APPLIED"

        feed_row["title"] = "Título actualizado antes de revisión"
        refreshed = client.post("/api/v1/learning/scheduled/sources", headers=headers)
        assert refreshed.status_code == 200, refreshed.text
        assert refreshed.json()["updated"] == 1

        with factory.begin() as session:
            course = session.scalar(select(LearningCourse))
            course.status = "PUBLISHED"
        feed_row["title"] = "Título externo posterior"
        preserved = client.post("/api/v1/learning/scheduled/sources", headers=headers)
        assert preserved.status_code == 200, preserved.text
        assert preserved.json()["skipped"] == 1
    with factory() as session:
        course = session.scalar(select(LearningCourse))
        assert course is not None
        assert course.status == "PUBLISHED"
        assert course.title == "Título actualizado antes de revisión"
        refresh_audit = session.scalar(select(LearningAudit).where(LearningAudit.action == "REFRESH"))
        assert refresh_audit is not None
        assert refresh_audit.before["title"] == "Curso de prueba"
        assert refresh_audit.after["title"] == "Título actualizado antes de revisión"
        assert session.scalar(select(func.count()).select_from(LearningAudit)) == 5
    engine.dispose()
