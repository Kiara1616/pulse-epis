from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.main import create_app


def test_scheduled_etl_requires_separate_secret():
    settings = Settings(environment="test", auth_session_secret="test-session-secret",
                        etl_scheduler_secret="test-etl-scheduler-secret")
    client = TestClient(create_app(settings))
    url = "/api/v1/etl/scheduled"

    assert client.post(url).status_code == 401
    assert client.post(url, headers={"X-Pulse-ETL-Secret": "wrong"}).status_code == 401
    # The valid key reaches the ETL service; the isolated test has no database.
    assert client.post(url, headers={"X-Pulse-ETL-Secret": "test-etl-scheduler-secret"}).status_code == 503


def test_scheduled_etl_disabled_without_configuration():
    client = TestClient(create_app(Settings(environment="test", auth_session_secret="test-session-secret")))
    assert client.post("/api/v1/etl/scheduled").status_code == 503
