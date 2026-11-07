from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.db.base import Base
from backend.app.db import models as _db_models  # register related foreign key tables
from backend.app.learning import discovery
from backend.app.learning.models import LearningCourse, LearningDiscoverySource


def test_discovery_creates_review_candidates_and_never_publishes(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    source = LearningDiscoverySource(id=uuid4(), name="Academia", url="https://example.org/cursos.xml", kind="RSS", active=True, terms_reviewed_at=discovery.datetime.now(discovery.timezone.utc))
    with Session(engine) as session:
        with session.begin():
            session.add(source)

        def fake_public_https(url):
            return url

        def fake_fetch(url, allowed_host=None, redirects=0):
            if url.endswith("robots.txt"):
                return 200, b"User-agent: *\nAllow: /"
            return 200, b"<rss><channel><item><title>Curso de SQL</title><link>https://example.org/sql</link></item><item><title>Fuera de dominio</title><link>https://other.org/x</link></item></channel></rss>"

        monkeypatch.setattr(discovery, "public_https", fake_public_https)
        monkeypatch.setattr(discovery, "fetch", fake_fetch)
        with session.begin():
            result = discovery.scan(session, source)
        assert result == {"detected": 1, "updated": 0, "scanned": 1}
        item = session.scalar(select(LearningCourse))
        assert item.title == "Curso de SQL"
        assert item.status == "DETECTED"
        assert item.skills == ["Por revisar"]
        session.commit()
        with session.begin():
            second = discovery.scan(session, source)
        assert second["detected"] == 0
        assert session.query(LearningCourse).count() == 1


def test_discovery_obeys_robots(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    source = LearningDiscoverySource(id=uuid4(), name="Academia", url="https://example.org/cursos.xml", kind="RSS", active=True, terms_reviewed_at=discovery.datetime.now(discovery.timezone.utc))
    monkeypatch.setattr(discovery, "public_https", lambda url: url)
    monkeypatch.setattr(discovery, "fetch", lambda url, allowed_host=None, redirects=0: (200, b"User-agent: *\nDisallow: /"))
    with Session(engine) as session:
        with pytest.raises(ValueError, match="robots.txt"):
            discovery.scan(session, source)
        assert session.query(LearningCourse).count() == 0
