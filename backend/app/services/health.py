"""Health and readiness use cases."""

from __future__ import annotations

import logging

from ..core.config import Settings
from ..domain.health import HealthCheck, HealthReport
from ..repositories.readiness import ReadinessRepository


logger = logging.getLogger(__name__)


class HealthService:
    """Build health reports without coupling HTTP concerns to repositories."""

    def __init__(self, settings: Settings, readiness_repository: ReadinessRepository) -> None:
        self._settings = settings
        self._readiness_repository = readiness_repository

    def liveness(self) -> HealthReport:
        return self._report(
            status="ok",
            checks=(HealthCheck("process", "ok", "API process is running"),),
        )

    def readiness(self) -> HealthReport:
        try:
            check = self._readiness_repository.check()
        except Exception:
            logger.exception("Readiness repository check failed")
            check = HealthCheck(
                name="application",
                status="error",
                detail="Application dependency check failed",
            )

        status = "ok" if check.status == "ok" else "degraded"
        return self._report(status=status, checks=(check,))

    def _report(self, *, status, checks: tuple[HealthCheck, ...]) -> HealthReport:
        return HealthReport(
            status=status,
            service=self._settings.app_name,
            version=self._settings.app_version,
            environment=self._settings.environment,
            checks=checks,
        )
