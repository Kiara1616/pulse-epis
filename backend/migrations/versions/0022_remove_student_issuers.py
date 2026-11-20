"""Remove roster student names accidentally stored as issuer entities.

LinkedIn actors can return the publication author where an issuer is absent.
Those values are not catalog entities.  Keep the history auditable by archiving
the bad issuer rows and moving their certifications/facts to the canonical
``Por confirmar`` issuer so a validator can resolve them again.
"""

from __future__ import annotations

import unicodedata
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op


revision = "0022_remove_student_issuers"
down_revision = "0021_issuer_lifecycle"
branch_labels = None
depends_on = None


def _person_key(value: str | None) -> str:
    if not value:
        return ""
    decomposed = unicodedata.normalize("NFKD", value)
    without_marks = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(
        "".join(char if char.isalnum() else " " for char in without_marks).casefold().split()
    )


def _table(connection: sa.Connection, name: str) -> sa.Table:
    return sa.Table(name, sa.MetaData(), autoload_with=connection)


def _unresolved_issuer_id(connection: sa.Connection, issuers: sa.Table) -> object:
    existing = connection.execute(
        sa.select(issuers.c.id)
        .where(sa.func.lower(issuers.c.name) == "por confirmar")
        .limit(1)
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    issuer_id = str(uuid4())
    connection.execute(
        issuers.insert().values(
            id=issuer_id,
            name="Por confirmar",
            website_url=None,
            logo_url=None,
            is_active=True,
            archived_at=None,
            created_at=datetime.now(timezone.utc),
        )
    )
    return issuer_id


def upgrade() -> None:
    connection = op.get_bind()
    students = _table(connection, "students")
    issuers = _table(connection, "issuers")
    certifications = _table(connection, "certifications")
    history = _table(connection, "certification_status_history")
    facts = _table(connection, "fact_certification")
    requests = _table(connection, "issuer_requests")
    audit_logs = _table(connection, "audit_logs")

    student_names = {
        key
        for key in (
            _person_key(row.full_name)
            for row in connection.execute(sa.select(students.c.full_name)).all()
        )
        if key
    }
    if not student_names:
        # Still guarantee the fallback exists for future imports.  The service
        # hides unresolved issuers from selection lists.
        _unresolved_issuer_id(connection, issuers)
        return

    issuer_rows = connection.execute(
        sa.select(issuers.c.id, issuers.c.name).order_by(issuers.c.id)
    ).all()
    invalid_issuers = [row for row in issuer_rows if _person_key(row.name) in student_names]
    unresolved_id = _unresolved_issuer_id(connection, issuers)
    now = datetime.now(timezone.utc)

    for issuer in invalid_issuers:
        certification_rows = connection.execute(
            sa.select(certifications.c.id, certifications.c.status).where(
                certifications.c.issuer_id == issuer.id
            )
        ).all()
        for certification in certification_rows:
            previous_status = certification.status
            connection.execute(
                certifications.update()
                .where(certifications.c.id == certification.id)
                .values(
                    issuer_id=unresolved_id,
                    status="PENDING",
                    updated_at=now,
                )
            )
            if previous_status != "PENDING":
                connection.execute(
                    history.insert().values(
                        id=str(uuid4()),
                        certification_id=certification.id,
                        actor_user_id=None,
                        from_status=previous_status,
                        to_status="PENDING",
                        comment="Emisor corregido: coincidía con el nombre de un estudiante; requiere resolución.",
                        cutoff_date=None,
                        changed_at=now,
                    )
                )

        connection.execute(
            facts.update()
            .where(facts.c.issuer_id == issuer.id)
            .values(issuer_id=unresolved_id, status="PENDING")
        )
        connection.execute(
            requests.update()
            .where(
                sa.or_(
                    requests.c.resolved_issuer_id == issuer.id,
                    sa.func.lower(requests.c.raw_name) == sa.func.lower(issuer.name),
                )
            )
            .values(
                resolved_issuer_id=None,
                status="REJECTED",
                decision_comment="Solicitud descartada: el nombre correspondía a un estudiante, no a una entidad emisora.",
                updated_at=now,
                decided_at=now,
            )
        )
        connection.execute(
            issuers.update()
            .where(issuers.c.id == issuer.id)
            .values(is_active=False, archived_at=now)
        )
        connection.execute(
            audit_logs.insert().values(
                id=str(uuid4()),
                actor_user_id=None,
                action="ISSUER_STUDENT_NAME_CLEANUP",
                entity_type="ISSUER",
                entity_id=str(issuer.id),
                before_data={"name": issuer.name, "is_active": True},
                after_data={
                    "name": issuer.name,
                    "is_active": False,
                    "replacement": "Por confirmar",
                },
                idempotency_key=None,
                created_at=now,
            )
        )


def downgrade() -> None:
    # The migration intentionally archives and reclassifies data. Reversing it
    # automatically could reintroduce a student as an issuer, so it is a safe
    # no-op and the audit log remains the source of truth.
    pass
