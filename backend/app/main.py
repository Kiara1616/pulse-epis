"""FastAPI application factory for Pulse EPIS."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api.errors import (
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from .api.middleware import RequestIdMiddleware
from .api.routes.health import router as health_router
from .api.routes.meta import router as meta_router
from .core.config import Settings, get_settings
from .core.logging import configure_logging
from .repositories.readiness import ApplicationReadinessRepository, ReadinessRepository
from .services.health import HealthService


logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    readiness_repository: ReadinessRepository | None = None,
) -> FastAPI:
    """Create an isolated application instance for production or tests."""

    settings = settings or get_settings()
    configure_logging(settings.log_level)
    repository = readiness_repository or ApplicationReadinessRepository()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        logger.info(
            "Starting %s version=%s environment=%s",
            settings.app_name,
            settings.app_version,
            settings.environment,
        )
        yield
        logger.info("Stopping %s", settings.app_name)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="REST API base for the Pulse EPIS certification dashboard.",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.health_service = HealthService(settings, repository)

    app.add_middleware(RequestIdMiddleware)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    app.include_router(health_router)
    app.include_router(meta_router, prefix=settings.api_prefix)
    return app


app = create_app()
