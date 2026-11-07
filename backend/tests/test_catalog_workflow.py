"""Role boundaries and publication visibility for controlled catalogs."""

from datetime import date
from uuid import UUID, uuid4

from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.auth.dependencies import get_current_user
from backend.app.auth.models import AuthenticatedUser, Role
from backend.app.certifications.service import CertificationService
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import Certification, Issuer, Student, User
from backend.app.main import create_app
from backend.app.validation.service import ValidationService


def test_admin_controls_catalog_student_proposals_and_course_publication(tmp_path):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    ids = {role: uuid4() for role in ("admin", "student", "validator")}
    student_id = uuid4()
    actors = {
        "admin": AuthenticatedUser(id=ids["admin"], email="admin@example.invalid", role=Role.ADMIN),
        "student": AuthenticatedUser(id=ids["student"], email="student@example.invalid", role=Role.STUDENT, student_id=student_id),
        "validator": AuthenticatedUser(id=ids["validator"], email="validator@example.invalid", role=Role.VALIDATOR),
    }
    with factory.begin() as session:
        session.add_all(User(id=actor.id, email=actor.email, role=actor.role.value) for actor in actors.values())
        session.flush()
        session.add(Student(id=student_id, user_id=ids["student"], student_key="catalog-test-student"))

    settings = Settings(environment="test", database_url=None, log_level="WARNING", evidence_storage_path=str(tmp_path))
    app = create_app(settings)
    app.state.session_factory = factory
    app.state.certification_service = CertificationService(factory, settings)
    app.state.validation_service = ValidationService(factory, settings)
    def identity(request: Request):
        return actors[request.headers["x-test-actor"]]
    app.dependency_overrides[get_current_user] = identity
    admin = TestClient(app, headers={"x-test-actor": "admin"})
    student = TestClient(app, headers={"x-test-actor": "student"})
    validator = TestClient(app, headers={"x-test-actor": "validator"})
    base = "/api/v1"

    assert student.post(base + "/catalog/issuers", json={"name": "Proveedor X"}).status_code == 403
    issuer = admin.post(base + "/catalog/issuers", json={"name": "Proveedor X", "active": True}).json()
    assert issuer["name"] == "Proveedor X"
    assert admin.post(base + f"/catalog/issuers/{issuer['id']}/aliases", json={"name": "X"}).status_code == 201
    assert admin.post(base + "/catalog/issuers", json={"name": "x"}).status_code == 409
    issuer_proposal = student.post(base + "/catalog/proposals", json={"kind": "ISSUER", "proposed_name": "Proveedor equis"}).json()
    assert admin.post(base + f"/catalog/proposals/{issuer_proposal['id']}/resolve", json={"target_id": issuer["id"], "reason": "Nombre alternativo verificado"}).status_code == 200
    assert admin.post(base + "/catalog/issuers", json={"name": "proveedor equis"}).status_code == 409
    skill = admin.post(base + "/catalog/skills", json={"name": "SQL"}).json()
    credential = admin.post(base + "/catalog/credentials", json={"issuer_id": issuer["id"], "name": "Certificación SQL", "skill_ids": [skill["id"]]}).json()
    assert credential["skill_ids"] == [skill["id"]]

    old_payload = {"issuer_name": "Entidad libre", "credential_name": "Texto libre", "issued_on": "2026-01-01"}
    assert student.post(base + "/certifications", json=old_payload).status_code == 422
    with factory() as session:
        assert session.query(Issuer).count() == 1

    proposal = student.post(base + "/catalog/proposals", json={"kind": "SKILL", "proposed_name": "Grafos"}).json()
    assert proposal["status"] == "PENDING"
    draft = student.post(base + "/catalog/drafts", json={"issuer_id": issuer["id"], "catalog_credential_id": credential["id"], "proposal_ids": [proposal["id"]], "issued_on": "2026-01-01", "source_url": "https://example.org/verify"}).json()
    assert draft["proposals"][0]["status"] == "PENDING"
    assert student.post(base + f"/catalog/drafts/{draft['id']}/submit", json={"issuer_id": issuer["id"], "catalog_credential_id": credential["id"], "skill_ids": [skill["id"]]}).status_code == 409
    assert validator.get(base + "/validations").json() == []
    assert validator.post(base + f"/catalog/proposals/{proposal['id']}/resolve", json={"target_id": skill["id"], "reason": "Coincide"}).status_code == 403
    assert admin.post(base + f"/catalog/proposals/{proposal['id']}/resolve", json={"target_id": skill["id"], "reason": "Vinculada a la habilidad existente"}).status_code == 200
    submitted = student.post(base + f"/catalog/drafts/{draft['id']}/submit", json={"issuer_id": issuer["id"], "catalog_credential_id": credential["id"], "skill_ids": [skill["id"]]})
    assert submitted.status_code == 200, submitted.text
    assert student.patch(base + f"/certifications/{submitted.json()['certification_id']}", json={"issuer_name": "Entidad libre"}).status_code == 422
    assert student.post(base + f"/catalog/drafts/{draft['id']}/submit", json={"issuer_id": issuer["id"], "catalog_credential_id": credential["id"], "skill_ids": [skill["id"]]}).status_code == 200
    certification_id = submitted.json()["certification_id"]
    assert validator.post(base + f"/validations/{certification_id}", json={"action": "START_REVIEW"}).status_code == 200
    assert validator.post(base + f"/validations/{certification_id}", json={"action": "APPROVE"}).status_code == 422
    decision = validator.post(base + f"/validations/{certification_id}", json={"action": "APPROVE", "catalog_confirmed": True})
    assert decision.status_code == 200, decision.text
    assert student.get(base + f"/certifications/{certification_id}").json()["status"] == "APPROVED"
    with factory() as session:
        approved = session.get(Certification, UUID(certification_id))
        assert str(approved.issuer_id) == issuer["id"]
        assert str(approved.catalog_credential_id) == credential["id"]
    second_draft = student.post(base + "/catalog/drafts", json={"issuer_id": issuer["id"], "catalog_credential_id": credential["id"], "issued_on": "2026-02-01"}).json()
    upload = student.post(base + f"/catalog/drafts/{second_draft['id']}/evidence", files={"file": ("prueba.pdf", b"%PDF-1.4\nsynthetic evidence\n%%EOF", "application/pdf")})
    assert upload.status_code == 200, upload.text
    assert upload.json()["evidence_filename"] == "prueba.pdf"
    saved = student.post(base + f"/catalog/drafts/{second_draft['id']}/submit", json={"issuer_id": issuer["id"], "catalog_credential_id": credential["id"], "skill_ids": [skill["id"]]})
    assert saved.status_code == 200, saved.text
    assert student.get(base + f"/certifications/{saved.json()['certification_id']}").json()["evidences"]

    course = admin.post(base + "/learning/courses", json={"title": "Curso externo", "provider": "Academia", "source_url": "https://example.org/curso", "checked_on": date.today().isoformat(), "requirements": [], "skills": ["SQL"]}).json()
    assert student.get(base + "/learning/courses").json() == []
    admin.post(base + f"/learning/courses/{course['id']}/status", json={"status": "IN_REVIEW", "reason": "Fuente revisada"})
    offer = admin.post(base + "/learning/offers", json={"course_id": course["id"], "title": "Curso externo", "cycles": ["V"], "interest_ids": [], "relevance": "Formación pertinente para la escuela"}).json()
    assert student.get(base + "/learning/offers").json() == []
    response = admin.post(base + f"/learning/offers/{offer['id']}/status", json={"status": "PUBLISHED", "reason": "Verificado y autorizado"})
    assert response.status_code == 200, response.text
    assert len(student.get(base + "/learning/offers").json()) == 1
    assert student.get(base + "/learning/workshops").json() == []
    engine.dispose()
