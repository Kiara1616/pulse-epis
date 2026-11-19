"""Student-scoped certification registration and private evidence endpoints."""

from __future__ import annotations

from urllib.parse import quote
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy import func, or_, select

from ...auth.dependencies import require_permissions
from ...auth.models import AuthenticatedUser, Permission, Role
from ...certifications.schemas import (
    CertificationCreateRequest,
    CertificationResponse,
    CertificationUpdateRequest,
    EvidenceAccessResponse,
    EvidenceResponse,
    IssuerOption,
    SkillResponse,
)
from ...certifications.service import (
    CertificationDraft,
    CertificationDuplicate,
    CertificationInvalid,
    CertificationNotCorrectable,
    CertificationNotFound,
    CertificationServiceProtocol,
    CertificationServiceUnavailable,
    EvidenceAccessDenied,
    EvidenceDuplicate,
    EvidenceFileTooLarge,
    EvidenceNotFound,
    SkillInput,
    StudentNotProvisioned,
)
from ...db.models import AcademicPeriod, Certification, Enrollment, Issuer, Student, User
from ...issuer_catalog.service import is_unresolved_issuer
from ...learning.models import LearningCourse
from ...integrations.apify import ApifyIntegrationError
from ...linkedin.schemas import (
    LinkedInBatchItemResponse,
    LinkedInBatchRequest,
    LinkedInBatchResponse,
    LinkedInProfileResponse,
    LinkedInProfileUpdate,
    LinkedInSyncResponse,
)
from ...linkedin.service import (
    LinkedInServiceProtocol,
    LinkedInServiceUnavailable,
    LinkedInSyncCooldown,
)


router = APIRouter(prefix="/certifications", tags=["certifications"])
_CERTIFICATION_READ = require_permissions(Permission.CERTIFICATION_READ_OWN)
_CERTIFICATION_WRITE = require_permissions(Permission.CERTIFICATION_WRITE_OWN)
_LINKEDIN_BATCH = require_permissions(Permission.CERTIFICATION_VALIDATE)


def _http_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def _certification_response(item) -> CertificationResponse:
    return CertificationResponse(
        id=item.id,
        issuer_id=item.issuer_id,
        issuer_name=item.issuer_name,
        issuer_url=item.issuer_url,
        credential_name=item.credential_name,
        external_id=item.external_id,
        issued_on=item.issued_on,
        expires_on=item.expires_on,
        status=item.status,
        source_url=item.source_url,
        skills=[SkillResponse(id=skill.id, name=skill.name, level=skill.level) for skill in item.skills],
        evidences=[
            EvidenceResponse(
                id=evidence.id,
                evidence_type=evidence.evidence_type,
                source_url=evidence.source_url,
                original_filename=evidence.original_filename,
                content_type=evidence.content_type,
                byte_size=evidence.byte_size,
                sha256=evidence.sha256,
                retention_until=evidence.retention_until,
                uploaded_at=evidence.uploaded_at,
            )
            for evidence in item.evidences
        ],
        created_at=item.created_at,
        updated_at=item.updated_at,
        correction_allowed=item.correction_allowed,
        latest_comment=item.latest_comment,
        source_kind=item.source_kind,
        source_external_id=item.source_external_id,
    )


def _service(request: Request) -> CertificationServiceProtocol:
    return request.app.state.certification_service


def _linkedin_service(request: Request) -> LinkedInServiceProtocol:
    return request.app.state.linkedin_service


def _linkedin_response(item) -> LinkedInProfileResponse:
    return LinkedInProfileResponse(
        linkedin_url=item.linkedin_url,
        consent_at=item.consent_at,
        last_sync_at=item.last_sync_at,
        sync_status=item.sync_status,
        sync_error=item.sync_error,
        pending_candidates=item.pending_candidates,
    )


