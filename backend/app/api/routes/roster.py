"""Authorized padrón upload and period-scoped import history endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status

from ...auth.dependencies import require_permissions
from ...auth.models import AuthenticatedUser, Permission
from ...roster.schemas import RosterImportHistoryResponse, RosterImportResponse, RosterPeriodCreate, RosterPeriodResponse
from ...roster.preview import preview_periods
from ...roster.service import (
    ImportHistory,
    ImportReport,
    RosterImportServiceProtocol,
    RosterPeriodNotFound,
    RosterServiceUnavailable,
)
from sqlalchemy import select, func, or_
from ...db.models import Student, User, Enrollment, AcademicPeriod


router = APIRouter(prefix="/padron", tags=["padron"])
_PADRON_ADMIN = require_permissions(Permission.PADRON_MANAGE)


@router.get("/students", dependencies=[Depends(_PADRON_ADMIN)])
def roster_students(request: Request, period_code: str | None = None,
                    q: str = Query(default="", max_length=120),
                    offset: int = Query(default=0, ge=0), limit: int = Query(default=25, ge=1, le=100)):
    factory = request.app.state.session_factory
    if factory is None:
        raise _http_error(503, "PADRON_UNAVAILABLE", "El padrón no está disponible.")
    with factory() as session:
        if not period_code:
            period_code = session.scalar(select(AcademicPeriod.code).join(Enrollment, Enrollment.period_id == AcademicPeriod.id)
                                         .order_by(AcademicPeriod.starts_on.desc()).limit(1))
        query = select(Student, User, Enrollment).join(Enrollment, Enrollment.student_id == Student.id).join(
            AcademicPeriod, AcademicPeriod.id == Enrollment.period_id).outerjoin(User, User.id == Student.user_id).where(AcademicPeriod.code == period_code)
        if q.strip():
            term = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            query = query.where(or_(Student.student_code.ilike(term, escape="\\"), User.email.ilike(term, escape="\\")))
        total = session.scalar(select(func.count()).select_from(query.subquery()))
        rows = session.execute(query.order_by(Student.student_code, Student.id).offset(offset).limit(limit)).all()
        return {"period_code": period_code, "total": total, "items": [
            {"id": str(s.id), "code": s.student_code, "email": u.email if u else None,
             "cycle": e.cycle, "cohort": e.cohort, "school": e.school, "plan": e.study_plan, "status": e.status}
            for s, u, e in rows]}


def _http_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def _report_response(report: ImportReport) -> RosterImportResponse:
    return RosterImportResponse(
        id=report.id,
        period_code=report.period_code,
        status=report.status,
        total_rows=report.total_rows,
        accepted_rows=report.accepted_rows,
        rejected_rows=report.rejected_rows,
        rejections=[
            {
                "row_number": rejection.row_number,
                "field_name": rejection.field_name,
                "reason_code": rejection.reason_code,
                "message": rejection.message,
            }
            for rejection in report.rejections
        ],
        idempotent=report.idempotent,
    )


def _history_response(history: ImportHistory) -> RosterImportHistoryResponse:
    return RosterImportHistoryResponse(
        id=history.id,
        period_code=history.period_code,
        status=history.status,
        total_rows=history.total_rows,
        accepted_rows=history.accepted_rows,
        rejected_rows=history.rejected_rows,
        created_at=history.created_at,
        completed_at=history.completed_at,
    )


@router.post(
    "/imports",
    response_model=RosterImportResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_PADRON_ADMIN)],
    summary="Import an authorized EPIS roster CSV",
)
def import_roster(
    request: Request,
    response: Response,
    period_code: str = Query(min_length=1, max_length=32),
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(_PADRON_ADMIN),
    selected_period_only: bool = False,
) -> RosterImportResponse:
    service: RosterImportServiceProtocol = request.app.state.roster_import_service
    settings = request.app.state.settings
    try:
        content = file.file.read(settings.roster_max_bytes + 1)
        if selected_period_only:
            groups = preview_periods(content, settings)
            if period_code.strip().upper() not in {g["code"] for g in groups}:
                raise ValueError("El CSV no contiene filas del periodo seleccionado.")
        report = service.import_csv(
            content,
            period_code=period_code,
            actor_user_id=current_user.id,
            selected_period_only=selected_period_only,
        )
    except ValueError as exc:
        raise _http_error(422, "INVALID_CSV", str(exc)) from exc
    except RosterPeriodNotFound as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            "NOT_FOUND",
            "The academic period is not provisioned",
        ) from exc
    except RosterServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "PADRON_UNAVAILABLE",
            "The roster service is unavailable",
        ) from exc
    if report.idempotent:
        response.status_code = status.HTTP_200_OK
    elif report.status == "REJECTED":
        response.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    return _report_response(report)


@router.get(
    "/imports",
    response_model=list[RosterImportHistoryResponse],
    dependencies=[Depends(_PADRON_ADMIN)],
    summary="List roster import history for an academic period",
)
def roster_import_history(
    request: Request,
    period_code: str = Query(min_length=1, max_length=32),
) -> list[RosterImportHistoryResponse]:
    service: RosterImportServiceProtocol = request.app.state.roster_import_service
    try:
        history = service.list_history(period_code=period_code)
    except RosterPeriodNotFound as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            "NOT_FOUND",
            "The academic period is not provisioned",
        ) from exc
    except RosterServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "PADRON_UNAVAILABLE",
            "The roster service is unavailable",
        ) from exc
    return [_history_response(item) for item in history]


__all__ = ["router"]


@router.get("/periods", response_model=list[RosterPeriodResponse], dependencies=[Depends(_PADRON_ADMIN)])
def roster_periods(request: Request):
    try:
        return request.app.state.roster_import_service.list_periods()
    except RosterServiceUnavailable as exc:
        raise _http_error(503, "PADRON_UNAVAILABLE", "El catálogo de periodos no está disponible.") from exc


@router.post("/periods", response_model=RosterPeriodResponse, status_code=201, dependencies=[Depends(_PADRON_ADMIN)])
def create_roster_period(request: Request, payload: RosterPeriodCreate):
    try:
        return request.app.state.roster_import_service.create_period(**payload.model_dump())
    except ValueError as exc:
        raise _http_error(409, "PERIOD_EXISTS", str(exc)) from exc
    except RosterServiceUnavailable as exc:
        raise _http_error(503, "PADRON_UNAVAILABLE", "El catálogo de periodos no está disponible.") from exc


@router.post("/preview", dependencies=[Depends(_PADRON_ADMIN)])
def preview_roster(request: Request, file: UploadFile = File(...)):
    settings = request.app.state.settings
    try:
        return preview_periods(file.file.read(settings.roster_max_bytes + 1), settings)
    except ValueError as exc:
        raise _http_error(422, "INVALID_CSV", str(exc)) from exc
