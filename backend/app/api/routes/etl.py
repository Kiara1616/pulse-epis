"""Administrator publication of reproducible, period-scoped indicators."""
from datetime import date
from hmac import compare_digest
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...auth.dependencies import require_permissions
from ...auth.models import AuthenticatedUser, Permission
from ...db.models import AcademicPeriod, RosterImport
from ...etl.service import EtlService, EtlInvalid, EtlPeriodNotFound
from backend.scripts_etl.main import scheduled_target

router = APIRouter(prefix="/etl", tags=["etl"], dependencies=[Depends(require_permissions(Permission.PERIOD_MANAGE))])
scheduler_router = APIRouter(prefix="/etl", tags=["etl"])


class PublicationRequest(BaseModel):
    period_code: str = Field(min_length=1, max_length=32)
    cutoff_date: date


def service(request: Request) -> EtlService:
    factory = request.app.state.session_factory
    if factory is None:
        raise HTTPException(503, detail={"code": "ETL_UNAVAILABLE", "message": "La base de datos no está disponible."})
    return EtlService(factory)


@scheduler_router.post("/scheduled")
def publish_scheduled(request: Request, x_pulse_etl_secret: str | None = Header(default=None)):
    configured = request.app.state.settings.etl_scheduler_secret
    if configured is None or not configured.get_secret_value():
        raise HTTPException(503, detail={"code": "SCHEDULER_UNAVAILABLE", "message": "ETL programado no configurado."})
    if not x_pulse_etl_secret or not compare_digest(x_pulse_etl_secret, configured.get_secret_value()):
        raise HTTPException(401, detail={"code": "SCHEDULER_UNAUTHORIZED", "message": "Credencial de ejecución no válida."})
    etl = service(request)
    try:
        period_code, cutoff_date = scheduled_target(request.app.state.session_factory)
    except ValueError as exc:
        return {"status": "SKIPPED", "reason": "NO_UNIQUE_OPEN_PERIOD", "message": str(exc)}
    with request.app.state.session_factory() as session:
        imported = session.scalar(select(RosterImport.id).join(AcademicPeriod, AcademicPeriod.id == RosterImport.period_id)
                                  .where(AcademicPeriod.code == period_code, RosterImport.status == "APPLIED"))
    if imported is None:
        return {"status": "SKIPPED", "reason": "ROSTER_REQUIRED", "period_code": period_code, "cutoff_date": cutoff_date.isoformat()}
    try:
        report = etl.run(period_code, cutoff_date)
    except (EtlInvalid, EtlPeriodNotFound) as exc:
        raise HTTPException(422, detail={"code": "INVALID_PUBLICATION", "message": str(exc)}) from exc
    if report.status != "APPLIED":
        raise HTTPException(422, detail={"code": "ETL_REJECTED", "run_id": str(report.id)})
    return report.to_dict()


@router.post("/runs", status_code=201)
def publish(request: Request, payload: PublicationRequest,
            actor: AuthenticatedUser = Depends(require_permissions(Permission.PERIOD_MANAGE))):
    etl = service(request)
    with request.app.state.session_factory() as session:
        imported = session.scalar(select(RosterImport.id).join(AcademicPeriod, AcademicPeriod.id == RosterImport.period_id)
                                  .where(AcademicPeriod.code == payload.period_code, RosterImport.status == "APPLIED"))
    if imported is None:
        raise HTTPException(422, detail={"code": "ROSTER_REQUIRED", "message": "Importa primero un padrón válido para este periodo."})
    try:
        return etl.run(payload.period_code, payload.cutoff_date, actor.id).to_dict()
    except (EtlInvalid, EtlPeriodNotFound) as exc:
        raise HTTPException(422, detail={"code": "INVALID_PUBLICATION", "message": str(exc)}) from exc


@router.get("/runs")
def history(request: Request, period_code: str):
    try:
        return [r.to_dict() for r in service(request).history(period_code)]
    except EtlPeriodNotFound as exc:
        raise HTTPException(404, detail={"code": "PERIOD_NOT_FOUND", "message": "El periodo no está registrado."}) from exc
