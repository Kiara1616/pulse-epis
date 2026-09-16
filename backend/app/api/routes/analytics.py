"""Aggregate-only dashboard indicators and metric definitions."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ...analytics.schemas import AnalyticsOverview, AnalyticsPeriod, MetricDefinition
from ...analytics.service import (
    AnalyticsPeriodNotFound,
    AnalyticsServiceProtocol,
    AnalyticsSnapshotNotFound,
    AnalyticsUnavailable,
)
from ...auth.dependencies import require_permissions
from ...auth.models import Permission


router = APIRouter(prefix="/indicators", tags=["indicators"])
_ANALYTICS_READ = require_permissions(Permission.ANALYTICS_READ)


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.get("/overview", response_model=AnalyticsOverview, dependencies=[Depends(_ANALYTICS_READ)])
def overview(
    request: Request,
    period_code: str = Query(min_length=1, max_length=32),
    cutoff_date: date | None = None,
    cohort: str | None = Query(default=None, max_length=32),
    cycle: str | None = Query(default=None, max_length=32),
    issuer: str | None = Query(default=None, max_length=150),
    level: str | None = Query(default=None, max_length=50),
) -> AnalyticsOverview:
    service: AnalyticsServiceProtocol = request.app.state.analytics_service
    try:
        return service.overview(period_code=period_code, cutoff_date=cutoff_date, cohort=cohort, cycle=cycle, issuer=issuer, level=level)
    except AnalyticsPeriodNotFound as exc:
        raise _error(status.HTTP_404_NOT_FOUND, "PERIOD_NOT_FOUND", "Academic period was not found") from exc
    except AnalyticsSnapshotNotFound as exc:
        raise _error(status.HTTP_404_NOT_FOUND, "SNAPSHOT_NOT_FOUND", "No published snapshot matches the filters") from exc
    except AnalyticsUnavailable as exc:
        raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "ANALYTICS_UNAVAILABLE", "Analytics are unavailable") from exc


@router.get("/periods", response_model=list[AnalyticsPeriod], dependencies=[Depends(_ANALYTICS_READ)])
def periods(request: Request) -> list[AnalyticsPeriod]:
    service: AnalyticsServiceProtocol = request.app.state.analytics_service
    try:
        return list(service.periods())
    except AnalyticsUnavailable as exc:
        raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "ANALYTICS_UNAVAILABLE", "Analytics are unavailable") from exc


@router.get("/dictionary", response_model=list[MetricDefinition], dependencies=[Depends(_ANALYTICS_READ)])
def dictionary(request: Request) -> tuple[MetricDefinition, ...]:
    return request.app.state.analytics_service.dictionary()


__all__ = ["router"]
