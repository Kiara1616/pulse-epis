from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.models import Certification, Issuer
from backend.app.issuer_catalog.service import IssuerCatalogConflict, IssuerCatalogInvalid, IssuerCatalogService
from backend.app.validation.service import ValidationInvalid, ValidationService
from backend.tests.test_validation import make_context


def test_validator_can_assign_existing_issuer_and_admin_can_create_catalog_entry(tmp_path):
    engine, session_factory, settings, _, validator_user_id, admin_user_id, certification_id = make_context(tmp_path)
    catalog = IssuerCatalogService(session_factory, settings)

    created = catalog.create_issuer(
        admin_user_id,
        name="Linux Foundation",
        website_url="https://www.linuxfoundation.org",
    )
    resolved = catalog.assign_issuer(validator_user_id, certification_id, created.id)

    assert resolved.issuer.name == "Linux Foundation"
    with Session(engine) as session:
        certification = session.get(Certification, certification_id)
        assert certification is not None
        assert certification.issuer_id == created.id
    engine.dispose()


def test_unknown_issuer_requires_request_and_admin_resolution_before_approval(tmp_path):
    engine, session_factory, settings, _, validator_user_id, admin_user_id, certification_id = make_context(tmp_path)
    unknown_id = uuid4()
    with Session(engine) as session:
        session.add(Issuer(id=unknown_id, name="Por confirmar", created_at=datetime.now(timezone.utc)))
        certification = session.get(Certification, certification_id)
        assert certification is not None
        certification.issuer_id = unknown_id
        session.commit()

    validation = ValidationService(session_factory, settings)
    validation.transition(
        validator_user_id,
        certification_id,
        action="START_REVIEW",
        cutoff_date=date(2026, 9, 13),
    )
    with pytest.raises(ValidationInvalid, match="Resuelve la entidad emisora"):
        validation.transition(
            validator_user_id,
            certification_id,
            action="APPROVE",
            cutoff_date=date(2026, 9, 13),
        )

    request = IssuerCatalogService(session_factory, settings).create_request(
        validator_user_id,
        certification_id,
        raw_name="Linux Foundation",
        website_url="https://www.linuxfoundation.org",
        note="El certificado muestra el emisor oficial en el enlace de verificación.",
    )
    approved_request = IssuerCatalogService(session_factory, settings).approve_request(
        admin_user_id,
        request.id,
    )
    assert approved_request.status == "APPROVED"
    approved = validation.transition(
        validator_user_id,
        certification_id,
        action="APPROVE",
        comment="Emisor resuelto y evidencia verificada",
        cutoff_date=date(2026, 9, 13),
    )
    assert approved.status == "APPROVED"

    with Session(engine) as session:
        assert session.scalar(select(Issuer).where(Issuer.name == "Linux Foundation")) is not None
    engine.dispose()


def test_admin_can_edit_archive_and_restore_issuer_without_breaking_history(tmp_path):
    engine, session_factory, settings, _, validator_user_id, admin_user_id, certification_id = make_context(tmp_path)
    catalog = IssuerCatalogService(session_factory, settings)
    created = catalog.create_issuer(admin_user_id, name="Issuer Original", website_url="https://issuer.example")

    updated = catalog.update_issuer(admin_user_id, created.id, name="Issuer Oficial")
    assert updated.id == created.id
    assert updated.name == "Issuer Oficial"

    archived = catalog.archive_issuer(admin_user_id, created.id)
    assert archived.id == created.id
    assert archived.is_active is False
    assert all(item.id != created.id for item in catalog.list_issuers())
    assert catalog.list_issuers(include_inactive=True)[0].name == "Issuer Oficial"

    with pytest.raises(IssuerCatalogInvalid, match="retirada"):
        catalog.assign_issuer(validator_user_id, certification_id, created.id)

    restored = catalog.restore_issuer(admin_user_id, created.id)
    assert restored.is_active is True
    assigned = catalog.assign_issuer(validator_user_id, certification_id, created.id)
    assert assigned.issuer.id == created.id
    with Session(engine) as session:
        certification = session.get(Certification, certification_id)
        assert certification is not None and certification.issuer_id == created.id
    engine.dispose()


def test_retired_issuer_cannot_be_selected_for_new_request_approval(tmp_path):
    engine, session_factory, settings, _, validator_user_id, admin_user_id, certification_id = make_context(tmp_path)
    catalog = IssuerCatalogService(session_factory, settings)
    created = catalog.create_issuer(admin_user_id, name="Issuer Retirable")
    catalog.archive_issuer(admin_user_id, created.id)
    request = catalog.create_request(
        validator_user_id,
        certification_id,
        raw_name="Issuer Retirable",
        website_url=None,
        note="El emisor debe revisarse.",
    )
    with pytest.raises(IssuerCatalogInvalid, match="retirada"):
        catalog.approve_request(admin_user_id, request.id, issuer_id=created.id)
    with pytest.raises(IssuerCatalogConflict):
        catalog.archive_issuer(admin_user_id, created.id)
    engine.dispose()


def test_student_names_are_never_accepted_or_listed_as_issuers(tmp_path):
    engine, session_factory, settings, _, validator_user_id, admin_user_id, certification_id = make_context(tmp_path)
    catalog = IssuerCatalogService(session_factory, settings)

    with pytest.raises(IssuerCatalogInvalid, match="coincide con un estudiante"):
        catalog.create_issuer(admin_user_id, name="Estudiante de prueba")

    student_issuer_id = uuid4()
    with Session(engine) as session:
        session.add(Issuer(id=student_issuer_id, name="ESTUDIANTE DE PRUEBA", created_at=datetime.now(timezone.utc)))
        session.commit()

    assert all(item.name.casefold() != "estudiante de prueba" for item in catalog.list_issuers())
    with pytest.raises(IssuerCatalogInvalid, match="coincide con un estudiante"):
        catalog.assign_issuer(validator_user_id, certification_id, student_issuer_id)
    engine.dispose()
