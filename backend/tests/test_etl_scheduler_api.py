from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.main import create_app


def test_scheduled_etl_requires_separate_secret(monkeypatch):
    settings = Settings(environment="test", auth_session_secret="test-session-secret",
                        etl_scheduler_secret="test-etl-scheduler-secret")
    app = create_app(settings)
    app.state.session_factory = lambda: None
    client = TestClient(app)
    url = "/api/v1/etl/scheduled"

    assert client.post(url).status_code == 401
    assert client.post(url, headers={"X-Pulse-ETL-Secret": "wrong"}).status_code == 401
    def no_open_period(_factory):
        raise ValueError("No hay un periodo abierto único")

    monkeypatch.setattr("backend.app.api.routes.etl.scheduled_target", no_open_period)
    response = client.post(url, headers={"X-Pulse-ETL-Secret": "test-etl-scheduler-secret"})
    assert response.status_code == 200
    assert response.json()["reason"] == "NO_UNIQUE_OPEN_PERIOD"


def test_scheduled_etl_disabled_without_configuration():
    client = TestClient(create_app(Settings(environment="test", auth_session_secret="test-session-secret")))
    assert client.post("/api/v1/etl/scheduled").status_code == 503