def _changes(payload: CertificationUpdateRequest) -> dict[str, object]:
    values: dict[str, object] = {}
    for field_name in payload.model_fields_set:
        value = getattr(payload, field_name)
        if field_name == "skills":
            if value is None:
                values[field_name] = None
            else:
                values[field_name] = tuple(
                    SkillInput(name=skill.name, level=skill.level) for skill in value
                )
        else:
            values[field_name] = value
    return values


@router.post(
    "",
    response_model=CertificationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_CERTIFICATION_WRITE)],
    summary="Register a certification for the authenticated student",
)
def create_certification(
    payload: CertificationCreateRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_WRITE),
) -> CertificationResponse:
    service = _service(request)
    draft = CertificationDraft(
        issuer_id=payload.issuer_id,
        issuer_name=payload.issuer_name,
        issuer_url=payload.issuer_url,
        credential_name=payload.credential_name,
        external_id=payload.external_id,
        issued_on=payload.issued_on,
        expires_on=payload.expires_on,
        source_url=payload.source_url,
        skills=tuple(SkillInput(name=skill.name, level=skill.level) for skill in payload.skills),
    )
    try:
        return _certification_response(service.create_certification(current_user.id, draft))
    except StudentNotProvisioned as exc:
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "STUDENT_NOT_PROVISIONED",
            "The account is not linked to an authorized student",
        ) from exc
    except CertificationDuplicate as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            "DUPLICATE_RECORD",
            "The certification already exists",
        ) from exc
    except CertificationInvalid as exc:
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            str(exc),
        ) from exc
    except CertificationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "CERTIFICATION_UNAVAILABLE",
            "The certification service is unavailable",
        ) from exc


@router.get(
    "/issuers",
    response_model=list[IssuerOption],
    dependencies=[Depends(_CERTIFICATION_READ)],
    summary="List issuer options published by the learning catalog",
)
def list_issuer_options(
    request: Request,
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_READ),
) -> list[IssuerOption]:
    """Return canonical issuer choices for the student certification form.

    The learning radar is the source of authorization: published course providers
    are exposed as selectable issuers. Existing issuer rows are reused when the
    names match; a missing row is created when the student submits the catalog
    choice, preserving compatibility with legacy certification records.
    """

    factory = request.app.state.session_factory
    if factory is None:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "CERTIFICATION_UNAVAILABLE",
            "The certification service is unavailable",
        )
    with factory() as session:
        published_courses = list(
            session.scalars(
                select(LearningCourse)
                .where(LearningCourse.status == "PUBLISHED")
                .order_by(LearningCourse.provider, LearningCourse.title)
            )
        )
        issuer_rows = list(
            session.scalars(
                select(Issuer)
                .where(Issuer.is_active.is_(True))
                .order_by(Issuer.name)
            )
        )
        existing = {item.name.casefold(): item for item in issuer_rows}
        options: dict[str, IssuerOption] = {}
        for course in published_courses:
            key = course.provider.strip().casefold()
            issuer = existing.get(key)
            options[key] = IssuerOption(
                id=issuer.id if issuer else None,
                name=issuer.name if issuer else course.provider.strip(),
                website_url=issuer.website_url if issuer else course.source_url,
                logo_url=issuer.logo_url if issuer else None,
            )
        # Do not block legacy environments that have issuer records but have not
        # yet published a radar course. The UI still uses a select, never free text.
        for issuer in issuer_rows:
            if is_unresolved_issuer(issuer.name):
                continue
            options.setdefault(
                issuer.name.casefold(),
                IssuerOption(
                    id=issuer.id,
                    name=issuer.name,
                    website_url=issuer.website_url,
                    logo_url=issuer.logo_url,
                ),
            )
        return sorted(options.values(), key=lambda item: item.name.casefold())


@router.get(
    "",
    response_model=list[CertificationResponse],
    dependencies=[Depends(_CERTIFICATION_READ)],
    summary="List certifications owned by the authenticated student",
)
def list_certifications(
    request: Request,
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_READ),
) -> list[CertificationResponse]:
    try:
        return [_certification_response(item) for item in _service(request).list_own(current_user.id)]
    except CertificationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "CERTIFICATION_UNAVAILABLE",
            "The certification service is unavailable",
        ) from exc


