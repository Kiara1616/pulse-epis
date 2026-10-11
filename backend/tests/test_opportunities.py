from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from backend.app.main import create_app
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.auth.dependencies import get_current_user
from backend.app.auth.models import AuthenticatedUser, Role

PAYLOAD = dict(title="IA aplicada", provider="Proveedor demo", source_url="https://example.org/ia",
    area="IA", level="Inicial", skills=[" Python ", "python", "evaluación"],
    prerequisites="Python básico", rationale="Introducción para desarrollo con IA", checked_on="2026-01-01", cost_pen=None)

def setup():
    app = create_app(Settings(environment="test", auth_session_secret="test-secret", log_level="WARNING"))
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    app.state.session_factory = sessionmaker(bind=engine)
    return app, TestClient(app)

def actor(app, role):
    user = AuthenticatedUser(id=uuid4(), email="demo@example.org", role=role)
    app.dependency_overrides[get_current_user] = lambda: user
    return user

def test_permission_persistence_review_and_duplicate():
    app, client = setup()
    assert client.get("/api/v1/opportunities").status_code == 401
    for role in (Role.STUDENT, Role.VALIDATOR):
        actor(app, role)
        assert client.get("/api/v1/opportunities").status_code == 403
        assert client.post("/api/v1/opportunities", json=PAYLOAD).status_code == 403
        assert client.post(f"/api/v1/opportunities/{uuid4()}/decision", json={"status":"PUBLISHED", "reason":"Validado en fuente"}).status_code == 403
    user = actor(app, Role.ADMIN)
    response = client.post("/api/v1/opportunities", json=PAYLOAD)
    assert response.status_code == 201
    item = response.json()
    assert item["skills"] == ["python", "evaluación"]
    assert item["status"] == "DRAFT"
    assert client.post("/api/v1/opportunities", json=PAYLOAD).status_code == 409
    path = f'/api/v1/opportunities/{item["id"]}/decision'
    assert client.post(path, json={"status":"PUBLISHED", "reason":"corto"}).status_code == 422
    assert client.post(path, json={"status":"PUBLISHED", "reason":"Contenido revisado en fuente"}).status_code == 200
    assert client.post(path, json={"status":"PUBLISHED", "reason":"Contenido revisado en fuente"}).status_code == 409
    assert client.post(path, json={"status":"RETIRED", "reason":"Oferta ya no disponible"}).status_code == 200
    assert client.post(path, json={"status":"PUBLISHED", "reason":"Contenido revisado en fuente"}).status_code == 409
    stored = client.get("/api/v1/opportunities").json()[0]
    assert stored["status"] == "RETIRED"
    assert len(stored["history"]) == 3
    assert stored["history"][1]["actor_id"] == str(user.id)
    assert stored["cost_pen"] is None

@pytest.mark.parametrize("change", [{"source_url":"http://example.org"}, {"source_url":"https://user:password@example.org"}, {"skills":[" "]}, {"cost_pen":-1}, {"checked_on":"2099-01-01"}, {"area":"invalid"}])
def test_invalid_sources(change):
    app, client = setup()
    actor(app, Role.ADMIN)
    assert client.post("/api/v1/opportunities", json={**PAYLOAD, **change}).status_code == 422
    assert client.get("/api/v1/opportunities").json() == []
