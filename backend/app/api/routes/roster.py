"""Authorized padrón upload and period-scoped import history endpoints."""

from __future__ import annotations

import csv
import hashlib
import io
import re
from collections import defaultdict
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy.exc import IntegrityError

from ...auth.dependencies import require_permissions
from ...auth.models import AuthenticatedUser, Permission
from ...roster.schemas import (
    RosterCandidateExclusion,
    RosterCandidateUpdate,
    RosterImportHistoryResponse,
    RosterImportResponse,
    RosterPeriodCreate,
    RosterPeriodResponse,
)
from ...roster.preview import preview_periods
from ...roster.parser import RosterFileError, parse_roster_candidate_upload
from ...roster.service import (
    ImportHistory,
    ImportReport,
    RosterImportServiceProtocol,
    RosterPeriodNotFound,
    RosterServiceUnavailable,
)
from sqlalchemy import select, func, or_
from ...db.models import (
    AcademicPeriod,
    AuditLog,
    Certification,
    Enrollment,
    Issuer,
    RosterCandidate,
    Student,
    User,
)


router = APIRouter(prefix="/padron", tags=["padron"])
_PADRON_ADMIN = require_permissions(Permission.PADRON_MANAGE)
_STUDENT_EMAIL = re.compile(r"^[^@\s]+@virtual\.upt\.pe$", re.IGNORECASE)


def _candidate_payload(candidate: RosterCandidate, period_code: str) -> dict[str, object]:
    return {
        "id": str(candidate.id),
        "period_code": period_code,
        "source_row": candidate.source_row,
        "source_name": candidate.source_name,
        "source_cycle": candidate.source_cycle,
        "name": candidate.name,
        "cycle": candidate.cycle,
        "email": candidate.email,
        "student_code": candidate.student_code,
        "school": candidate.school,
        "study_plan": candidate.study_plan,
        "student_status": candidate.student_status,
        "issue_code": candidate.issue_code,
        "state": candidate.state,
        "resolution_reason": candidate.resolution_reason,
        "created_at": candidate.created_at,
        "updated_at": candidate.updated_at,
    }


