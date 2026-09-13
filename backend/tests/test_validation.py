from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.certifications.service import CertificationService
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import (
    AuditLog,
    Certification,
    CertificationStatusHistory,
    Evidence,
    Issuer,
    Student,
    User,
    Validation,
)
from backend.app.validation.service import (
    ValidationActorNotAllowed,
    ValidationCommentRequired,
    ValidationService,
    ValidationTransitionNotAllowed,
    is_kpi_eligible,
)
from backend.app.auth.models import AuthenticatedUser, GoogleIdentity, Role
from backend.app.auth.store import InMemoryUserDirectory
from backend.app.main import create_app


class FakeOidcClient:
    configured = True

    def authorization_url(self, *, state: str, nonce: str) -> str:
        return f"https://accounts.google.com/auth?state={state}&nonce={nonce}"

    def exchange_code(self, code: str) -> str:
        assert code == "one-time-code"
        return "fake-id-token"

    def verify_id_token(self, encoded_token: str, *, expected_nonce: str) -> GoogleIdentity:
        assert encoded_token == "fake-id-token"
        return GoogleIdentity(
            subject="google-validation-validator",
            email="validator@virtual.upt.pe",
            email_verified=True,
            nonce=expected_nonce,
        )


def sign_in(client: TestClient) -> None:
    login = client.get("/api/v1/auth/google/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    callback = client.get(
        "/api/v1/auth/google/callback",
        params={"code": "one-time-code", "state": state},
        follow_redirects=False,
    )
    assert callback.status_code == 302


def make_context(tmp_path: Path):
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    student_user_id = uuid4()
    validator_user_id = uuid4()
    admin_user_id = uuid4()
    student_id = uuid4()
    certification_id = uuid4()
    issuer_id = uuid4()
    now = datetime.now(timezone.utc)
    with Session(engine) as session:
        session.add_all(
            [
                User(
                    id=student_user_id,
                    email="student@virtual.upt.pe",
                    role="STUDENT",
                ),
                User(
                    id=validator_user_id,
                    email="validator@virtual.upt.pe",
                    role="VALIDATOR",
                ),
                User(
                    id=admin_user_id,
                    email="admin@virtual.upt.pe",
                    role="ADMIN",
                ),
                Student(
                    id=student_id,
                    user_id=student_user_id,
                    student_key="student-validation-001",
                    entry_year=2024,
                ),
                Issuer(id=issuer_id, name="Issuer Test", website_url="https://issuer.test"),
                Certification(
                    id=certification_id,
                    student_id=student_id,
                    issuer_id=issuer_id,
                    credential_name="Cloud Fundamentals",
                    issued_on=date(2026, 1, 10),
                    expires_on=date(2027, 1, 10),
                    status="PENDING",
                    source_url="https://issuer.test/credential/1",
                    created_at=now,
                    updated_at=now,
                ),
                Evidence(
                    id=uuid4(),
                    certification_id=certification_id,
                    evidence_type="URL",
                    source_url="https://issuer.test/credential/1",
                    sha256="a" * 64,
                    retention_until=now + timedelta(days=30),
                    uploaded_at=now,
                ),
                CertificationStatusHistory(
                    id=uuid4(),
                    certification_id=certification_id,
                    actor_user_id=student_user_id,
                    from_status=None,
                    to_status="PENDING",
                    changed_at=now,
                ),
            ]
        )
        session.commit()
    settings = Settings(
        environment="test",
        log_level="WARNING",
        auth_session_secret="test-session-secret",
        google_allowed_domains="virtual.upt.pe",
        roster_pseudonym_secret="test-roster-secret",
        evidence_storage_path=str(tmp_path / "private-evidence"),
        evidence_access_secret="test-evidence-secret",
    )
    return (
        engine,
        session_factory,
        settings,
        student_user_id,
        validator_user_id,
        admin_user_id,
        certification_id,
    )


