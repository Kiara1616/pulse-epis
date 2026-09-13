"""Authorized padrón upload and period-scoped import history endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status

from ...auth.dependencies import require_permissions
from ...auth.models import AuthenticatedUser, Permission
from ...roster.schemas import RosterImportHistoryResponse, RosterImportResponse
from ...roster.service import (
    ImportHistory,
    ImportReport,
    RosterImportServiceProtocol,
    RosterPeriodNotFound,
    RosterServiceUnavailable,
)


router = APIRouter(prefix="/padron", tags=["padron"])
_PADRON_ADMIN = require_permissions(Permission.PADRON_MANAGE)


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
) -> RosterImportResponse:
    service: RosterImportServiceProtocol = request.app.state.roster_import_service
    settings = request.app.state.settings
    try:
        content = file.file.read(settings.roster_max_bytes + 1)
        report = service.import_csv(
            content,
            period_code=period_code,
            actor_user_id=current_user.id,
        )
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
