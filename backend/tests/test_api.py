from typing import Annotated

from fastapi import Query
from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.main import create_app
from backend.app.repositories.readiness import ApplicationReadinessRepository


def make_settings() -> Settings:
    return Settings(environment="test", log_level="WARNING")


def test_settings_are_loaded_from_pulse_environment_variables(monkeypatch):
    monkeypatch.setenv("PULSE_ENVIRONMENT", "staging")
    monkeypatch.setenv("PULSE_API_PREFIX", "api/internal/")
    monkeypatch.setenv("PULSE_LOG_LEVEL", "debug")

    settings = Settings()

    assert settings.environment == "staging"
    assert settings.api_prefix == "/api/internal"
    assert settings.log_level == "DEBUG"


def test_health_returns_liveness_and_request_id():
    with TestClient(create_app(settings=make_settings())) as client:
        response = client.get("/health", headers={"X-Request-ID": "health-test"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "health-test"
    assert response.json() == {
        "status": "ok",
        "service": "Pulse EPIS API",
        "version": "0.1.0",
        "environment": "test",
        "checks": {"process": {"status": "ok", "detail": "API process is running"}},
        "request_id": "health-test",
    }


def test_ready_returns_service_unavailable_when_dependency_is_down():
    app = create_app(
        settings=make_settings(),
        readiness_repository=ApplicationReadinessRepository(available=False),
    )

    with TestClient(app) as client:
        response = client.get("/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["checks"]["application"]["status"] == "error"
    assert response.headers["X-Request-ID"] == response.json()["request_id"]


def test_openapi_and_versioned_metadata_are_available():
    with TestClient(create_app(settings=make_settings())) as client:
        metadata = client.get("/api/v1/")
        openapi = client.get("/openapi.json")

    assert metadata.status_code == 200
    assert metadata.json()["api_prefix"] == "/api/v1"
    assert openapi.status_code == 200
    assert "/health" in openapi.json()["paths"]
    assert "/ready" in openapi.json()["paths"]


def test_http_and_validation_errors_use_the_same_envelope():
    app = create_app(settings=make_settings())

    @app.get("/_test-validation")
    def test_validation(value: Annotated[int, Query(gt=0)]):
        return {"value": value}

    with TestClient(app) as client:
        not_found = client.get("/missing", headers={"X-Request-ID": "not-found-test"})
        invalid = client.get("/_test-validation", params={"value": "0"})

    assert not_found.status_code == 404
    assert not_found.json()["code"] == "NOT_FOUND"
    assert not_found.json()["request_id"] == "not-found-test"
    assert {"code", "message", "details", "request_id"} == set(invalid.json())
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "VALIDATION_ERROR"
    assert invalid.json()["details"]
