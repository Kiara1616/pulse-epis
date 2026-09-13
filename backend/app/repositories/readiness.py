"""Readiness adapters used by the service layer."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from ..domain.health import HealthCheck


class ReadinessRepository(Protocol):
    """Contract for checks against dependencies needed by the API."""

    def check(self) -> HealthCheck:
        """Return the current dependency status."""


@dataclass(frozen=True)
class ApplicationReadinessRepository:
    """Check the bootstrapped application until persistence is added in issue #10."""

    available: bool = True

    def check(self) -> HealthCheck:
        if self.available:
            return HealthCheck(
                name="application",
                status="ok",
                detail="Application configuration loaded",
            )
        return HealthCheck(
            name="application",
            status="error",
            detail="Application dependency is unavailable",
        )
