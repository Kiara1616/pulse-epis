"""Versioned API metadata endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request

from ...api.schemas import ApiInfoResponse


router = APIRouter(tags=["meta"])


@router.get("/", response_model=ApiInfoResponse, summary="Describe the API instance")
def api_info(request: Request) -> ApiInfoResponse:
    settings = request.app.state.settings
    return ApiInfoResponse(
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        api_prefix=settings.api_prefix,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
