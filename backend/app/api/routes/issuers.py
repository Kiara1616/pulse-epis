"""Canonical issuer catalog and administrator resolution endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ...auth.dependencies import require_permissions, require_roles
from ...auth.models import AuthenticatedUser, Permission, Role
from ...issuer_catalog.schemas import (
    IssuerCatalogResponse,
    IssuerCreateRequest,
    IssuerRequestApprove,
    IssuerRequestReject,
    IssuerRequestResponse,
    IssuerUpdateRequest,
)
from ...issuer_catalog.service import (
    IssuerActorNotAllowed,
    IssuerCatalogConflict,
    IssuerCatalogInvalid,
    IssuerCatalogServiceProtocol,
    IssuerCatalogUnavailable,
    IssuerNotFound,
    IssuerRequestNotFound,
)


router = APIRouter(prefix="/issuers", tags=["issuers"])
_CATALOG_READ = require_roles(Role.ADMIN, Role.VALIDATOR, Role.STUDENT)
_ADMIN = require_permissions(Permission.CATALOG_MANAGE)


def _http_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _service(request: Request) -> IssuerCatalogServiceProtocol:
    return request.app.state.issuer_catalog_service


def _issuer_response(item) -> IssuerCatalogResponse:
    return IssuerCatalogResponse(
        id=item.id,
        name=item.name,
        website_url=item.website_url,
        logo_url=item.logo_url,
        created_at=item.created_at,
    )


def _request_response(item) -> IssuerRequestResponse:
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
    response_model=list[IssuerCatalogResponse],
    dependencies=[Depends(_CATALOG_READ)],
    summary="List canonical issuer entities",
)
def list_issuers(request: Request, current_user: AuthenticatedUser = Depends(_CATALOG_READ)) -> list[IssuerCatalogResponse]:
    try:
        return [_issuer_response(item) for item in _service(request).list_issuers()]
    except IssuerCatalogUnavailable as exc:
        raise _http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "ISSUER_CATALOG_UNAVAILABLE", str(exc)) from exc


@router.post(
    "",
    response_model=IssuerCatalogResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_ADMIN)],
    summary="Create a canonical issuer entity",
)
def create_issuer(payload: IssuerCreateRequest, request: Request, current_user: AuthenticatedUser = Depends(_ADMIN)) -> IssuerCatalogResponse:
    try:
        return _issuer_response(_service(request).create_issuer(current_user.id, name=payload.name, website_url=payload.website_url, logo_url=payload.logo_url))
    except IssuerCatalogConflict as exc:
        raise _http_error(status.HTTP_409_CONFLICT, "ISSUER_EXISTS", str(exc)) from exc
    except IssuerCatalogInvalid as exc:
        raise _http_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", str(exc)) from exc
    except IssuerActorNotAllowed as exc:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", str(exc)) from exc
    except IssuerCatalogUnavailable as exc:
        raise _http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "ISSUER_CATALOG_UNAVAILABLE", str(exc)) from exc


@router.patch(
    "/{issuer_id}",
    response_model=IssuerCatalogResponse,
    dependencies=[Depends(_ADMIN)],
    summary="Update a canonical issuer entity",
)
def update_issuer(issuer_id: UUID, payload: IssuerUpdateRequest, request: Request, current_user: AuthenticatedUser = Depends(_ADMIN)) -> IssuerCatalogResponse:
    try:
        return _issuer_response(_service(request).update_issuer(current_user.id, issuer_id, name=payload.name, website_url=payload.website_url, logo_url=payload.logo_url))
    except IssuerNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", str(exc)) from exc
    except IssuerCatalogConflict as exc:
        raise _http_error(status.HTTP_409_CONFLICT, "ISSUER_EXISTS", str(exc)) from exc
    except IssuerCatalogInvalid as exc:
        raise _http_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", str(exc)) from exc
    except IssuerActorNotAllowed as exc:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", str(exc)) from exc
    except IssuerCatalogUnavailable as exc:
        raise _http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "ISSUER_CATALOG_UNAVAILABLE", str(exc)) from exc


@router.get(
    "/requests",
    response_model=list[IssuerRequestResponse],
    dependencies=[Depends(_ADMIN)],
    summary="List validator requests for new issuers",
)
def list_issuer_requests(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status", max_length=20),
    current_user: AuthenticatedUser = Depends(_ADMIN),
) -> list[IssuerRequestResponse]:
    try:
        return [_request_response(item) for item in _service(request).list_requests(current_user.id, status_filter=status_filter)]
    except IssuerCatalogInvalid as exc:
        raise _http_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", str(exc)) from exc
    except IssuerActorNotAllowed as exc:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", str(exc)) from exc
    except IssuerCatalogUnavailable as exc:
        raise _http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "ISSUER_CATALOG_UNAVAILABLE", str(exc)) from exc


@router.post(
    "/requests/{request_id}/approve",
    response_model=IssuerRequestResponse,
    dependencies=[Depends(_ADMIN)],
    summary="Approve a new issuer request and resolve its certification",
)
def approve_issuer_request(request_id: UUID, payload: IssuerRequestApprove, request: Request, current_user: AuthenticatedUser = Depends(_ADMIN)) -> IssuerRequestResponse:
    try:
        return _request_response(_service(request).approve_request(current_user.id, request_id, issuer_id=payload.issuer_id, name=payload.name, website_url=payload.website_url, logo_url=payload.logo_url, comment=payload.comment))
    except IssuerRequestNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", str(exc)) from exc
    except IssuerNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", str(exc)) from exc
    except IssuerCatalogConflict as exc:
        raise _http_error(status.HTTP_409_CONFLICT, "REQUEST_ALREADY_RESOLVED", str(exc)) from exc
    except IssuerCatalogInvalid as exc:
        raise _http_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", str(exc)) from exc
    except IssuerActorNotAllowed as exc:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", str(exc)) from exc
    except IssuerCatalogUnavailable as exc:
        raise _http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "ISSUER_CATALOG_UNAVAILABLE", str(exc)) from exc


@router.post(
    "/requests/{request_id}/reject",
    response_model=IssuerRequestResponse,
    dependencies=[Depends(_ADMIN)],
    summary="Reject a new issuer request",
)
def reject_issuer_request(request_id: UUID, payload: IssuerRequestReject, request: Request, current_user: AuthenticatedUser = Depends(_ADMIN)) -> IssuerRequestResponse:
    try:
        return _request_response(_service(request).reject_request(current_user.id, request_id, comment=payload.comment))
    except IssuerRequestNotFound as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, "NOT_FOUND", str(exc)) from exc
    except IssuerCatalogConflict as exc:
        raise _http_error(status.HTTP_409_CONFLICT, "REQUEST_ALREADY_RESOLVED", str(exc)) from exc
    except IssuerCatalogInvalid as exc:
        raise _http_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", str(exc)) from exc
    except IssuerActorNotAllowed as exc:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", str(exc)) from exc
    except IssuerCatalogUnavailable as exc:
        raise _http_error(status.HTTP_503_SERVICE_UNAVAILABLE, "ISSUER_CATALOG_UNAVAILABLE", str(exc)) from exc


__all__ = ["router"]
