"""Google OIDC login, signed sessions and authenticated-user introspection."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse, Response

from ...auth.dependencies import CurrentUser, get_current_user
from ...auth.models import AuthenticatedUser
from ...auth.oidc import (
    OidcClient,
    OidcConfigurationError,
    OidcProviderError,
    OidcVerificationError,
)
from ...auth.rbac import permissions_for
from ...auth.schemas import CurrentUserResponse
from ...auth.service import (
    AuthService,
    InactiveUser,
    InvalidIdentity,
    UserNotProvisioned,
)
from ...auth.store import UserDirectoryUnavailable, UserIdentityConflict


router = APIRouter(prefix="/auth", tags=["auth"])


def _http_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def _current_user_response(user: AuthenticatedUser) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        student_id=user.student_id,
        permissions=sorted(permissions_for(user.role), key=lambda permission: permission.value),
    )


@router.get(
    "/google/login",
    status_code=status.HTTP_302_FOUND,
    summary="Start the institutional Google OIDC flow",
)
def google_login(request: Request) -> RedirectResponse:
    client: OidcClient = request.app.state.oidc_client
    if not client.configured:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "AUTH_NOT_CONFIGURED",
            "Google institutional login is not configured",
        )

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    request.session["oidc_state"] = state
    request.session["oidc_nonce"] = nonce
    try:
        location = client.authorization_url(state=state, nonce=nonce)
    except OidcConfigurationError as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "AUTH_NOT_CONFIGURED",
            "Google institutional login is not configured",
        ) from exc
    return RedirectResponse(url=location, status_code=status.HTTP_302_FOUND)


@router.get(
    "/google/callback",
    summary="Finish the institutional Google OIDC flow",
)
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    expected_state = request.session.pop("oidc_state", None)
    expected_nonce = request.session.pop("oidc_nonce", None)
    if (
        not isinstance(expected_state, str)
        or not isinstance(expected_nonce, str)
        or not isinstance(state, str)
        or not secrets.compare_digest(expected_state, state)
    ):
        raise _http_error(
            status.HTTP_400_BAD_REQUEST,
            "AUTH_STATE_MISMATCH",
            "The OIDC state is invalid or expired",
        )
    if error or not code:
        raise _http_error(
            status.HTTP_400_BAD_REQUEST,
            "AUTH_PROVIDER_ERROR",
            "The institutional login was not completed",
        )

    client: OidcClient = request.app.state.oidc_client
    auth_service: AuthService = request.app.state.auth_service
    try:
        encoded_token = client.exchange_code(code)
        identity = client.verify_id_token(encoded_token, expected_nonce=expected_nonce)
        user = auth_service.authenticate_google(identity)
    except OidcConfigurationError as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "AUTH_NOT_CONFIGURED",
            "Google institutional login is not configured",
        ) from exc
    except OidcProviderError as exc:
        raise _http_error(
            status.HTTP_502_BAD_GATEWAY,
            "OIDC_PROVIDER_ERROR",
            "The identity provider could not complete the login",
        ) from exc
    except OidcVerificationError as exc:
        raise _http_error(
            status.HTTP_401_UNAUTHORIZED,
            "UNAUTHENTICATED",
            "The identity token is not valid",
        ) from exc
    except (InvalidIdentity, UserNotProvisioned, InactiveUser, UserIdentityConflict) as exc:
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "The Google identity is not authorized for Pulse EPIS",
        ) from exc
    except UserDirectoryUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "AUTH_DIRECTORY_UNAVAILABLE",
            "The institutional user directory is unavailable",
        ) from exc

    # Only an internal identifier and timestamp are kept in the signed cookie;
    # role and active status are reloaded from the directory on every request.
    request.session.clear()
    request.session["user_id"] = str(user.id)
    request.session["authenticated_at"] = datetime.now(timezone.utc).isoformat()
    return RedirectResponse(
        url=request.app.state.settings.auth_success_redirect,
        status_code=status.HTTP_302_FOUND,
    )


@router.get(
    "/me",
    response_model=CurrentUserResponse,
    summary="Return the current authorized user",
)
def current_user(current_user: CurrentUser) -> CurrentUserResponse:
    return _current_user_response(current_user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="End the current session")
def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
