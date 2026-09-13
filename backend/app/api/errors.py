"""Uniform error responses for the HTTP API."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException


logger = logging.getLogger(__name__)


class ErrorDetail(BaseModel):
    """A machine-readable detail associated with an API error."""

    loc: list[str | int] = Field(default_factory=list)
    message: str
    type: str


class ErrorResponse(BaseModel):
    """Stable error envelope returned by every handled API failure."""

    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)
    request_id: str


def get_request_id(request: Request) -> str:
    """Get the request ID assigned by the middleware."""

    return getattr(request.state, "request_id", "unknown")


def _validation_details(exc: RequestValidationError) -> list[ErrorDetail]:
    details: list[ErrorDetail] = []
    for error in exc.errors():
        details.append(
            ErrorDetail(
                loc=[part for part in error.get("loc", []) if isinstance(part, (str, int))],
                message=str(error.get("msg", "Invalid value")),
                type=str(error.get("type", "value_error")),
            )
        )
    return details


def _http_details(detail: Any) -> tuple[str, str, list[ErrorDetail]]:
    if isinstance(detail, dict):
        code = str(detail.get("code", "HTTP_ERROR"))
        message = str(detail.get("message", "Request failed"))
        raw_details = detail.get("details", [])
        if isinstance(raw_details, list):
            details = [
                ErrorDetail(
                    loc=[part for part in item.get("loc", []) if isinstance(part, (str, int))],
                    message=str(item.get("message", "Invalid value")),
                    type=str(item.get("type", "value_error")),
                )
                for item in raw_details
                if isinstance(item, dict)
            ]
        else:
            details = []
        return code, message, details

    if detail is None:
        return "HTTP_ERROR", "Request failed", []

    return "HTTP_ERROR", str(detail), []


def _response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details: list[ErrorDetail] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    request_id = get_request_id(request)
    response_headers = dict(headers or {})
    response_headers["X-Request-ID"] = request_id
    payload = ErrorResponse(
        code=code,
        message=message,
        details=details or [],
        request_id=request_id,
    )
    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(mode="json"),
        headers=response_headers,
    )


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    """Normalize HTTP exceptions, including framework-generated 404s."""

    code, message, details = _http_details(exc.detail)
    if exc.status_code == 404 and code == "HTTP_ERROR":
        code = "NOT_FOUND"
    return _response(
        request,
        status_code=exc.status_code,
        code=code,
        message=message,
        details=details,
        headers=dict(exc.headers or {}),
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Normalize Pydantic/FastAPI request validation failures."""

    return _response(
        request,
        status_code=422,
        code="VALIDATION_ERROR",
        message="Request validation failed",
        details=_validation_details(exc),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Hide internal details while keeping a correlation ID in the logs."""

    request_id = get_request_id(request)
    logger.exception("Unhandled API error request_id=%s", request_id)
    return _response(
        request,
        status_code=500,
        code="INTERNAL_SERVER_ERROR",
        message="An internal server error occurred",
    )