@router.get(
    "/linkedin/profile",
    response_model=LinkedInProfileResponse,
    dependencies=[Depends(_CERTIFICATION_READ)],
    summary="Read the signed-in student's LinkedIn consent and sync state",
)
def get_linkedin_profile(
    request: Request,
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_READ),
) -> LinkedInProfileResponse:
    try:
        return _linkedin_response(_linkedin_service(request).get_profile(current_user.id))
    except StudentNotProvisioned as exc:
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "STUDENT_NOT_PROVISIONED",
            "The account is not linked to an authorized student",
        ) from exc
    except LinkedInServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "LINKEDIN_UNAVAILABLE",
            str(exc),
        ) from exc


@router.put(
    "/linkedin/profile",
    response_model=LinkedInProfileResponse,
    dependencies=[Depends(_CERTIFICATION_WRITE)],
    summary="Save or replace the signed-in student's LinkedIn URL",
)
def update_linkedin_profile(
    payload: LinkedInProfileUpdate,
    request: Request,
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_WRITE),
) -> LinkedInProfileResponse:
    try:
        return _linkedin_response(
            _linkedin_service(request).update_profile(current_user.id, payload.linkedin_url)
        )
    except ValueError as exc:
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "INVALID_LINKEDIN_URL",
            str(exc),
        ) from exc
    except StudentNotProvisioned as exc:
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "STUDENT_NOT_PROVISIONED",
            "The account is not linked to an authorized student",
        ) from exc
    except LinkedInServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "LINKEDIN_UNAVAILABLE",
            str(exc),
        ) from exc


@router.post(
    "/linkedin/sync",
    response_model=LinkedInSyncResponse,
    dependencies=[Depends(_CERTIFICATION_WRITE)],
    summary="Extract public LinkedIn evidence and queue it for validation",
)
def sync_linkedin_profile(
    request: Request,
    force: bool = Query(default=False),
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_WRITE),
) -> LinkedInSyncResponse:
    try:
        report = _linkedin_service(request).sync_profile(current_user.id, force=force)
        return LinkedInSyncResponse(
            profile_candidates=report.profile_candidates,
            publication_candidates=report.publication_candidates,
            created=report.created,
            updated=report.updated,
            duplicates=report.duplicates,
            status=report.status,
            message=report.message,
        )
    except (ValueError, LinkedInSyncCooldown) as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT if isinstance(exc, LinkedInSyncCooldown) else status.HTTP_422_UNPROCESSABLE_ENTITY,
            "SYNC_COOLDOWN" if isinstance(exc, LinkedInSyncCooldown) else "LINKEDIN_URL_REQUIRED",
            str(exc),
        ) from exc
    except StudentNotProvisioned as exc:
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "STUDENT_NOT_PROVISIONED",
            "The account is not linked to an authorized student",
        ) from exc
    except ApifyIntegrationError as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "APIFY_UNAVAILABLE",
            str(exc),
        ) from exc
    except LinkedInServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "LINKEDIN_UNAVAILABLE",
            str(exc),
        ) from exc


