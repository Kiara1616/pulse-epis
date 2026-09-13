"""FastAPI application factory for Pulse EPIS."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware

from .api.routes.auth import router as auth_router
from .api.routes.certifications import router as certifications_router
from .api.routes.validations import router as validations_router
from .api.errors import (
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from .api.middleware import RequestIdMiddleware
from .api.routes.health import router as health_router
from .api.routes.meta import router as meta_router
from .api.routes.roster import router as roster_router
from .auth.oidc import GoogleOidcClient, OidcClient
from .auth.service import AuthService
from .auth.store import (
    SqlAlchemyUserDirectory,
    UnavailableUserDirectory,
    UserDirectory,
)
from .certifications.service import (
    CertificationService,
    CertificationServiceProtocol,
    UnavailableCertificationService,
)
from .core.config import Settings, get_settings
from .core.logging import configure_logging
from .db.session import create_session_factory
from .repositories.readiness import ApplicationReadinessRepository, ReadinessRepository
from .roster.service import (
    RosterImportService,
    RosterImportServiceProtocol,
    UnavailableRosterImportService,
)
from .services.health import HealthService
from .validation.service import (
    UnavailableValidationService,
    ValidationService,
    ValidationServiceProtocol,
)


logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    readiness_repository: ReadinessRepository | None = None,
    user_directory: UserDirectory | None = None,
    oidc_client: OidcClient | None = None,
    roster_import_service: RosterImportServiceProtocol | None = None,
    certification_service: CertificationServiceProtocol | None = None,
    validation_service: ValidationServiceProtocol | None = None,
) -> FastAPI:
    """Create an isolated application instance for production or tests."""

    settings = settings or get_settings()
    configure_logging(settings.log_level)
    repository = readiness_repository or ApplicationReadinessRepository()
    session_factory = (
        create_session_factory(settings.database_url) if settings.database_url else None
    )
    if user_directory is None:
        if session_factory is not None:
            user_directory = SqlAlchemyUserDirectory(session_factory)
        else:
            user_directory = UnavailableUserDirectory()
    oidc_client = oidc_client or GoogleOidcClient(settings)
    if roster_import_service is None:
        if session_factory is not None:
            roster_import_service = RosterImportService(session_factory, settings)
        else:
            roster_import_service = UnavailableRosterImportService()
    if certification_service is None:
        if session_factory is not None:
            certification_service = CertificationService(session_factory, settings)
        else:
            certification_service = UnavailableCertificationService()
    if validation_service is None:
        if session_factory is not None:
            validation_service = ValidationService(session_factory, settings)
        else:
            validation_service = UnavailableValidationService()

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
    app.state.user_directory = user_directory
    app.state.oidc_client = oidc_client
    app.state.auth_service = AuthService(settings, user_directory)
    app.state.roster_import_service = roster_import_service
    app.state.certification_service = certification_service
    app.state.validation_service = validation_service

    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.auth_session_secret.get_secret_value(),
        session_cookie=settings.auth_session_cookie,
        max_age=settings.auth_session_max_age,
        https_only=settings.auth_cookie_secure,
        same_site=settings.auth_cookie_samesite,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestIdMiddleware)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    app.include_router(health_router)
    app.include_router(meta_router, prefix=settings.api_prefix)
    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(roster_router, prefix=settings.api_prefix)
    app.include_router(certifications_router, prefix=settings.api_prefix)
    app.include_router(validations_router, prefix=settings.api_prefix)
    return app


app = create_app()
