from __future__ import annotations

from datetime import date, timedelta, timezone, datetime
from dataclasses import replace
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine

from backend.app.auth.models import AuthenticatedUser, GoogleIdentity, Role
from backend.app.auth.store import InMemoryUserDirectory
from backend.app.certifications.service import (
    CertificationDraft,
    CertificationDuplicate,
    CertificationInvalid,
    CertificationNotFound,
    CertificationService,
    EvidenceAccessDenied,
    EvidenceDuplicate,
    SkillInput,
)
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import AuditLog, Certification, Evidence, Student, User, Validation
from backend.app.main import create_app


class FakeOidcClient:
    configured = True

    def __init__(self, identity: GoogleIdentity) -> None:
        self.identity = identity

    def authorization_url(self, *, state: str, nonce: str) -> str:
        return f"https://accounts.google.com/auth?state={state}&nonce={nonce}"

    def exchange_code(self, code: str) -> str:
        assert code == "one-time-code"
        return "fake-id-token"

    def verify_id_token(self, encoded_token: str, *, expected_nonce: str) -> GoogleIdentity:
        assert encoded_token == "fake-id-token"
        return GoogleIdentity(
            subject=self.identity.subject,
            email=self.identity.email,
            email_verified=True,
            nonce=expected_nonce,
        )


def make_settings(storage_path: Path) -> Settings:
    return Settings(
        environment="test",
        log_level="WARNING",
        auth_session_secret="test-session-secret",
        google_allowed_domains="virtual.upt.pe",
        roster_pseudonym_secret="test-roster-secret",
        evidence_storage_path=str(storage_path),
        evidence_access_secret="test-evidence-secret",
    )


def make_service(tmp_path: Path):
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    actor_id = uuid4()
    other_actor_id = uuid4()
    actor_student_id = uuid4()
    other_student_id = uuid4()
    with Session(engine) as session:
        session.add_all(
            [
                User(id=actor_id, email="student.one@virtual.upt.pe", role="STUDENT"),
                User(id=other_actor_id, email="student.two@virtual.upt.pe", role="STUDENT"),
                Student(
                    id=actor_student_id,
                    user_id=actor_id,
                    student_key="stu-certification-001",
                    entry_year=2023,
                ),
                Student(
                    id=other_student_id,
                    user_id=other_actor_id,
                    student_key="stu-certification-002",
                    entry_year=2022,
                ),
            ]
        )
        session.commit()
    settings = make_settings(tmp_path / "private-evidence")
    return (
        CertificationService(session_factory, settings),
        session_factory,
        settings,
        actor_id,
        other_actor_id,
        engine,
    )


def draft(*, name: str = "AWS Cloud Practitioner") -> CertificationDraft:
    return CertificationDraft(
        issuer_name="AWS",
        issuer_url="https://aws.amazon.com",
        credential_name=name,
        external_id="AWS-001",
        issued_on=date(2026, 1, 15),
        expires_on=date(2029, 1, 15),
        source_url="https://verify.example.test/aws-001",
        skills=(SkillInput(name="Cloud", level="Fundamentals"),),
    )


def test_student_certification_is_pending_owned_and_deduplicated(tmp_path):
    service, session_factory, _, actor_id, other_actor_id, engine = make_service(tmp_path)

    created = service.create_certification(actor_id, draft())

    assert created.status == "PENDING"
    assert created.correction_allowed is True
    assert [skill.name for skill in created.skills] == ["Cloud"]
    assert service.list_own(other_actor_id) == []
    with pytest.raises(CertificationNotFound):
        service.get_own(other_actor_id, created.id)
    with pytest.raises(CertificationDuplicate):
        service.create_certification(actor_id, draft())

    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Certification)) == 1
        assert session.scalar(select(func.count()).select_from(AuditLog)) == 1
    engine.dispose()


