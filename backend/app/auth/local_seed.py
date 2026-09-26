"""Idempotent synthetic users for local development and manual demos."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import Settings
from ..db.models import Student, User
from .models import Role
from .passwords import hash_password


@dataclass(frozen=True, slots=True)
class DemoUser:
    email: str
    role: Role
    student_key: str | None = None


DEMO_USERS = (
    DemoUser("admin@local.pulse-epis.test", Role.ADMIN),
    DemoUser("validator@local.pulse-epis.test", Role.VALIDATOR),
    DemoUser("student@local.pulse-epis.test", Role.STUDENT, "demo-student-local"),
)


def seed_local_users(
    session_factory: sessionmaker[Session] | None,
    settings: Settings,
) -> int:
    """Create synthetic demo accounts when explicitly enabled in development."""

    if not settings.local_auth_enabled or not settings.local_auth_seed:
        return 0
    if session_factory is None:
        return 0

    password_hash = hash_password(settings.local_auth_password.get_secret_value())
    created = 0
    with session_factory.begin() as session:
        for demo_user in DEMO_USERS:
            user = session.scalar(select(User).where(User.email == demo_user.email))
            if user is not None:
                continue

            user = User(
                id=uuid4(),
                email=demo_user.email,
                role=demo_user.role.value,
                password_hash=password_hash,
            )
            session.add(user)
            session.flush()

            if demo_user.role == Role.STUDENT and demo_user.student_key is not None:
                session.add(
                    Student(
                        id=uuid4(),
                        user_id=user.id,
                        student_key=demo_user.student_key,
                        entry_year=2026,
                        status="ACTIVE",
                    )
                )
            created += 1
    return created


__all__ = ["DEMO_USERS", "DemoUser", "seed_local_users"]
