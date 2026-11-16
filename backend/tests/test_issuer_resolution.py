from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.models import Certification, Issuer
from backend.app.issuer_catalog.service import IssuerCatalogService
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
