"""FastAPI dependencies for session validation and RBAC enforcement."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status

from .models import AuthenticatedUser, Permission, Role
from .rbac import has_permission
from .store import UserDirectoryUnavailable


def _http_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def get_current_user(request: Request) -> AuthenticatedUser:
    """Read the signed session and rehydrate the current user from the directory."""

    raw_user_id = request.session.get("user_id")
    if not isinstance(raw_user_id, str):
        raise _http_error(
            status.HTTP_401_UNAUTHORIZED,
            "UNAUTHENTICATED",
            "A valid session is required",
        )
    try:
        user_id = UUID(raw_user_id)
    except ValueError as exc:
        request.session.clear()
        raise _http_error(
            status.HTTP_401_UNAUTHORIZED,
            "UNAUTHENTICATED",
            "A valid session is required",
        ) from exc

    try:
        user = request.app.state.user_directory.get_by_id(user_id)
    except UserDirectoryUnavailable as exc:
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "AUTH_DIRECTORY_UNAVAILABLE",
            "The institutional user directory is unavailable",
        ) from exc
    if user is None or not user.is_active:
        request.session.clear()
        raise _http_error(
            status.HTTP_401_UNAUTHORIZED,
            "UNAUTHENTICATED",
            "A valid session is required",
        )
    return user


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def require_roles(*roles: Role):
    """Build a dependency that allows only the explicitly listed roles."""

    allowed_roles = frozenset(roles)
    if not allowed_roles:
        raise ValueError("require_roles needs at least one role")

    def dependency(current_user: CurrentUser) -> AuthenticatedUser:
        if current_user.role not in allowed_roles:
            raise _http_error(
                status.HTTP_403_FORBIDDEN,
                "FORBIDDEN",
                "The current role cannot perform this operation",
            )
        return current_user

    dependency.__name__ = "require_roles_" + "_".join(role.value.lower() for role in roles)
    return dependency


def require_permissions(*permissions: Permission):
    """Build a dependency that denies by default when any permission is absent."""

    required_permissions = frozenset(permissions)
    if not required_permissions:
        raise ValueError("require_permissions needs at least one permission")

    def dependency(current_user: CurrentUser) -> AuthenticatedUser:
        if not all(
            has_permission(current_user.role, permission)
            for permission in required_permissions
        ):
            raise _http_error(
                status.HTTP_403_FORBIDDEN,
                "FORBIDDEN",
                "The current role does not have the required permission",
            )
        return current_user

    dependency.__name__ = "require_permissions_" + "_".join(
        permission.value.lower() for permission in permissions
    )
    return dependency


def require_student_access(student_id: UUID, current_user: CurrentUser) -> AuthenticatedUser:
    """Prevent a student from reading another student's nominal resources."""

    if current_user.role == Role.STUDENT and current_user.student_id != student_id:
        raise _http_error(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "Students may access only their own data",
        )
    return current_user


__all__ = [
    "CurrentUser",
    "get_current_user",
    "require_permissions",
    "require_roles",
    "require_student_access",
]
