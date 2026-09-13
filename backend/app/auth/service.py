"""Business rules that turn verified Google claims into an application user."""

from __future__ import annotations

from dataclasses import dataclass

from ..core.config import Settings
from .models import AuthenticatedUser, GoogleIdentity, Role
from .store import UserDirectory, UserDirectoryUnavailable, UserIdentityConflict


class InvalidIdentity(RuntimeError):
    """The provider returned claims that cannot be used for a session."""


class UserNotProvisioned(RuntimeError):
    """The identity is not present in the institutional padrón."""


class InactiveUser(RuntimeError):
    """The provisioned account has been disabled."""


@dataclass(frozen=True)
class AuthService:
    """Authorize a validated OIDC identity against the local padrón."""

    settings: Settings
    directory: UserDirectory

    def authenticate_google(self, identity: GoogleIdentity) -> AuthenticatedUser:
        email = identity.email.strip().casefold()
        if not identity.subject.strip() or not email or not identity.email_verified:
            raise InvalidIdentity("Google did not provide a verified identity")

        domain = email.rsplit("@", 1)[-1] if "@" in email else ""
        if domain not in self.settings.allowed_google_email_domains:
            raise UserNotProvisioned("Email domain is not allowed")

        user = self.directory.find_by_google_subject(identity.subject)
        if user is None:
            user = self.directory.find_by_email(email)
        if user is None:
            # Matching the local directory is deliberate: a Google domain is not
            # evidence that the person belongs to EPIS.
            raise UserNotProvisioned("Identity is not in the institutional padrón")
        if not user.is_active:
            raise InactiveUser("The provisioned account is inactive")
        if user.role == Role.STUDENT and user.student_id is None:
            raise UserNotProvisioned("Student account has no padrón record")
        if user.google_subject not in (None, identity.subject):
            raise UserIdentityConflict("Google subject does not match account")
        if user.google_subject is None:
            user = self.directory.bind_google_subject(user.id, identity.subject)
        return user


__all__ = [
    "AuthService",
    "InactiveUser",
    "InvalidIdentity",
    "UserDirectoryUnavailable",
    "UserIdentityConflict",
    "UserNotProvisioned",
]
