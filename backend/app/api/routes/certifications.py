"""Student-scoped certification registration and private evidence endpoints."""

from __future__ import annotations

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

from ...auth.dependencies import require_permissions
from ...auth.models import AuthenticatedUser, Permission
from ...certifications.schemas import (
    CertificationCreateRequest,
    CertificationResponse,
    CertificationUpdateRequest,
    EvidenceAccessResponse,
    EvidenceResponse,
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


router = APIRouter(prefix="/certifications", tags=["certifications"])
_CERTIFICATION_READ = require_permissions(Permission.CERTIFICATION_READ_OWN)
_CERTIFICATION_WRITE = require_permissions(Permission.CERTIFICATION_WRITE_OWN)


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
    )


def _service(request: Request) -> CertificationServiceProtocol:
    return request.app.state.certification_service


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
    summary="Correct a pending or observed certification",
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
