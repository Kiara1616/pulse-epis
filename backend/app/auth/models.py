"""Small, framework-independent identity objects used by the API."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID


class Role(StrEnum):
    """The only technical roles supported by the MVP."""

    ADMIN = "ADMIN"
    VALIDATOR = "VALIDATOR"
    STUDENT = "STUDENT"


class Permission(StrEnum):
    """Server-side permissions; the frontend cannot grant any of them."""

    ANALYTICS_READ = "ANALYTICS_READ"
    AUDIT_READ = "AUDIT_READ"
    CERTIFICATION_READ_OWN = "CERTIFICATION_READ_OWN"
    CERTIFICATION_VALIDATE = "CERTIFICATION_VALIDATE"
    CERTIFICATION_WRITE_OWN = "CERTIFICATION_WRITE_OWN"
    CATALOG_MANAGE = "CATALOG_MANAGE"
    PADRON_MANAGE = "PADRON_MANAGE"
    PERIOD_MANAGE = "PERIOD_MANAGE"
    USER_MANAGE = "USER_MANAGE"


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    """The minimum identity needed after the OIDC subject is authorized."""

    id: UUID
    email: str
    role: Role
    student_id: UUID | None = None
    is_active: bool = True
    google_subject: str | None = None


@dataclass(frozen=True, slots=True)
class GoogleIdentity:
    """Validated claims returned by the Google OIDC verifier."""

    subject: str
    email: str
    email_verified: bool
    nonce: str | None = None
