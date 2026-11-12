from __future__ import annotations

import json
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import date
from pydantic import SecretStr

from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.learning.models import LearningAudit, LearningCatalogSource, LearningCourse, LearningOpportunity
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
        "updated": 0,
        "retired": 0,
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
    monkeypatch.setattr(learning_routes, "source_rows", lambda *_: iter([dict(feed_row)]))
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


def test_datacamp_catalog_sends_server_secret_only_to_official_catalog(monkeypatch):
    _, _, engine = _app_context()
    settings = Settings(
        environment="test",
        auth_session_secret="datacamp-catalog-test-secret",
        datacamp_catalog_api_token="datacamp-private-token",
        log_level="WARNING",
    )
    source = LearningCatalogSource(
        provider="DataCamp",
        feed_url="https://lms-catalog-api.datacamp.com/v1/catalog/live-courses",
        format="JSON",
        default_skills=["Python"],
        default_requirements=[],
        active=True,
    )
    payload = json.dumps([
        {"title": "Introduction to Python", "url": "https://www.datacamp.com/courses/intro-to-python"}
    ]).encode("utf-8")
    captured = {}

    class Response:
        headers = {"Content-Length": str(len(payload))}

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def raise_for_status(self):
            return None

        def iter_content(self, chunk_size):
            assert chunk_size == 65_536
            yield payload

    def get(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return Response()

    monkeypatch.setattr(learning_routes, "_ensure_public_feed_host", lambda _url: None)
    monkeypatch.setattr(learning_routes.requests, "get", get)
    rows = list(learning_routes.source_rows(source, settings))

    assert captured["url"] == source.feed_url
    assert captured["headers"]["Authorization"] == "Bearer datacamp-private-token"
    assert rows[0]["title"] == "Introduction to Python"

    captured.clear()
    public_source = LearningCatalogSource(
        provider="Fuente pública",
        feed_url="https://catalog.example/courses.json",
        format="JSON",
        default_skills=["Python"],
        default_requirements=[],
        active=True,
    )
    list(learning_routes.source_rows(public_source, settings))
    assert "Authorization" not in captured["headers"]
    engine.dispose()


def test_datacamp_catalog_requires_server_secret_without_network_call(monkeypatch):
    source = LearningCatalogSource(
        provider="DataCamp",
        feed_url="https://lms-catalog-api.datacamp.com/v1/catalog/live-courses",
        format="JSON",
        default_skills=["Python"],
        default_requirements=[],
        active=True,
    )
    settings = Settings(environment="test", auth_session_secret="datacamp-catalog-test-secret")
    monkeypatch.setattr(learning_routes, "_ensure_public_feed_host", lambda _url: None)
    monkeypatch.setattr(
        learning_routes.requests,
        "get",
        lambda *_args, **_kwargs: pytest.fail("unexpected network request"),
    )

    with pytest.raises(HTTPException) as error:
        list(learning_routes.source_rows(source, settings))

    assert error.value.status_code == 422
    assert error.value.detail["code"] == "CATALOG_CREDENTIAL_MISSING"


def test_weekly_radar_maps_datacamp_catalog_field_aliases(monkeypatch):
    app, factory, engine = _app_context()
    source_id = uuid4()
    with factory.begin() as session:
        session.add(
            LearningCatalogSource(
                id=source_id,
                provider="DataCamp",
                feed_url="https://lms-catalog-api.datacamp.com/v1/catalog/live-courses",
                format="JSON",
                default_skills=[],
                default_requirements=["Programación básica"],
                active=True,
            )
        )
    def rows(_source, _settings, feed_url=None):
        if feed_url and feed_url.endswith("/archived-courses"):
            return iter([])
        return iter([{
            "name": "Python for Data Analysis",
            "launchUrl": "https://www.datacamp.com/courses/python-data-analysis",
            "topics": [{"name": "Python"}, {"name": "Análisis de datos"}],
        }])

    monkeypatch.setattr(learning_routes, "source_rows", rows)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/learning/scheduled/sources",
            headers={"X-Pulse-ETL-Secret": "catalog-scheduler-secret"},
        )
    assert response.status_code == 200, response.text
    assert response.json()["created"] == 1
    with factory() as session:
        course = session.scalar(select(LearningCourse))
        assert course is not None
        assert course.title == "Python for Data Analysis"
        assert course.source_url == "https://www.datacamp.com/courses/python-data-analysis"
        assert course.skills == ["Python", "Análisis de datos"]
        assert course.requirements == ["Programación básica"]
        assert course.status == "DETECTED"
    engine.dispose()


def test_weekly_datacamp_archive_retires_offer_and_preserves_audit(monkeypatch):
    app, factory, engine = _app_context()
    app.state.settings.datacamp_catalog_api_token = SecretStr("datacamp-test-token")
    source_id = uuid4()
    course_id = uuid4()
    offer_id = uuid4()
    course_url = "https://www.datacamp.com/courses/archived-course"
    with factory.begin() as session:
        session.add(LearningCatalogSource(
            id=source_id,
            provider="DataCamp",
            feed_url="https://lms-catalog-api.datacamp.com/v1/catalog/live-courses",
            format="JSON",
            default_skills=["Python"],
            default_requirements=[],
            active=True,
        ))
        session.add(LearningCourse(
            id=course_id,
            title="Archived course",
            provider="DataCamp",
            source_url=course_url,
            checked_on=date(2026, 1, 1),
            requirements=[],
            skills=["Python"],
            status="PUBLISHED",
        ))
        session.add(LearningOpportunity(
            id=offer_id,
            course_id=course_id,
            title="Archived course for students",
            cycles=["VIII"],
            relevance="Official course for advanced students.",
            status="PUBLISHED",
        ))

    monkeypatch.setattr(learning_routes, "_ensure_public_feed_host", lambda _url: None)
    monkeypatch.setattr(learning_routes, "source_rows", lambda _source, _settings, feed_url=None: iter(
        [{"title": "Archived course", "url": course_url}] if feed_url and feed_url.endswith("/archived-courses") else []
    ))
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/learning/scheduled/sources",
            headers={"X-Pulse-ETL-Secret": "catalog-scheduler-secret"},
        )
    assert response.status_code == 200, response.text
    assert response.json()["retired"] == 1
    with factory() as session:
        course = session.get(LearningCourse, course_id)
        offer = session.get(LearningOpportunity, offer_id)
        assert course.status == "RETIRED"
        assert offer.status == "RETIRED"
        course_audit = session.scalar(select(LearningAudit).where(
            LearningAudit.entity_id == course_id,
            LearningAudit.action == "ARCHIVED",
        ))
        offer_audit = session.scalar(select(LearningAudit).where(
            LearningAudit.entity_id == offer_id,
            LearningAudit.action == "RETIRED",
        ))
        assert course_audit is not None
        assert offer_audit is not None
        assert course_audit.before["status"] == "PUBLISHED"
        assert offer_audit.before["status"] == "PUBLISHED"
    engine.dispose()
