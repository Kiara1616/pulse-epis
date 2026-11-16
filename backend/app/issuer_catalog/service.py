"""Issuer catalog management and validator-to-admin resolution workflow."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
from urllib.parse import urlsplit
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import Settings
from ..db.models import AuditLog, Certification, Issuer, IssuerRequest, Student, User


UNRESOLVED_ISSUER_NAMES = frozenset({"por confirmar", "emisor por confirmar", "sin emisor"})


class IssuerCatalogError(RuntimeError):
    """Base class for issuer catalog failures."""


class IssuerActorNotAllowed(IssuerCatalogError):
    pass


class IssuerNotFound(IssuerCatalogError):
    pass


class IssuerRequestNotFound(IssuerCatalogError):
    pass


class IssuerCatalogInvalid(IssuerCatalogError):
    pass


class IssuerCatalogConflict(IssuerCatalogError):
    pass


class IssuerCatalogUnavailable(IssuerCatalogError):
    pass


@dataclass(frozen=True, slots=True)
class IssuerView:
    id: UUID
    name: str
    website_url: str | None
    logo_url: str | None
    created_at: datetime


@dataclass(frozen=True, slots=True)
class IssuerRequestView:
    id: UUID
    certification_id: UUID
    credential_name: str
    student_name: str
    raw_name: str
    website_url: str | None
    note: str
    status: str
    resolved_issuer_id: UUID | None
    decision_comment: str | None
    created_at: datetime
    updated_at: datetime
    decided_at: datetime | None


@dataclass(frozen=True, slots=True)
class IssuerResolutionView:
    certification_id: UUID
    issuer: IssuerView
    request_id: UUID | None = None


class IssuerCatalogServiceProtocol(Protocol):
    def list_issuers(self) -> list[IssuerView]: ...

    def create_issuer(
        self,
        actor_user_id: UUID,
        *,
        name: str,
        website_url: str | None = None,
        logo_url: str | None = None,
    ) -> IssuerView: ...

    def update_issuer(
        self,
        actor_user_id: UUID,
        issuer_id: UUID,
        *,
        name: str | None = None,
        website_url: str | None = None,
        logo_url: str | None = None,
    ) -> IssuerView: ...

    def assign_issuer(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        issuer_id: UUID,
    ) -> IssuerResolutionView: ...

    def create_request(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        *,
        raw_name: str | None,
        website_url: str | None,
        note: str,
    ) -> IssuerRequestView: ...

    def list_requests(self, actor_user_id: UUID, *, status_filter: str | None = None) -> list[IssuerRequestView]: ...

    def approve_request(
        self,
        actor_user_id: UUID,
        request_id: UUID,
        *,
        issuer_id: UUID | None = None,
        name: str | None = None,
        website_url: str | None = None,
        logo_url: str | None = None,
        comment: str | None = None,
    ) -> IssuerRequestView: ...

    def reject_request(
        self,
        actor_user_id: UUID,
        request_id: UUID,
        *,
        comment: str,
    ) -> IssuerRequestView: ...


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _text(value: str | None, *, field: str, maximum: int, required: bool = True) -> str | None:
    if value is None:
        if required:
            raise IssuerCatalogInvalid(f"{field} is required")
        return None
    normalized = " ".join(value.strip().split())
    if not normalized:
        if required:
            raise IssuerCatalogInvalid(f"{field} is required")
        return None
    if len(normalized) > maximum:
        raise IssuerCatalogInvalid(f"{field} is invalid")
    return normalized


def _url(value: str | None, *, field: str) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    parsed = urlsplit(normalized)
    if (
        parsed.scheme.lower() not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or len(normalized) > 2048
    ):
        raise IssuerCatalogInvalid(f"{field} must be an HTTP(S) URL")
    return normalized


def is_unresolved_issuer(name: str | None) -> bool:
    return (name or "").strip().casefold() in UNRESOLVED_ISSUER_NAMES


def _audit(
    session: Session,
    *,
    actor_user_id: UUID | None,
    action: str,
    entity_type: str,
    entity_id: UUID | str,
    before: dict[str, object] | None,
    after: dict[str, object] | None,
) -> None:
    session.add(
        AuditLog(
            id=uuid4(),
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            before_data=before,
            after_data=after,
            created_at=_now(),
        )
    )


class IssuerCatalogService:
    def __init__(self, session_factory: sessionmaker[Session], settings: Settings) -> None:
        self._session_factory = session_factory
        self._settings = settings

    def _actor(self, session: Session, actor_user_id: UUID, *roles: str) -> User:
        actor = session.get(User, actor_user_id)
        if actor is None or not actor.is_active or actor.role not in roles:
            raise IssuerActorNotAllowed("El rol actual no puede gestionar la resolución de emisores")
        return actor

    @staticmethod
    def _issuer_view(issuer: Issuer) -> IssuerView:
        return IssuerView(
            id=issuer.id,
            name=issuer.name,
            website_url=issuer.website_url,
            logo_url=issuer.logo_url,
            created_at=issuer.created_at,
        )

    @staticmethod
    def _request_view(session: Session, request: IssuerRequest) -> IssuerRequestView:
        certification = session.get(Certification, request.certification_id)
        student = session.get(Student, certification.student_id) if certification else None
        return IssuerRequestView(
            id=request.id,
            certification_id=request.certification_id,
            credential_name=certification.credential_name if certification else "Certificación no disponible",
            student_name=(student.full_name if student else None) or (student.student_key if student else "Estudiante no disponible"),
            raw_name=request.raw_name,
            website_url=request.website_url,
            note=request.note,
            status=request.status,
            resolved_issuer_id=request.resolved_issuer_id,
            decision_comment=request.decision_comment,
            created_at=request.created_at,
            updated_at=request.updated_at,
            decided_at=request.decided_at,
        )

    def list_issuers(self) -> list[IssuerView]:
        try:
            with self._session_factory() as session:
                rows = session.scalars(select(Issuer).order_by(Issuer.name)).all()
                return [self._issuer_view(item) for item in rows if not is_unresolved_issuer(item.name)]
        except IssuerCatalogError:
            raise
        except Exception as exc:
            raise IssuerCatalogUnavailable("El catálogo de emisores no está disponible") from exc

    def create_issuer(
        self,
        actor_user_id: UUID,
        *,
        name: str,
        website_url: str | None = None,
        logo_url: str | None = None,
    ) -> IssuerView:
        normalized_name = _text(name, field="name", maximum=150)
        if normalized_name is None or is_unresolved_issuer(normalized_name):
            raise IssuerCatalogInvalid("El nombre del emisor debe ser concreto")
        website = _url(website_url, field="website_url")
        logo = _url(logo_url, field="logo_url")
        session = self._session_factory()
        try:
            with session.begin():
                self._actor(session, actor_user_id, "ADMIN")
                duplicate = session.scalar(select(Issuer).where(func.lower(Issuer.name) == normalized_name.casefold()))
                if duplicate is not None:
                    raise IssuerCatalogConflict("La entidad emisora ya existe")
                issuer = Issuer(id=uuid4(), name=normalized_name, website_url=website, logo_url=logo, created_at=_now())
                session.add(issuer)
                session.flush()
                _audit(session, actor_user_id=actor_user_id, action="ISSUER_CREATED", entity_type="ISSUER", entity_id=issuer.id, before=None, after={"name": issuer.name, "website_url": issuer.website_url})
                return self._issuer_view(issuer)
        except (IssuerActorNotAllowed, IssuerCatalogInvalid, IssuerCatalogConflict):
            raise
        except IntegrityError as exc:
            raise IssuerCatalogConflict("La entidad emisora ya existe") from exc
        except Exception as exc:
            raise IssuerCatalogUnavailable("El catálogo de emisores no está disponible") from exc
        finally:
            session.close()

    def update_issuer(
        self,
        actor_user_id: UUID,
        issuer_id: UUID,
        *,
        name: str | None = None,
        website_url: str | None = None,
        logo_url: str | None = None,
    ) -> IssuerView:
        normalized_name = _text(name, field="name", maximum=150, required=False)
        if normalized_name is not None and is_unresolved_issuer(normalized_name):
            raise IssuerCatalogInvalid("El nombre del emisor debe ser concreto")
        website = _url(website_url, field="website_url") if website_url is not None else None
        logo = _url(logo_url, field="logo_url") if logo_url is not None else None
        session = self._session_factory()
        try:
            with session.begin():
                self._actor(session, actor_user_id, "ADMIN")
                issuer = session.get(Issuer, issuer_id)
                if issuer is None or is_unresolved_issuer(issuer.name):
                    raise IssuerNotFound("La entidad emisora no existe")
                before = {"name": issuer.name, "website_url": issuer.website_url, "logo_url": issuer.logo_url}
                if normalized_name is not None:
                    duplicate = session.scalar(select(Issuer).where(func.lower(Issuer.name) == normalized_name.casefold(), Issuer.id != issuer.id))
                    if duplicate is not None:
                        raise IssuerCatalogConflict("La entidad emisora ya existe")
                    issuer.name = normalized_name
                if website_url is not None:
                    issuer.website_url = website
                if logo_url is not None:
                    issuer.logo_url = logo
                session.flush()
                _audit(session, actor_user_id=actor_user_id, action="ISSUER_UPDATED", entity_type="ISSUER", entity_id=issuer.id, before=before, after={"name": issuer.name, "website_url": issuer.website_url, "logo_url": issuer.logo_url})
                return self._issuer_view(issuer)
        except (IssuerActorNotAllowed, IssuerNotFound, IssuerCatalogInvalid, IssuerCatalogConflict):
            raise
        except Exception as exc:
            raise IssuerCatalogUnavailable("El catálogo de emisores no está disponible") from exc
        finally:
            session.close()

    def assign_issuer(self, actor_user_id: UUID, certification_id: UUID, issuer_id: UUID) -> IssuerResolutionView:
        session = self._session_factory()
        try:
            with session.begin():
                self._actor(session, actor_user_id, "VALIDATOR")
                certification = session.get(Certification, certification_id)
                issuer = session.get(Issuer, issuer_id)
                if certification is None:
                    raise IssuerNotFound("La certificación no existe")
                if issuer is None or is_unresolved_issuer(issuer.name):
                    raise IssuerNotFound("La entidad emisora no existe en el catálogo")
                if certification.status in {"APPROVED", "REJECTED", "EXPIRED"}:
                    raise IssuerCatalogInvalid("Solo se pueden resolver certificaciones pendientes de validación")
                old = session.get(Issuer, certification.issuer_id)
                if old is None:
                    raise IssuerCatalogUnavailable("La certificación tiene un emisor incompleto")
                certification.issuer_id = issuer.id
                certification.updated_at = _now()
                _audit(session, actor_user_id=actor_user_id, action="CERTIFICATION_ISSUER_ASSIGNED", entity_type="CERTIFICATION", entity_id=certification.id, before={"issuer_id": str(old.id), "issuer_name": old.name}, after={"issuer_id": str(issuer.id), "issuer_name": issuer.name})
                session.flush()
                return IssuerResolutionView(certification_id=certification.id, issuer=self._issuer_view(issuer))
        except (IssuerActorNotAllowed, IssuerNotFound, IssuerCatalogInvalid, IssuerCatalogUnavailable):
            raise
        except Exception as exc:
            raise IssuerCatalogUnavailable("No se pudo asignar la entidad emisora") from exc
        finally:
            session.close()

    def create_request(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        *,
        raw_name: str | None,
        website_url: str | None,
        note: str,
    ) -> IssuerRequestView:
        name = _text(raw_name, field="raw_name", maximum=150, required=False)
        normalized_note = _text(note, field="note", maximum=2000)
        website = _url(website_url, field="website_url")
        session = self._session_factory()
        try:
            with session.begin():
                self._actor(session, actor_user_id, "VALIDATOR")
                certification = session.get(Certification, certification_id)
                if certification is None:
                    raise IssuerNotFound("La certificación no existe")
                if certification.status in {"APPROVED", "REJECTED", "EXPIRED"}:
                    raise IssuerCatalogInvalid("La certificación ya no admite resolución de emisor")
                current = session.get(Issuer, certification.issuer_id)
                resolved_name = name or (current.name if current and not is_unresolved_issuer(current.name) else None)
                if resolved_name is None or is_unresolved_issuer(resolved_name):
                    raise IssuerCatalogInvalid("Indica el nombre de la entidad emisora")
                duplicate = session.scalar(select(IssuerRequest).where(IssuerRequest.certification_id == certification.id, IssuerRequest.status == "PENDING"))
                if duplicate is not None:
                    raise IssuerCatalogConflict("Ya existe una solicitud pendiente para esta certificación")
                request = IssuerRequest(id=uuid4(), certification_id=certification.id, requested_by_user_id=actor_user_id, raw_name=resolved_name, website_url=website, note=normalized_note or "", status="PENDING", created_at=_now(), updated_at=_now())
                session.add(request)
                session.flush()
                _audit(session, actor_user_id=actor_user_id, action="ISSUER_REQUEST_CREATED", entity_type="ISSUER_REQUEST", entity_id=request.id, before=None, after={"certification_id": str(certification.id), "raw_name": resolved_name})
                return self._request_view(session, request)
        except (IssuerActorNotAllowed, IssuerNotFound, IssuerCatalogInvalid, IssuerCatalogConflict):
            raise
        except Exception as exc:
            raise IssuerCatalogUnavailable("No se pudo registrar la solicitud de emisor") from exc
        finally:
            session.close()

    def list_requests(self, actor_user_id: UUID, *, status_filter: str | None = None) -> list[IssuerRequestView]:
        if status_filter is not None and status_filter not in {"PENDING", "APPROVED", "REJECTED"}:
            raise IssuerCatalogInvalid("El estado de solicitud no es válido")
        try:
            with self._session_factory() as session:
                self._actor(session, actor_user_id, "ADMIN")
                statement = select(IssuerRequest).order_by(IssuerRequest.created_at.desc(), IssuerRequest.id)
                if status_filter is not None:
                    statement = statement.where(IssuerRequest.status == status_filter)
                return [self._request_view(session, item) for item in session.scalars(statement).all()]
        except (IssuerActorNotAllowed, IssuerCatalogInvalid):
            raise
        except Exception as exc:
            raise IssuerCatalogUnavailable("Las solicitudes de emisor no están disponibles") from exc

    def approve_request(
        self,
        actor_user_id: UUID,
        request_id: UUID,
        *,
        issuer_id: UUID | None = None,
        name: str | None = None,
        website_url: str | None = None,
        logo_url: str | None = None,
        comment: str | None = None,
    ) -> IssuerRequestView:
        requested_name = _text(name, field="name", maximum=150, required=False)
        website = _url(website_url, field="website_url") if website_url is not None else None
        logo = _url(logo_url, field="logo_url") if logo_url is not None else None
        normalized_comment = _text(comment, field="comment", maximum=2000, required=False)
        session = self._session_factory()
        try:
            with session.begin():
                self._actor(session, actor_user_id, "ADMIN")
                request = session.scalar(select(IssuerRequest).where(IssuerRequest.id == request_id).with_for_update())
                if request is None:
                    raise IssuerRequestNotFound("La solicitud de emisor no existe")
                if request.status != "PENDING":
                    raise IssuerCatalogConflict("La solicitud ya fue resuelta")
                issuer = session.get(Issuer, issuer_id) if issuer_id else None
                canonical_name = requested_name or request.raw_name
                if issuer_id is not None and issuer is None:
                    raise IssuerNotFound("La entidad emisora seleccionada no existe")
                if issuer is not None and is_unresolved_issuer(issuer.name):
                    raise IssuerCatalogInvalid("La entidad seleccionada no es válida")
                if issuer is None:
                    issuer = session.scalar(select(Issuer).where(func.lower(Issuer.name) == canonical_name.casefold()))
                    if issuer is None:
                        issuer = Issuer(id=uuid4(), name=canonical_name, website_url=website or request.website_url, logo_url=logo, created_at=_now())
                        session.add(issuer)
                        session.flush()
                    elif is_unresolved_issuer(issuer.name):
                        raise IssuerCatalogInvalid("El nombre del emisor debe ser concreto")
                if website_url is not None:
                    issuer.website_url = website
                if logo_url is not None:
                    issuer.logo_url = logo
                certification = session.get(Certification, request.certification_id)
                if certification is None:
                    raise IssuerNotFound("La certificación asociada no existe")
                old = session.get(Issuer, certification.issuer_id)
                certification.issuer_id = issuer.id
                certification.updated_at = _now()
                request.status = "APPROVED"
                request.resolved_issuer_id = issuer.id
                request.decision_actor_user_id = actor_user_id
                request.decision_comment = normalized_comment
                request.updated_at = _now()
                request.decided_at = request.updated_at
                _audit(session, actor_user_id=actor_user_id, action="ISSUER_REQUEST_APPROVED", entity_type="ISSUER_REQUEST", entity_id=request.id, before={"status": "PENDING"}, after={"status": request.status, "issuer_id": str(issuer.id)})
                _audit(session, actor_user_id=actor_user_id, action="CERTIFICATION_ISSUER_RESOLVED", entity_type="CERTIFICATION", entity_id=certification.id, before={"issuer_id": str(old.id) if old else None, "issuer_name": old.name if old else None}, after={"issuer_id": str(issuer.id), "issuer_name": issuer.name, "request_id": str(request.id)})
                session.flush()
                return self._request_view(session, request)
        except (IssuerActorNotAllowed, IssuerRequestNotFound, IssuerNotFound, IssuerCatalogInvalid, IssuerCatalogConflict):
            raise
        except IntegrityError as exc:
            raise IssuerCatalogConflict("La entidad emisora ya existe") from exc
        except Exception as exc:
            raise IssuerCatalogUnavailable("No se pudo aprobar la solicitud de emisor") from exc
        finally:
            session.close()

    def reject_request(self, actor_user_id: UUID, request_id: UUID, *, comment: str) -> IssuerRequestView:
        normalized_comment = _text(comment, field="comment", maximum=2000)
        session = self._session_factory()
        try:
            with session.begin():
                self._actor(session, actor_user_id, "ADMIN")
                request = session.scalar(select(IssuerRequest).where(IssuerRequest.id == request_id).with_for_update())
                if request is None:
                    raise IssuerRequestNotFound("La solicitud de emisor no existe")
                if request.status != "PENDING":
                    raise IssuerCatalogConflict("La solicitud ya fue resuelta")
                request.status = "REJECTED"
                request.decision_actor_user_id = actor_user_id
                request.decision_comment = normalized_comment
                request.updated_at = _now()
                request.decided_at = request.updated_at
                _audit(session, actor_user_id=actor_user_id, action="ISSUER_REQUEST_REJECTED", entity_type="ISSUER_REQUEST", entity_id=request.id, before={"status": "PENDING"}, after={"status": request.status, "comment": normalized_comment})
                session.flush()
                return self._request_view(session, request)
        except (IssuerActorNotAllowed, IssuerRequestNotFound, IssuerCatalogInvalid, IssuerCatalogConflict):
            raise
        except Exception as exc:
            raise IssuerCatalogUnavailable("No se pudo rechazar la solicitud de emisor") from exc
        finally:
            session.close()


class UnavailableIssuerCatalogService:
    def _raise(self) -> None:
        raise IssuerCatalogUnavailable("PULSE_DATABASE_URL no está configurado")

    def list_issuers(self) -> list[IssuerView]:
        self._raise()
        return []

    def create_issuer(self, actor_user_id: UUID, *, name: str, website_url: str | None = None, logo_url: str | None = None) -> IssuerView:
        self._raise()
        raise AssertionError("unreachable")

    def update_issuer(self, actor_user_id: UUID, issuer_id: UUID, *, name: str | None = None, website_url: str | None = None, logo_url: str | None = None) -> IssuerView:
        self._raise()
        raise AssertionError("unreachable")

    def assign_issuer(self, actor_user_id: UUID, certification_id: UUID, issuer_id: UUID) -> IssuerResolutionView:
        self._raise()
        raise AssertionError("unreachable")

    def create_request(self, actor_user_id: UUID, certification_id: UUID, *, raw_name: str | None, website_url: str | None, note: str) -> IssuerRequestView:
        self._raise()
        raise AssertionError("unreachable")

    def list_requests(self, actor_user_id: UUID, *, status_filter: str | None = None) -> list[IssuerRequestView]:
        self._raise()
        return []

    def approve_request(self, actor_user_id: UUID, request_id: UUID, *, issuer_id: UUID | None = None, name: str | None = None, website_url: str | None = None, logo_url: str | None = None, comment: str | None = None) -> IssuerRequestView:
        self._raise()
        raise AssertionError("unreachable")

    def reject_request(self, actor_user_id: UUID, request_id: UUID, *, comment: str) -> IssuerRequestView:
        self._raise()
        raise AssertionError("unreachable")


__all__ = [
    "IssuerActorNotAllowed",
    "IssuerCatalogConflict",
    "IssuerCatalogInvalid",
    "IssuerCatalogService",
    "IssuerCatalogServiceProtocol",
    "IssuerCatalogUnavailable",
    "IssuerNotFound",
    "IssuerRequestNotFound",
    "IssuerRequestView",
    "IssuerResolutionView",
    "IssuerView",
    "UnavailableIssuerCatalogService",
    "is_unresolved_issuer",
]