def test_dates_and_files_are_validated_and_private_access_expires_by_signature(tmp_path):
    service, _, _, actor_id, _, engine = make_service(tmp_path)
    created = service.create_certification(actor_id, draft())

    with pytest.raises(CertificationInvalid):
        service.create_certification(
            actor_id,
            replace(
                draft(),
                issued_on=date(2027, 1, 15),
                expires_on=date(2026, 1, 15),
            ),
        )

    evidence = service.add_file_evidence(
        actor_id,
        created.id,
        filename="certificate.pdf",
        content_type="application/pdf",
        content=b"%PDF-1.7\nsynthetic evidence",
    )
    assert evidence.evidence_type == "FILE"
    assert evidence.byte_size == len(b"%PDF-1.7\nsynthetic evidence")
    assert evidence.retention_until.year >= 2031
    access = service.create_evidence_access(actor_id, created.id, evidence.id)
    download = service.download_evidence(evidence.id, access.token)
    assert download.path is not None
    assert download.path.read_bytes() == b"%PDF-1.7\nsynthetic evidence"

    with pytest.raises(EvidenceAccessDenied):
        service.download_evidence(evidence.id, access.token + "tampered")
    with Session(engine) as session:
        session.get(Evidence, evidence.id).retention_until = (
            datetime.now(timezone.utc) - timedelta(days=1)
        )
        session.commit()
    with pytest.raises(EvidenceAccessDenied):
        service.create_evidence_access(actor_id, created.id, evidence.id)
    with pytest.raises(EvidenceDuplicate):
        service.add_file_evidence(
            actor_id,
            created.id,
            filename="certificate.pdf",
            content_type="application/pdf",
            content=b"%PDF-1.7\nsynthetic evidence",
        )
    with pytest.raises(CertificationInvalid):
        service.add_file_evidence(
            actor_id,
            created.id,
            filename="certificate.pdf",
            content_type="application/pdf",
            content=b"not a pdf",
        )
    url_evidence = service.add_url_evidence(
        actor_id,
        created.id,
        "https://verify.example.test/other",
    )
    url_access = service.create_evidence_access(actor_id, created.id, url_evidence.id)
    url_download = service.download_evidence(url_evidence.id, url_access.token)
    assert url_download.source_url == "https://verify.example.test/other"
    engine.dispose()


def test_observed_certification_can_be_corrected_and_keeps_validation_history(tmp_path):
    service, session_factory, _, actor_id, _, engine = make_service(tmp_path)
    created = service.create_certification(actor_id, draft())
    validator_id = uuid4()
    with Session(engine) as session:
        session.add(User(id=validator_id, email="validator@virtual.upt.pe", role="VALIDATOR"))
        certification = session.get(Certification, created.id)
        certification.status = "OBSERVED"
        session.add(
            Validation(
                id=uuid4(),
                certification_id=created.id,
                validator_user_id=validator_id,
                decision="OBSERVED",
                comment="Adjuntar evidencia legible",
            )
        )
        session.commit()

    corrected = service.update_own(
        actor_id,
        created.id,
        {
            "credential_name": "AWS Cloud Practitioner Corrected",
            "skills": (SkillInput(name="Cloud", level="Associate"),),
        },
    )
    assert corrected.status == "PENDING"
    assert corrected.credential_name.endswith("Corrected")
    assert corrected.skills[0].level == "Associate"
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Validation)) == 1
        assert session.get(Certification, created.id).status == "PENDING"
    engine.dispose()


def _sign_in(client: TestClient) -> None:
    login = client.get("/api/v1/auth/google/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    callback = client.get(
        "/api/v1/auth/google/callback",
        params={"code": "one-time-code", "state": state},
        follow_redirects=False,
    )
    assert callback.status_code == 302


def test_student_certification_and_temporary_download_api(tmp_path):
    service, _, settings, actor_id, _, engine = make_service(tmp_path)
    principal = AuthenticatedUser(
        id=actor_id,
        email="student.one@virtual.upt.pe",
        role=Role.STUDENT,
        student_id=uuid4(),
    )
    identity = GoogleIdentity(
        subject="google-certification-student",
        email=principal.email,
        email_verified=True,
    )
    app = create_app(
        settings=settings,
        user_directory=InMemoryUserDirectory([principal]),
        oidc_client=FakeOidcClient(identity),
        certification_service=service,
    )

    with TestClient(app) as client:
        _sign_in(client)
        response = client.post(
            "/api/v1/certifications",
            json={
                "issuer_name": "AWS",
                "issuer_url": "https://aws.amazon.com",
                "credential_name": "AWS Cloud Practitioner",
                "issued_on": "2026-01-15",
                "expires_on": "2029-01-15",
                "source_url": "https://verify.example.test/aws-001",
                "skills": [{"name": "Cloud", "level": "Fundamentals"}],
            },
        )
        assert response.status_code == 201
        certification_id = response.json()["id"]
        upload = client.post(
            f"/api/v1/certifications/{certification_id}/evidence",
            files={"file": ("certificate.pdf", b"%PDF-1.7\napi evidence", "application/pdf")},
        )
        assert upload.status_code == 201
        evidence_id = upload.json()["id"]
        access = client.post(
            f"/api/v1/certifications/{certification_id}/evidence/{evidence_id}/access"
        )
        assert access.status_code == 200
        download = client.get(access.json()["access_url"], follow_redirects=False)
        assert download.status_code == 200
        assert download.content.startswith(b"%PDF-1.7")
        listing = client.get("/api/v1/certifications")
        assert listing.status_code == 200
        assert listing.json()[0]["status"] == "PENDING"
    engine.dispose()
