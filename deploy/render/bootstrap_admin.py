"""Provision an explicitly configured initial administrator inside Render's private network."""

from __future__ import annotations

import os
from uuid import uuid4

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from backend.app.core.config import Settings
from backend.app.db.models import User


def bootstrap_admin(session: Session, email: str, allowed_staff_emails: tuple[str, ...]) -> bool:
    normalized = email.strip().casefold()
    if normalized not in allowed_staff_emails:
        raise ValueError("Bootstrap administrator must be explicitly allowlisted")
    existing = session.scalar(select(User).where(func.lower(User.email) == normalized))
    if existing is not None:
        if existing.role != "ADMIN" or not existing.is_active:
            raise ValueError("Bootstrap email already belongs to another or inactive account")
        return False
    session.add(User(id=uuid4(), email=normalized, role="ADMIN", is_active=True))
    session.commit()
    return True


def main() -> None:
    email = os.environ.get("PULSE_BOOTSTRAP_ADMIN_EMAIL", "").strip()
    if not email:
        return
    settings = Settings()
    if not settings.database_url:
        raise RuntimeError("Database is required for administrator bootstrap")
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    try:
        with Session(engine) as session:
            created = bootstrap_admin(session, email, settings.allowed_google_staff_emails)
        print("Administrator bootstrap created" if created else "Administrator already provisioned")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