def _audit_candidate(session, actor_id: UUID, candidate: RosterCandidate, action: str, fields: list[str]) -> None:
    # Keep the audit trail useful without duplicating student names or contact details.
    session.add(
        AuditLog(
            actor_user_id=actor_id,
            action=action,
            entity_type="roster_candidate",
            entity_id=str(candidate.id),
            before_data=None,
            after_data={"changed_fields": fields, "state": candidate.state},
        )
    )


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
            query = query.where(or_(Student.student_code.ilike(term, escape="\\"), User.email.ilike(term, escape="\\"), Student.full_name.ilike(term, escape="\\")))
        total = session.scalar(select(func.count()).select_from(query.subquery()))
        rows = session.execute(query.order_by(Student.student_code, Student.id).offset(offset).limit(limit)).all()
        student_ids = [student.id for student, _, _ in rows]
        certification_by_student: dict[object, list[dict[str, object]]] = defaultdict(list)
        if student_ids:
            certification_rows = session.execute(
                select(Certification, Issuer)
                .join(Issuer, Issuer.id == Certification.issuer_id)
                .where(Certification.student_id.in_(student_ids))
                .order_by(
                    Certification.student_id,
                    Certification.issued_on.desc(),
                    Issuer.name,
                    Certification.id,
                )
            ).all()
            for certification, issuer in certification_rows:
                certification_by_student[certification.student_id].append(
                    {
                        "id": str(certification.id),
                        "issuer": issuer.name,
                        "credential_name": certification.credential_name,
                        "issued_on": certification.issued_on,
                        "expires_on": certification.expires_on,
                        "status": certification.status,
                    }
                )
        return {"period_code": period_code, "total": total, "items": [
            {"id": str(s.id), "code": s.student_code, "name": s.full_name, "email": u.email if u else None,
             "cycle": e.cycle, "cohort": e.cohort, "school": e.school, "plan": e.study_plan, "status": e.status,
             "certifications": certification_by_student.get(s.id, [])}
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
            filename=file.filename or "",
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
        return preview_periods(
            file.file.read(settings.roster_max_bytes + 1),
            settings,
            file.filename or "",
        )
    except ValueError as exc:
        raise _http_error(422, "INVALID_CSV", str(exc)) from exc


@router.post("/candidates/import", dependencies=[Depends(_PADRON_ADMIN)])
def import_roster_candidates(
    request: Request,
    period_code: str = Query(min_length=1, max_length=32),
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(_PADRON_ADMIN),
):
    """Load only the incomplete rows from the workbook's pending worksheet."""
    settings = request.app.state.settings
    content = file.file.read(settings.roster_max_bytes + 1)
    try:
        candidates = parse_roster_candidate_upload(
            content,
            filename=file.filename or "",
            period_code=period_code,
            settings=settings,
        )
    except RosterFileError as exc:
        raise _http_error(422, "INVALID_CANDIDATE_FILE", str(exc)) from exc

    factory = request.app.state.session_factory
    if factory is None:
        raise _http_error(503, "PADRON_UNAVAILABLE", "El padrón no está disponible.")
    source_hash = hashlib.sha256(content).hexdigest()
    added = existing = 0
    try:
        with factory.begin() as session:
            period = session.scalar(
                select(AcademicPeriod).where(AcademicPeriod.code == period_code.strip().upper())
            )
            if period is None:
                raise _http_error(404, "PERIOD_NOT_FOUND", "El periodo no está registrado.")
            for record in candidates:
                match = session.scalar(
                    select(RosterCandidate).where(
                        RosterCandidate.period_id == period.id,
                        RosterCandidate.source_sha256 == source_hash,
                        RosterCandidate.source_row == record.source_row,
                    )
                )
                if match is not None:
                    existing += 1
                    continue
                session.add(
                    RosterCandidate(
                        id=uuid4(),
                        period_id=period.id,
                        source_sha256=source_hash,
                        source_row=record.source_row,
                        source_name=record.name,
                        source_cycle=record.cycle,
                        name=record.name,
                        cycle=record.cycle,
                        email=record.email or None,
                        student_code=record.code or None,
                        school="EPIS",
                        study_plan=period.code,
                        student_status="ACTIVE",
                        issue_code=record.issue_code,
                        state="PENDING",
                        created_by=current_user.id,
                        updated_by=current_user.id,
                    )
                )
                added += 1
            if added:
                session.add(
                    AuditLog(
                        actor_user_id=current_user.id,
                        action="ROSTER_CANDIDATES_IMPORTED",
                        entity_type="roster_candidate_batch",
                        entity_id=period.code,
                        after_data={"source_sha256": source_hash, "added": added},
                    )
                )
    except IntegrityError as exc:
        raise _http_error(409, "CANDIDATE_IMPORT_CONFLICT", "La lista cambió durante la importación; vuelve a cargarla.") from exc
    return {
        "period_code": period_code.strip().upper(),
        "total_rows": len(candidates),
        "added": added,
        "already_registered": existing,
        "source_sha256": source_hash,
    }


@router.get("/candidates", dependencies=[Depends(_PADRON_ADMIN)])
def list_roster_candidates(
    request: Request,
    period_code: str = Query(min_length=1, max_length=32),
    state: str = Query(default="PENDING", pattern="^(PENDING|RESOLVED|EXCLUDED|ALL)$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
):
    factory = request.app.state.session_factory
    if factory is None:
        raise _http_error(503, "PADRON_UNAVAILABLE", "El padrón no está disponible.")
    with factory() as session:
        period = session.scalar(
            select(AcademicPeriod).where(AcademicPeriod.code == period_code.strip().upper())
        )
        if period is None:
            raise _http_error(404, "PERIOD_NOT_FOUND", "El periodo no está registrado.")
        stmt = select(RosterCandidate).where(RosterCandidate.period_id == period.id)
        count_stmt = select(func.count()).select_from(RosterCandidate).where(RosterCandidate.period_id == period.id)
        if state != "ALL":
            stmt = stmt.where(RosterCandidate.state == state)
            count_stmt = count_stmt.where(RosterCandidate.state == state)
        total = session.scalar(count_stmt) or 0
        rows = session.scalars(
            stmt.order_by(RosterCandidate.source_row, RosterCandidate.id).offset(offset).limit(limit)
        ).all()
        return {
            "period_code": period.code,
            "total": total,
            "items": [_candidate_payload(candidate, period.code) for candidate in rows],
        }


@router.put("/candidates/{candidate_id}", dependencies=[Depends(_PADRON_ADMIN)])
def update_roster_candidate(
    candidate_id: UUID,
    request: Request,
    payload: RosterCandidateUpdate,
    current_user: AuthenticatedUser = Depends(_PADRON_ADMIN),
):
    factory = request.app.state.session_factory
    settings = request.app.state.settings
    if factory is None:
        raise _http_error(503, "PADRON_UNAVAILABLE", "El padrón no está disponible.")
    values = payload.model_dump()
    email = values["email"].strip().casefold()
    code = values["student_code"].strip()
    if not _STUDENT_EMAIL.fullmatch(email):
        raise _http_error(422, "INVALID_STUDENT_EMAIL", "El correo debe pertenecer al dominio @virtual.upt.pe.")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{2,63}", code):
        raise _http_error(422, "INVALID_STUDENT_CODE", "El código de estudiante no tiene un formato válido.")
    email_code = re.search(r"\d{10}", email.split("@", 1)[0])
    if email_code and code != email_code.group(0):
        raise _http_error(422, "EMAIL_CODE_MISMATCH", "El código debe coincidir con los 10 dígitos del correo institucional.")
    allowed_schools = {value.casefold(): value for value in settings.allowed_roster_schools}
    school = allowed_schools.get(values["school"].strip().casefold())
    if school is None:
        raise _http_error(422, "INVALID_SCHOOL", "La escuela no está habilitada para este padrón.")
    values["email"] = email
    values["student_code"] = code
    values["school"] = school
    for field in ("name", "cycle", "study_plan"):
        values[field] = values[field].strip()
    with factory.begin() as session:
        candidate = session.scalar(
            select(RosterCandidate).where(RosterCandidate.id == candidate_id).with_for_update()
        )
        if candidate is None:
            raise _http_error(404, "CANDIDATE_NOT_FOUND", "El registro pendiente no existe.")
        if candidate.state != "PENDING":
            raise _http_error(409, "CANDIDATE_NOT_EDITABLE", "Solo se editan pendientes de conciliación.")
        fields = [
            "name", "cycle", "email", "student_code", "school", "study_plan", "student_status"
        ]
        changed = [field for field in fields if getattr(candidate, field) != values[field]]
        for field in fields:
            setattr(candidate, field, values[field])
        candidate.updated_by = current_user.id
        if changed:
            _audit_candidate(session, current_user.id, candidate, "ROSTER_CANDIDATE_UPDATED", changed)
        period = session.get(AcademicPeriod, candidate.period_id)
        return _candidate_payload(candidate, period.code)


@router.post("/candidates/{candidate_id}/reconcile", dependencies=[Depends(_PADRON_ADMIN)])
def reconcile_roster_candidate(
    candidate_id: UUID,
    request: Request,
    current_user: AuthenticatedUser = Depends(_PADRON_ADMIN),
):
    factory = request.app.state.session_factory
    if factory is None:
        raise _http_error(503, "PADRON_UNAVAILABLE", "El padrón no está disponible.")
    with factory() as session:
        candidate = session.get(RosterCandidate, candidate_id)
        if candidate is None:
            raise _http_error(404, "CANDIDATE_NOT_FOUND", "El registro pendiente no existe.")
        if candidate.state != "PENDING":
            raise _http_error(409, "CANDIDATE_NOT_PENDING", "El registro ya fue resuelto o excluido.")
        period = session.get(AcademicPeriod, candidate.period_id)
        row = {
            "code": candidate.student_code or "",
            "email": candidate.email or "",
            "school": candidate.school,
            "plan": candidate.study_plan,
            "cycle": candidate.cycle,
            "status": candidate.student_status,
            "period": period.code,
            "name": candidate.name,
        }
        period_code = period.code

    content_stream = io.StringIO(newline="")
    writer = csv.DictWriter(content_stream, fieldnames=["code", "email", "school", "plan", "cycle", "status", "period", "name"], lineterminator="\n")
    writer.writeheader()
    writer.writerow(row)
    service: RosterImportServiceProtocol = request.app.state.roster_import_service
    report = service.import_csv(
        content_stream.getvalue().encode("utf-8"),
        period_code=period_code,
        actor_user_id=current_user.id,
        selected_period_only=True,
        filename="candidate-resolution.csv",
    )
    if report.status != "APPLIED" or report.accepted_rows != 1:
        raise _http_error(
            409,
            "CANDIDATE_VALIDATION_FAILED",
            "No se pudo confirmar el registro. Revisa que correo, código y periodo no estén vinculados a otra cuenta.",
        )
    with factory.begin() as session:
        candidate = session.scalar(
            select(RosterCandidate).where(RosterCandidate.id == candidate_id).with_for_update()
        )
        if candidate is None or candidate.state != "PENDING":
            raise _http_error(409, "CANDIDATE_STATE_CHANGED", "El pendiente cambió durante la confirmación; actualiza la bandeja.")
        candidate.state = "RESOLVED"
        candidate.resolution_reason = "Confirmado por el administrador e incorporado al padrón del periodo."
        candidate.updated_by = current_user.id
        _audit_candidate(session, current_user.id, candidate, "ROSTER_CANDIDATE_RESOLVED", ["state"])
    return {"candidate_id": str(candidate_id), "period_code": period_code, "state": "RESOLVED", "import": _report_response(report)}


@router.post("/candidates/{candidate_id}/exclude", dependencies=[Depends(_PADRON_ADMIN)])
def exclude_roster_candidate(
    candidate_id: UUID,
    request: Request,
    payload: RosterCandidateExclusion,
    current_user: AuthenticatedUser = Depends(_PADRON_ADMIN),
):
    factory = request.app.state.session_factory
    if factory is None:
        raise _http_error(503, "PADRON_UNAVAILABLE", "El padrón no está disponible.")
    reason = " ".join(payload.reason.split())
    if len(reason) < 5:
        raise _http_error(422, "INVALID_EXCLUSION_REASON", "Indica un motivo de al menos cinco caracteres.")
    with factory.begin() as session:
        candidate = session.scalar(
            select(RosterCandidate).where(RosterCandidate.id == candidate_id).with_for_update()
        )
        if candidate is None:
            raise _http_error(404, "CANDIDATE_NOT_FOUND", "El registro pendiente no existe.")
        if candidate.state != "PENDING":
            raise _http_error(409, "CANDIDATE_NOT_PENDING", "Solo se excluyen pendientes de conciliación.")
        candidate.state = "EXCLUDED"
        candidate.resolution_reason = reason
        candidate.updated_by = current_user.id
        _audit_candidate(session, current_user.id, candidate, "ROSTER_CANDIDATE_EXCLUDED", ["state", "resolution_reason"])
        period = session.get(AcademicPeriod, candidate.period_id)
        return _candidate_payload(candidate, period.code)
