"""Domain objects for service health and readiness."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


CheckStatus = Literal["ok", "error"]
OverallStatus = Literal["ok", "degraded"]


@dataclass(frozen=True)
class HealthCheck:
    name: str
    status: CheckStatus
    detail: str


@dataclass(frozen=True)
class HealthReport:
    status: OverallStatus
    service: str
    version: str
    environment: str
    checks: tuple[HealthCheck, ...]