@router.get(
    "/linkedin/batch/students",
    dependencies=[Depends(_LINKEDIN_BATCH)],
    summary="List roster students and their LinkedIn synchronization state",
)
def list_linkedin_batch_students(
    request: Request,
    period_code: str | None = Query(default=None, max_length=32),
    cycle: str | None = Query(default=None, max_length=32),
    sync_status: str = Query(default="ALL", pattern="^(ALL|NO_URL|NEVER|RUNNING|SUCCEEDED|PARTIAL|FAILED)$"),
    q: str = Query(default="", max_length=120),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
) -> dict[str, object]:
    """Expose only the metadata needed to select a controlled extraction batch."""

    factory = request.app.state.session_factory
    if factory is None:
        raise _http_error(503, "LINKEDIN_UNAVAILABLE", "El padrón no está disponible.")
    with factory() as session:
        if not period_code:
            period_code = session.scalar(
                select(AcademicPeriod.code)
                .join(Enrollment, Enrollment.period_id == AcademicPeriod.id)
                .order_by(AcademicPeriod.starts_on.desc())
                .limit(1)
            )
        if not period_code:
            return {"period_code": None, "total": 0, "items": []}

        query = (
            select(Student, User, Enrollment, AcademicPeriod)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .join(AcademicPeriod, AcademicPeriod.id == Enrollment.period_id)
            .outerjoin(User, User.id == Student.user_id)
            .where(AcademicPeriod.code == period_code.strip().upper())
        )
        if cycle:
            query = query.where(Enrollment.cycle == cycle.strip())
        if sync_status == "NO_URL":
            query = query.where(Student.linkedin_url.is_(None))
        elif sync_status != "ALL":
            query = query.where(Student.linkedin_sync_status == sync_status)
        if q.strip():
            term = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            query = query.where(
                or_(
                    Student.student_code.ilike(term, escape="\\"),
                    Student.full_name.ilike(term, escape="\\"),
                    User.email.ilike(term, escape="\\"),
                )
            )
        total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = session.execute(
            query.order_by(Student.full_name, Student.student_code, Student.id)
            .offset(offset)
            .limit(limit)
        ).all()
        student_ids = [student.id for student, _, _, _ in rows]
        pending_by_student: dict[UUID, int] = {}
        if student_ids:
            pending_rows = session.execute(
                select(Certification.student_id, func.count(Certification.id))
                .where(
                    Certification.student_id.in_(student_ids),
                    Certification.source_kind.in_(
                        ("LINKEDIN_PROFILE", "LINKEDIN_PUBLICATION")
                    ),
                    Certification.status.in_(
                        ("PENDING", "UNDER_REVIEW", "OBSERVED", "RESUBMITTED")
                    ),
                )
                .group_by(Certification.student_id)
            ).all()
            pending_by_student = {student_id: int(count) for student_id, count in pending_rows}
        return {
            "period_code": period_code.strip().upper(),
            "total": int(total),
            "items": [
                {
                    "id": str(student.id),
                    "code": student.student_code,
                    "name": student.full_name,
                    "email": user.email if user else None,
                    "cycle": enrollment.cycle,
                    "cohort": enrollment.cohort,
                    "status": enrollment.status,
                    "linkedin_url": student.linkedin_url,
                    "linkedin_sync_status": student.linkedin_sync_status,
                    "linkedin_last_sync_at": student.linkedin_last_sync_at,
                    "linkedin_sync_error": student.linkedin_sync_error,
                    "pending_candidates": pending_by_student.get(student.id, 0),
                    "selectable": bool(student.linkedin_url and student.user_id),
                }
                for student, user, enrollment, _ in rows
            ],
        }


@router.post(
    "/linkedin/batch/sync",
    response_model=LinkedInBatchResponse,
    dependencies=[Depends(_LINKEDIN_BATCH)],
    summary="Synchronize an explicitly selected, bounded student batch",
)
def sync_linkedin_batch(
    payload: LinkedInBatchRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(_LINKEDIN_BATCH),
) -> LinkedInBatchResponse:
    try:
        items = request.app.state.linkedin_service.sync_students(
            current_user.id,
            payload.student_ids,
            force=payload.force,
            include_publications=payload.include_publications,
        )
    except ValueError as exc:
        raise _http_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "LINKEDIN_BATCH_LIMIT", str(exc)) from exc
    except LinkedInServiceUnavailable as exc:
        raise _http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "LINKEDIN_UNAVAILABLE", str(exc)) from exc
    except ApifyIntegrationError as exc:
        raise _http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "APIFY_UNAVAILABLE", str(exc)) from exc

    response_items = [
        LinkedInBatchItemResponse(
            student_id=item.student_id,
            status=item.status,
            message=item.message,
            profile_candidates=item.profile_candidates,
            publication_candidates=item.publication_candidates,
            created=item.created,
            updated=item.updated,
            duplicates=item.duplicates,
        )
        for item in items
    ]
    processed = sum(item.status in {"SUCCEEDED", "PARTIAL"} for item in items)
    skipped = sum(item.status == "SKIPPED" for item in items)
    failed = sum(item.status == "FAILED" for item in items)
    return LinkedInBatchResponse(
        requested=len(items),
        processed=processed,
        skipped=skipped,
        failed=failed,
        items=response_items,
        message="Lote completado. Los resultados nuevos quedaron pendientes de validación.",
    )


