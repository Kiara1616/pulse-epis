"""Aggregate-only dashboard indicators and metric definitions."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from ...analytics.pdf_report import generate_pdf
from ...analytics.excel_report import generate_excel

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

def _service(request: Request, dataset: str):
    if dataset == "demo":
        if not request.app.state.settings.local_auth_enabled:
            raise _error(403, "DEMO_DISABLED", "La demostración solo está disponible en el entorno local.")
        from ...analytics.demo import demo_analytics
        return demo_analytics()
    return request.app.state.analytics_service


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
    dataset: Literal["registered", "demo"] = "registered",
) -> AnalyticsOverview:
    service: AnalyticsServiceProtocol = _service(request, dataset)
    try:
        result = service.overview(period_code=period_code, cutoff_date=cutoff_date, cohort=cohort, cycle=cycle, issuer=issuer, level=level)
        return result.model_copy(update={"dataset": dataset})
    except AnalyticsPeriodNotFound as exc:
        raise _error(status.HTTP_404_NOT_FOUND, "PERIOD_NOT_FOUND", "Academic period was not found") from exc
    except AnalyticsSnapshotNotFound as exc:
        raise _error(status.HTTP_404_NOT_FOUND, "SNAPSHOT_NOT_FOUND", "Este periodo o fecha todavía no tiene indicadores publicados. Consulta una publicación disponible o publícala desde Administración.") from exc
    except AnalyticsUnavailable as exc:
        raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "ANALYTICS_UNAVAILABLE", "Analytics are unavailable") from exc


@router.get("/periods", response_model=list[AnalyticsPeriod], dependencies=[Depends(_ANALYTICS_READ)])
def periods(request: Request, dataset: Literal["registered", "demo"] = "registered") -> list[AnalyticsPeriod]:
    service: AnalyticsServiceProtocol = _service(request, dataset)
    try:
        return list(service.periods())
    except AnalyticsUnavailable as exc:
        raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "ANALYTICS_UNAVAILABLE", "Analytics are unavailable") from exc


@router.get("/dictionary", response_model=list[MetricDefinition], dependencies=[Depends(_ANALYTICS_READ)])
def dictionary(request: Request) -> tuple[MetricDefinition, ...]:
    return request.app.state.analytics_service.dictionary()


__all__ = ["router"]

@router.get("/report.xlsx", dependencies=[Depends(_ANALYTICS_READ)])
def excel_report(request: Request, period_code: str = Query(min_length=1,max_length=32), cutoff_date: date | None = None,
                 cohort: str | None = None, cycle: str | None = None, issuer: str | None = None,
                 dataset: Literal["registered", "demo"] = "registered"):
    data = overview(request,period_code,cutoff_date,cohort,cycle,issuer,None,dataset)
    return Response(generate_excel(data.model_dump(mode="json")), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition":'attachment; filename="pulse-epis-reporte.xlsx"'})


@router.get("/report.pdf", dependencies=[Depends(_ANALYTICS_READ)])
def pdf_report(request: Request, period_code: str = Query(min_length=1, max_length=32), cutoff_date: date | None = None,
               cohort: str | None = None, cycle: str | None = None, issuer: str | None = None, level: str | None = None,
               dataset: Literal["registered", "demo"] = "registered"):
    data = overview(request, period_code, cutoff_date, cohort, cycle, issuer, level, dataset)
    return Response(generate_pdf(data.model_dump(mode="json")), media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="pulse-epis-reporte.pdf"'})
