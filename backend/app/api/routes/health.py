"""Liveness and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from ...api.schemas import HealthCheckResponse, HealthResponse
from ...services.health import HealthService


router = APIRouter(tags=["health"])


def _get_health_service(request: Request) -> HealthService:
    return request.app.state.health_service


def _to_response(report, request: Request) -> HealthResponse:
    return HealthResponse(
        status=report.status,
        service=report.service,
        version=report.version,
        environment=report.environment,
        checks={
            check.name: HealthCheckResponse(status=check.status, detail=check.detail)
            for check in report.checks
        },
        request_id=getattr(request.state, "request_id", None),
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check whether the API process is alive",
)
def health(request: Request) -> HealthResponse:
    """Return a liveness report without requiring external services."""

    report = _get_health_service(request).liveness()
    return _to_response(report, request)


@router.get(
    "/ready",
    response_model=HealthResponse,
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": HealthResponse,
            "description": "The API is alive but not ready to serve traffic.",
        }
    },
    summary="Check whether the API is ready to serve traffic",
)
def ready(request: Request) -> HealthResponse | JSONResponse:
    """Return readiness and use HTTP 503 when a dependency is unavailable."""

    response = _to_response(_get_health_service(request).readiness(), request)
    if response.status == "degraded":
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=response.model_dump(mode="json"),
            headers={"X-Request-ID": response.request_id or "unknown"},
        )
    return response