@router.get(
    "/reference-preview",
    dependencies=[Depends(_CERTIFICATION_READ)],
    summary="Read the reference history linked to the signed-in student account",
)
def reference_preview(
    request: Request,
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_READ),
) -> dict[str, object]:
    if current_user.role != Role.STUDENT:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", "Only student accounts can read this view")
    if not (
        request.app.state.settings.local_auth_enabled
        or request.app.state.settings.demo_analytics_enabled
    ):
        raise _http_error(404, "NOT_FOUND", "No hay registros vinculados a esta cuenta.")
    from ...analytics.demo import reference_student_profile

    profile = reference_student_profile(current_user.email)
    if profile is None:
        raise _http_error(404, "NOT_FOUND", "No hay registros vinculados a esta cuenta.")
    return profile


@router.get(
    "/{certification_id}",
    response_model=CertificationResponse,
    dependencies=[Depends(_CERTIFICATION_READ)],
    summary="Read one certification owned by the authenticated student",
)
def get_certification(
    certification_id: UUID,
    request: Request,
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_READ),
) -> CertificationResponse:
    try:
        item = _service(request).get_own(current_user.id, certification_id)
        return _certification_response(item)
    except CertificationNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Certification not found") from exc
    except CertificationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "CERTIFICATION_UNAVAILABLE",
            "The certification service is unavailable",
        ) from exc


@router.patch(
    "/{certification_id}",
    response_model=CertificationResponse,
    dependencies=[Depends(_CERTIFICATION_WRITE)],
    summary="Correct a pending, observed or resubmitted certification",
)
def update_certification(
    certification_id: UUID,
    payload: CertificationUpdateRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_WRITE),
) -> CertificationResponse:
    try:
        item = _service(request).update_own(
            current_user.id,
            certification_id,
            _changes(payload),
        )
        return _certification_response(item)
    except CertificationNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Certification not found") from exc
    except CertificationNotCorrectable as exc:
        raise _http_error(status.HTTP_409_CONFLICT, "CORRECTION_NOT_ALLOWED", str(exc)) from exc
    except CertificationDuplicate as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            "DUPLICATE_RECORD",
            "The certification already exists",
        ) from exc
    except CertificationInvalid as exc:
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            str(exc),
        ) from exc
    except CertificationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "CERTIFICATION_UNAVAILABLE",
            "The certification service is unavailable",
        ) from exc


@router.post(
    "/{certification_id}/evidence",
    response_model=EvidenceResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_CERTIFICATION_WRITE)],
    summary="Attach a URL or private file to an owned certification",
)
def add_evidence(
    certification_id: UUID,
    request: Request,
    source_url: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_WRITE),
) -> EvidenceResponse:
    if file is not None and source_url and source_url.strip():
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "EVIDENCE_INPUT",
            "Provide either a URL or a file, not both",
        )
    service = _service(request)
    try:
        if file is not None:
            content = file.file.read(request.app.state.settings.evidence_max_bytes + 1)
            item = service.add_file_evidence(
                current_user.id,
                certification_id,
                filename=file.filename or "",
                content_type=file.content_type or "",
                content=content,
            )
        elif source_url and source_url.strip():
            item = service.add_url_evidence(
                current_user.id,
                certification_id,
                source_url,
            )
        else:
            raise _http_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "EVIDENCE_INPUT",
                "Provide a URL or a file",
            )
        return EvidenceResponse(
            id=item.id,
            evidence_type=item.evidence_type,
            source_url=item.source_url,
            original_filename=item.original_filename,
            content_type=item.content_type,
            byte_size=item.byte_size,
            sha256=item.sha256,
            retention_until=item.retention_until,
            uploaded_at=item.uploaded_at,
        )
    except (CertificationNotFound, EvidenceNotFound) as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Certification not found") from exc
    except EvidenceDuplicate as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            "DUPLICATE_RECORD",
            "The evidence already exists",
        ) from exc
    except EvidenceFileTooLarge as exc:
        raise _http_error(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "FILE_TOO_LARGE",
            str(exc),
        ) from exc
    except CertificationInvalid as exc:
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "EVIDENCE_UNSUPPORTED",
            str(exc),
        ) from exc
    except CertificationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "EVIDENCE_UNAVAILABLE",
            "The evidence service is unavailable",
        ) from exc