def test_state_machine_preserves_history_and_requires_comments(tmp_path):
    (
        engine,
        session_factory,
        settings,
        student_user_id,
        validator_user_id,
        _,
        certification_id,
    ) = make_context(tmp_path)
    validation = ValidationService(session_factory, settings)

    with pytest.raises(ValidationTransitionNotAllowed):
        validation.transition(
            validator_user_id,
            certification_id,
            action="APPROVE",
            cutoff_date=date(2026, 9, 13),
        )
    started = validation.transition(
        validator_user_id,
        certification_id,
        action="START_REVIEW",
        cutoff_date=date(2026, 9, 13),
    )
    assert started.status == "UNDER_REVIEW"
    with pytest.raises(ValidationCommentRequired):
        validation.transition(
            validator_user_id,
            certification_id,
            action="OBSERVE",
            cutoff_date=date(2026, 9, 13),
        )
    observed = validation.transition(
        validator_user_id,
        certification_id,
        action="OBSERVE",
        comment="Falta el enlace de verificación",
        cutoff_date=date(2026, 9, 13),
    )
    assert observed.status == "OBSERVED"

    student_service = CertificationService(session_factory, settings)
    corrected = student_service.update_own(
        student_user_id,
        certification_id,
        {"credential_name": "Cloud Fundamentals Corrected"},
    )
    assert corrected.status == "RESUBMITTED"
    validation.transition(
        validator_user_id,
        certification_id,
        action="START_REVIEW",
        cutoff_date=date(2026, 9, 13),
    )
    approved = validation.transition(
        validator_user_id,
        certification_id,
        action="APPROVE",
        comment="Evidencia verificada",
        cutoff_date=date(2026, 9, 13),
    )
    assert approved.status == "APPROVED"

    history = validation.history(validator_user_id, certification_id)
    assert [item.to_status for item in history] == [
        "PENDING",
        "UNDER_REVIEW",
        "OBSERVED",
        "RESUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
    ]
    assert history[2].comment == "Falta el enlace de verificación"
    assert history[3].actor_user_id == student_user_id

    with Session(engine) as session:
        decisions = session.scalars(
            select(Validation).where(Validation.certification_id == certification_id)
        ).all()
        audit_rows = session.scalars(
            select(AuditLog).where(AuditLog.entity_id == str(certification_id))
        ).all()
        assert [item.decision for item in decisions] == ["OBSERVED", "APPROVED"]
        assert len(audit_rows) == 5
    engine.dispose()


def test_only_validator_can_decide_and_expired_approval_is_excluded_from_kpi(tmp_path):
    (
        engine,
        session_factory,
        settings,
        _,
        validator_user_id,
        admin_user_id,
        certification_id,
    ) = make_context(tmp_path)
    validation = ValidationService(session_factory, settings)
    with pytest.raises(ValidationActorNotAllowed):
        validation.list_queue(admin_user_id, cutoff_date=date(2026, 9, 13))

    with Session(engine) as session:
        certification = session.get(Certification, certification_id)
        assert certification is not None
        certification.status = "APPROVED"
        certification.expires_on = date(2026, 9, 12)
        session.commit()

    queue = validation.list_queue(
        validator_user_id,
        status_filter="EXPIRED",
        cutoff_date=date(2026, 9, 13),
    )
    assert len(queue) == 1
    assert queue[0].status == "EXPIRED"
    assert queue[0].stored_status == "APPROVED"
    with Session(engine) as session:
        certification = session.get(Certification, certification_id)
        assert certification is not None
        assert is_kpi_eligible(certification, date(2026, 9, 13)) is False
    engine.dispose()


def test_validator_api_exposes_queue_and_transitions(tmp_path):
    (
        engine,
        session_factory,
        settings,
        _,
        validator_user_id,
        _,
        certification_id,
    ) = make_context(tmp_path)
    validation = ValidationService(session_factory, settings)
    principal = AuthenticatedUser(
        id=validator_user_id,
        email="validator@virtual.upt.pe",
        role=Role.VALIDATOR,
    )
    app = create_app(
        settings=settings,
        user_directory=InMemoryUserDirectory([principal]),
        oidc_client=FakeOidcClient(),
        validation_service=validation,
    )

    with TestClient(app) as client:
        sign_in(client)
        queue = client.get("/api/v1/validations")
        assert queue.status_code == 200
        assert queue.json()[0]["status"] == "PENDING"
        assert queue.json()[0]["student_key"] == "student-validation-001"
        assert "email" not in queue.json()[0]

        started = client.post(
            f"/api/v1/validations/{certification_id}",
            json={"action": "START_REVIEW"},
        )
        assert started.status_code == 200
        assert started.json()["status"] == "UNDER_REVIEW"
        observed = client.post(
            f"/api/v1/validations/{certification_id}",
            json={"action": "OBSERVE", "comment": "Verificar emisor"},
        )
        assert observed.status_code == 200
        history = client.get(f"/api/v1/validations/{certification_id}/history")
        assert history.status_code == 200
        assert [item["to_status"] for item in history.json()] == [
            "PENDING",
            "UNDER_REVIEW",
            "OBSERVED",
        ]
    engine.dispose()
