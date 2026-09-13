"""User-directory adapters used to enforce the institutional allowlist."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Iterable, Protocol
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from ..db.models import Student, User
from .models import AuthenticatedUser, Role


class UserDirectoryUnavailable(RuntimeError):
    """Raised when the API has no configured user directory."""


class UserIdentityConflict(RuntimeError):
    """Raised when a Google subject is already bound to another account."""


class UserDirectory(Protocol):
    """Operations required by authentication and session validation."""

    def get_by_id(self, user_id: UUID) -> AuthenticatedUser | None:
        """Return an active or inactive user by internal identifier."""

    def find_by_email(self, email: str) -> AuthenticatedUser | None:
        """Find a provisioned account by normalized email."""

    def find_by_google_subject(self, subject: str) -> AuthenticatedUser | None:
        """Find an account bound to a stable OIDC subject."""

    def bind_google_subject(self, user_id: UUID, subject: str) -> AuthenticatedUser:
        """Atomically bind a previously unbound account to an OIDC subject."""


def _principal_from_model(
    session: Session,
    user: User,
) -> AuthenticatedUser:
    student_id = session.scalar(select(Student.id).where(Student.user_id == user.id))
    return AuthenticatedUser(
        id=user.id,
        email=user.email,
        role=Role(user.role),
        student_id=student_id,
        is_active=user.is_active,
        google_subject=user.google_subject,
    )


class SqlAlchemyUserDirectory:
    """Read and update identity bindings in the PostgreSQL user directory."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def get_by_id(self, user_id: UUID) -> AuthenticatedUser | None:
        with self._session_factory() as session:
            user = session.get(User, user_id)
            return _principal_from_model(session, user) if user else None

    def find_by_email(self, email: str) -> AuthenticatedUser | None:
        normalized_email = email.strip().casefold()
        with self._session_factory() as session:
            user = session.scalar(
                select(User).where(func.lower(User.email) == normalized_email)
            )
            return _principal_from_model(session, user) if user else None

    def find_by_google_subject(self, subject: str) -> AuthenticatedUser | None:
        with self._session_factory() as session:
            user = session.scalar(select(User).where(User.google_subject == subject))
            return _principal_from_model(session, user) if user else None

    def bind_google_subject(self, user_id: UUID, subject: str) -> AuthenticatedUser:
        session = self._session_factory()
        try:
            with session.begin():
                user = session.get(User, user_id)
                if user is None:
                    raise UserDirectoryUnavailable("Provisioned user disappeared")
                existing = session.scalar(
                    select(User).where(User.google_subject == subject)
                )
                if existing is not None and existing.id != user_id:
                    raise UserIdentityConflict("Google subject is already bound")
                if user.google_subject not in (None, subject):
                    raise UserIdentityConflict("Google subject does not match account")
                user.google_subject = subject
                session.flush()
                return _principal_from_model(session, user)
        except IntegrityError as exc:
            raise UserIdentityConflict("Google subject is already bound") from exc
        finally:
            session.close()


@dataclass
class InMemoryUserDirectory:
    """Deterministic directory used by tests and isolated local development."""

    users: Iterable[AuthenticatedUser]

    def __post_init__(self) -> None:
        self._users: dict[UUID, AuthenticatedUser] = {user.id: user for user in self.users}

    def get_by_id(self, user_id: UUID) -> AuthenticatedUser | None:
        return self._users.get(user_id)

    def find_by_email(self, email: str) -> AuthenticatedUser | None:
        normalized_email = email.strip().casefold()
        return next(
            (
                user
                for user in self._users.values()
                if user.email.casefold() == normalized_email
            ),
            None,
        )

    def find_by_google_subject(self, subject: str) -> AuthenticatedUser | None:
        return next(
            (
                user
                for user in self._users.values()
                if user.google_subject == subject
            ),
            None,
        )

    def bind_google_subject(self, user_id: UUID, subject: str) -> AuthenticatedUser:
        existing = self.find_by_google_subject(subject)
        if existing is not None and existing.id != user_id:
            raise UserIdentityConflict("Google subject is already bound")
        user = self._users.get(user_id)
        if user is None:
            raise UserDirectoryUnavailable("Provisioned user disappeared")
        if user.google_subject not in (None, subject):
            raise UserIdentityConflict("Google subject does not match account")
        updated = replace(user, google_subject=subject)
        self._users[user_id] = updated
        return updated


class UnavailableUserDirectory:
    """Explicit failure mode when the API has no database configuration."""

    def _raise(self) -> None:
        raise UserDirectoryUnavailable("PULSE_DATABASE_URL is not configured")

    def get_by_id(self, user_id: UUID) -> AuthenticatedUser | None:
        self._raise()
        return None

    def find_by_email(self, email: str) -> AuthenticatedUser | None:
        self._raise()
        return None

    def find_by_google_subject(self, subject: str) -> AuthenticatedUser | None:
        self._raise()
        return None

    def bind_google_subject(self, user_id: UUID, subject: str) -> AuthenticatedUser:
        self._raise()
        raise AssertionError("unreachable")
