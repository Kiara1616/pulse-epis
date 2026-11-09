"""Provision an explicitly configured initial administrator inside Render's private network."""

from __future__ import annotations

import os
from uuid import uuid4

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from backend.app.core.config import Settings
from backend.app.db.models import User


def bootstrap_staff(session: Session, email: str, role: str, allowed_staff_emails: tuple[str, ...]) -> bool:
    normalized = email.strip().casefold()
    if normalized not in allowed_staff_emails:
        raise ValueError("Bootstrap staff member must be explicitly allowlisted")
    existing = session.scalar(select(User).where(func.lower(User.email) == normalized))
    if existing is not None:
        if existing.role != role or not existing.is_active:
            raise ValueError("Bootstrap email already belongs to another role or inactive account")
        return False
    session.add(User(id=uuid4(), email=normalized, role=role, is_active=True))
    session.commit()
    return True


def bootstrap_admin(session: Session, email: str, allowed_staff_emails: tuple[str, ...]) -> bool:
    return bootstrap_staff(session, email, "ADMIN", allowed_staff_emails)


def main() -> None:
    admin_email = os.environ.get("PULSE_BOOTSTRAP_ADMIN_EMAIL", "").strip()
    validator_emails = tuple(
        email.strip() for email in os.environ.get("PULSE_BOOTSTRAP_VALIDATOR_EMAILS", "").split(",") if email.strip()
    )
    if not admin_email and not validator_emails:
        return
    settings = Settings()
    if not settings.database_url:
        raise RuntimeError("Database is required for administrator bootstrap")
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    try:
        with Session(engine) as session:
            if admin_email:
                created = bootstrap_admin(session, admin_email, settings.allowed_google_staff_emails)
                print("Administrator bootstrap created" if created else "Administrator already provisioned")
            for validator_email in validator_emails:
                created = bootstrap_staff(session, validator_email, "VALIDATOR", settings.allowed_google_staff_emails)
                print("Validator bootstrap created" if created else "Validator already provisioned")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