@router.post(
    "/{certification_id}/evidence/{evidence_id}/access",
    response_model=EvidenceAccessResponse,
    dependencies=[Depends(_CERTIFICATION_READ)],
    summary="Issue a temporary private evidence URL",
)
def create_evidence_access(
    certification_id: UUID,
    evidence_id: UUID,
    request: Request,
    current_user: AuthenticatedUser = Depends(_CERTIFICATION_READ),
) -> EvidenceAccessResponse:
    try:
        access = _service(request).create_evidence_access(
            current_user.id,
            certification_id,
            evidence_id,
        )
        access_url = str(
            request.url_for("download_evidence", evidence_id=str(evidence_id))
        )
        return EvidenceAccessResponse(
            evidence_id=access.evidence_id,
            access_url=f"{access_url}?token={access.token}",
            expires_at=access.expires_at,
        )
    except EvidenceNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Evidence not found") from exc
    except EvidenceAccessDenied as exc:
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "EVIDENCE_ACCESS_DENIED",
            "The evidence retention period has expired",
        ) from exc
    except CertificationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "EVIDENCE_UNAVAILABLE",
            "The evidence service is unavailable",
        ) from exc


@router.get(
    "/evidence/{evidence_id}/download",
    name="download_evidence",
    summary="Download or redirect to evidence through a temporary URL",
)
def download_evidence(
    evidence_id: UUID,
    request: Request,
    token: str = Query(min_length=20),
) -> Response:
    try:
        item = _service(request).download_evidence(evidence_id, token)
        if item.evidence_type == "URL":
            return RedirectResponse(
                url=item.source_url or "/",
                status_code=status.HTTP_307_TEMPORARY_REDIRECT,
                headers={"Cache-Control": "private, no-store"},
            )
        if item.content is not None:
            disposition = (
                "inline"
                if item.content_type == "application/pdf"
                or (item.content_type or "").startswith("image/")
                else "attachment"
            )
            encoded_filename = quote(item.original_filename or "evidence", safe="")
            return Response(
                content=item.content,
                media_type=item.content_type or "application/octet-stream",
                headers={
                    "Cache-Control": "private, no-store",
                    "Content-Disposition": (
                        f"{disposition}; filename*=UTF-8''{encoded_filename}"
                    ),
                    "X-Content-Type-Options": "nosniff",
                },
            )
        if item.path is None:
            raise _http_error(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "EVIDENCE_UNAVAILABLE",
                "The evidence service is unavailable",
            )
        return FileResponse(
            path=item.path,
            media_type=item.content_type or "application/octet-stream",
            filename=item.original_filename,
            # Browsers can render the supported evidence formats in the
            # validator preview. Unknown types remain downloads.
            content_disposition_type="inline"
            if item.content_type == "application/pdf"
            or (item.content_type or "").startswith("image/")
            else "attachment",
            headers={
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
    except EvidenceAccessDenied as exc:
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "EVIDENCE_ACCESS_DENIED",
            "The evidence access URL is invalid or expired",
        ) from exc
    except CertificationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "EVIDENCE_UNAVAILABLE",
            "The evidence service is unavailable",
        ) from exc


__all__ = ["router"]
