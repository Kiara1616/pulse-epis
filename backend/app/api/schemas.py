"""Pydantic response schemas exposed by the API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: Literal["ok", "error"]
    detail: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    service: str
    version: str
    environment: str
    checks: dict[str, HealthCheckResponse] = Field(default_factory=dict)
    request_id: str | None = None


class ApiInfoResponse(BaseModel):
    service: str
    version: str
    environment: str
    api_prefix: str
    docs_url: str
    openapi_url: str
