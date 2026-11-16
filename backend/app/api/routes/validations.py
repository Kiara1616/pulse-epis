"""Validator-only certification review and immutable history endpoints."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ...auth.dependencies import require_permissions
from ...auth.models import AuthenticatedUser, Permission
from ...issuer_catalog.schemas import IssuerCatalogResponse, IssuerResolutionResponse
from ...validation.schemas import (
    IssuerAssignmentRequest,
    IssuerRequestCreate,
    IssuerRequestResponse,
    ValidationDecisionRequest,
    ValidationDecisionResponse,
    ValidationEvidenceAccessResponse,
    ValidationEvidenceResponse,
    ValidationHistoryResponse,
    ValidationQueueResponse,
)
from ...issuer_catalog.service import (
    IssuerActorNotAllowed,
    IssuerCatalogConflict,
    IssuerCatalogInvalid,
    IssuerCatalogUnavailable,
    IssuerNotFound,
    IssuerRequestView,
)
from ...validation.service import (
    ValidationActorNotAllowed,
    ValidationCommentRequired,
    ValidationDecision,
    ValidationHistoryView,
    ValidationInvalid,
    ValidationNotFound,
    ValidationQueueItem,
    ValidationServiceProtocol,
    ValidationServiceUnavailable,
    ValidationTransitionNotAllowed,
)


router = APIRouter(prefix="/validations", tags=["validations"])
_VALIDATOR = require_permissions(Permission.CERTIFICATION_VALIDATE)
_REFERENCE_READ = require_permissions(Permission.ANALYTICS_READ)


def _http_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def _service(request: Request) -> ValidationServiceProtocol:
    return request.app.state.validation_service


def _queue_response(item: ValidationQueueItem) -> ValidationQueueResponse:
    return ValidationQueueResponse(
        id=item.id,
        student_name=item.student_name,
        student_key=item.student_key,
        credential_name=item.credential_name,
        issuer_name=item.issuer_name,
        issued_on=item.issued_on,
        expires_on=item.expires_on,
        stored_status=item.stored_status,
        status=item.status,
        source_url=item.source_url,
        evidences=[
            ValidationEvidenceResponse(
                id=evidence.id,
                evidence_type=evidence.evidence_type,
                original_filename=evidence.original_filename,
                content_type=evidence.content_type,
            )
            for evidence in item.evidences
        ],
        latest_comment=item.latest_comment,
        updated_at=item.updated_at,
        external_id=item.external_id,
        issuer_url=item.issuer_url,
        skills=list(item.skills),
        source_kind=item.source_kind,
        source_external_id=item.source_external_id,
    )


def _history_response(item: ValidationHistoryView) -> ValidationHistoryResponse:
    return ValidationHistoryResponse(
        id=item.id,
        certification_id=item.certification_id,
        actor_user_id=item.actor_user_id,
        from_status=item.from_status,
        to_status=item.to_status,
        comment=item.comment,
        cutoff_date=item.cutoff_date,
        changed_at=item.changed_at,
    )


def _decision_response(item: ValidationDecision) -> ValidationDecisionResponse:
    return ValidationDecisionResponse(
        certification_id=item.certification_id,
        action=item.action,
        status=item.status,
        history=_history_response(item.history),
    )


def _issuer_request_response(item: IssuerRequestView) -> IssuerRequestResponse:
    return IssuerRequestResponse(
        id=item.id,
        certification_id=item.certification_id,
        credential_name=item.credential_name,
        student_name=item.student_name,
        raw_name=item.raw_name,
        website_url=item.website_url,
        note=item.note,
        status=item.status,
        resolved_issuer_id=item.resolved_issuer_id,
        decision_comment=item.decision_comment,
        created_at=item.created_at,
        updated_at=item.updated_at,
        decided_at=item.decided_at,
    )


@router.get(
    "",
    response_model=list[ValidationQueueResponse],
    dependencies=[Depends(_VALIDATOR)],
    summary="List certifications visible to the validator",
)
def list_validations(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status", max_length=20),
    as_of: date | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(_VALIDATOR),
) -> list[ValidationQueueResponse]:
    try:
        items = _service(request).list_queue(
            current_user.id,
            status_filter=status_filter,
            cutoff_date=as_of or date.today(),
        )
        return [_queue_response(item) for item in items]
    except ValidationInvalid as exc:
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            str(exc),
        ) from exc
    except ValidationActorNotAllowed as exc:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", str(exc)) from exc
    except ValidationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "VALIDATION_UNAVAILABLE",
            "The validation service is unavailable",
        ) from exc


@router.get(
    "/reference",
    dependencies=[Depends(_REFERENCE_READ)],
    summary="Read the shared reference certifications and role traceability",
)
def reference_validations(
    request: Request,
    period_code: str | None = Query(default=None, max_length=32),
) -> dict[str, object]:
    settings = request.app.state.settings
    if not (settings.local_auth_enabled or settings.demo_analytics_enabled):
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "REFERENCE_DISABLED",
            "Los datos de referencia no están habilitados.",
        )
    from ...analytics.demo import demo_validation_records

    return demo_validation_records(period_code=period_code)


@router.put(
    "/{certification_id}/issuer",
    response_model=IssuerResolutionResponse,
    dependencies=[Depends(_VALIDATOR)],
    summary="Assign a canonical issuer to a certification",
)
def assign_certification_issuer(
    certification_id: UUID,
    payload: IssuerAssignmentRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(_VALIDATOR),
) -> IssuerResolutionResponse:
    try:
        result = _service(request).assign_issuer(current_user.id, certification_id, payload.issuer_id)
        return IssuerResolutionResponse(
            certification_id=result.certification_id,
            issuer=IssuerCatalogResponse(
                id=result.issuer.id,
                name=result.issuer.name,
                website_url=result.issuer.website_url,
                logo_url=result.issuer.logo_url,
                created_at=result.issuer.created_at,
            ),
            request_id=result.request_id,
        )
    except IssuerNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", str(exc)) from exc
    except (IssuerCatalogInvalid, IssuerCatalogConflict) as exc:
        raise _http_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", str(exc)) from exc
    except IssuerActorNotAllowed as exc:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", str(exc)) from exc
    except IssuerCatalogUnavailable as exc:
        raise _http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "ISSUER_CATALOG_UNAVAILABLE", str(exc)) from exc


@router.post(
    "/{certification_id}/issuer-request",
    response_model=IssuerRequestResponse,
    dependencies=[Depends(_VALIDATOR)],
    summary="Request an issuer to be added to the canonical catalog",
)
def request_certification_issuer(
    certification_id: UUID,
    payload: IssuerRequestCreate,
    request: Request,
    current_user: AuthenticatedUser = Depends(_VALIDATOR),
) -> IssuerRequestResponse:
    try:
        return _issuer_request_response(
            _service(request).request_issuer(
                current_user.id,
                certification_id,
                raw_name=payload.raw_name,
                website_url=payload.website_url,
                note=payload.note,
            )
        )
    except IssuerNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", str(exc)) from exc
    except IssuerCatalogConflict as exc:
        raise _http_error(status.HTTP_409_CONFLICT, "REQUEST_EXISTS", str(exc)) from exc
    except IssuerCatalogInvalid as exc:
        raise _http_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", str(exc)) from exc
    except IssuerActorNotAllowed as exc:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", str(exc)) from exc
    except IssuerCatalogUnavailable as exc:
        raise _http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "ISSUER_CATALOG_UNAVAILABLE", str(exc)) from exc


@router.post(
    "/{certification_id}",
    response_model=ValidationDecisionResponse,
    dependencies=[Depends(_VALIDATOR)],
    summary="Apply one authorized certification transition",
)
def decide_validation(
    certification_id: UUID,
    payload: ValidationDecisionRequest,
    request: Request,
    as_of: date | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(_VALIDATOR),
) -> ValidationDecisionResponse:
    try:
        decision = _service(request).transition(
            current_user.id,
            certification_id,
            action=payload.action,
            comment=payload.comment,
            cutoff_date=as_of or date.today(),
        )
        return _decision_response(decision)
    except ValidationNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Certification not found") from exc
    except ValidationCommentRequired as exc:
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "COMMENT_REQUIRED",
            str(exc),
        ) from exc
    except ValidationInvalid as exc:
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            str(exc),
        ) from exc
    except ValidationTransitionNotAllowed as exc:
        raise _http_error(status.HTTP_409_CONFLICT, "INVALID_TRANSITION", str(exc)) from exc
    except ValidationActorNotAllowed as exc:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", str(exc)) from exc
    except ValidationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "VALIDATION_UNAVAILABLE",
            "The validation service is unavailable",
        ) from exc


@router.get(
    "/{certification_id}/history",
    response_model=list[ValidationHistoryResponse],
    dependencies=[Depends(_VALIDATOR)],
    summary="Read immutable certification status history",
)
def validation_history(
    certification_id: UUID,
    request: Request,
    current_user: AuthenticatedUser = Depends(_VALIDATOR),
) -> list[ValidationHistoryResponse]:
    try:
        return [
            _history_response(item)
            for item in _service(request).history(current_user.id, certification_id)
        ]
    except ValidationNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Certification not found") from exc
    except ValidationActorNotAllowed as exc:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", str(exc)) from exc
    except ValidationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "VALIDATION_UNAVAILABLE",
            "The validation service is unavailable",
        ) from exc


@router.post(
    "/{certification_id}/evidence/{evidence_id}/access",
    response_model=ValidationEvidenceAccessResponse,
    dependencies=[Depends(_VALIDATOR)],
    summary="Issue a temporary evidence URL for review",
)
def validation_evidence_access(
    certification_id: UUID,
    evidence_id: UUID,
    request: Request,
    current_user: AuthenticatedUser = Depends(_VALIDATOR),
) -> ValidationEvidenceAccessResponse:
    try:
        access = _service(request).create_evidence_access(
            current_user.id,
            certification_id,
            evidence_id,
        )
        download_url = str(
            request.url_for("download_evidence", evidence_id=str(evidence_id))
        )
        return ValidationEvidenceAccessResponse(
            evidence_id=access.evidence_id,
            access_url=f"{download_url}?token={access.token}",
            expires_at=access.expires_at,
        )
    except ValidationServiceUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "VALIDATION_UNAVAILABLE",
            "The validation service is unavailable",
        ) from exc
    except RuntimeError as exc:
        message = str(exc)
        if "retention" in message.lower():
            raise _http_error(status.HTTP_403_FORBIDDEN, "EVIDENCE_ACCESS_DENIED", message) from exc
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Evidence not found") from exc


__all__ = ["router"]
