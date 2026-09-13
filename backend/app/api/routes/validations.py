"""Validator-only certification review and immutable history endpoints."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ...auth.dependencies import require_permissions
from ...auth.models import AuthenticatedUser, Permission
from ...validation.schemas import (
    ValidationDecisionRequest,
    ValidationDecisionResponse,
    ValidationEvidenceAccessResponse,
    ValidationEvidenceResponse,
    ValidationHistoryResponse,
    ValidationQueueResponse,
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
