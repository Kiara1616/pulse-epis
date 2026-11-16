"""Consent-aware LinkedIn synchronization backed by Apify actors.

Only normalized certification candidates are persisted.  Raw Apify payloads
are intentionally discarded and every candidate is created as ``PENDING`` so
that a validator still makes the official decision.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from ..certifications.service import (
    CertificationDraft,
    CertificationDuplicate,
    CertificationServiceProtocol,
    SkillInput,
    StudentNotProvisioned,
    _audit,
)
from ..core.config import Settings
from ..db.models import Certification, Student
from ..integrations.apify import (
    ApifyClient,
    ApifyIntegrationError,
    LinkedInCandidate,
    normalize_linkedin_url,
    normalize_profile_certifications,
    normalize_publication_candidates,
)


logger = logging.getLogger(__name__)


class LinkedInServiceUnavailable(RuntimeError):
    """The persistence or integration dependency is unavailable."""


class LinkedInSyncCooldown(RuntimeError):
    """A recent successful synchronization must not be charged again yet."""


@dataclass(frozen=True, slots=True)
class LinkedInProfileView:
    linkedin_url: str | None
    consent_at: datetime | None
    last_sync_at: datetime | None
    sync_status: str
    sync_error: str | None
    pending_candidates: int


@dataclass(frozen=True, slots=True)
class LinkedInSyncReport:
    profile_candidates: int
    publication_candidates: int
    created: int
    duplicates: int
    status: str
    message: str


class LinkedInServiceProtocol(Protocol):
    def get_profile(self, actor_user_id: UUID) -> LinkedInProfileView:
        """Return the consent and synchronization state for the signed-in student."""

    def update_profile(self, actor_user_id: UUID, linkedin_url: str | None) -> LinkedInProfileView:
        """Store or clear the signed-in student's LinkedIn profile URL."""

    def sync_profile(self, actor_user_id: UUID, *, force: bool = False) -> LinkedInSyncReport:
        """Extract public profile data and queue normalized candidates for validation."""


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _safe_error(exc: Exception) -> str:
    """Do not persist a token, response body, or stack trace in user-visible data."""

    message = " ".join(str(exc).split())
    return message[:500] or "No se pudo sincronizar el perfil."


class LinkedInSyncService:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        settings: Settings,
        certification_service: CertificationServiceProtocol,
        apify_client: ApifyClient | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._settings = settings
        self._certification_service = certification_service
        self._apify = apify_client or ApifyClient(settings)

    @staticmethod
    def _pending_count(session: Session, student_id: UUID) -> int:
        value = session.scalar(
            select(func.count(Certification.id)).where(
                Certification.student_id == student_id,
                Certification.source_kind.in_(
                    ("LINKEDIN_PROFILE", "LINKEDIN_PUBLICATION")
                ),
                Certification.status.in_(
                    ("PENDING", "UNDER_REVIEW", "OBSERVED", "RESUBMITTED")
                ),
            )
        )
        return int(value or 0)

    def _view(self, session: Session, student: Student) -> LinkedInProfileView:
        return LinkedInProfileView(
            linkedin_url=student.linkedin_url,
            consent_at=_as_utc(student.linkedin_consent_at),
            last_sync_at=_as_utc(student.linkedin_last_sync_at),
            sync_status=student.linkedin_sync_status,
            sync_error=student.linkedin_sync_error,
            pending_candidates=self._pending_count(session, student.id),
        )

    @staticmethod
    def _student(session: Session, actor_user_id: UUID) -> Student:
        student = session.scalar(select(Student).where(Student.user_id == actor_user_id))
        if student is None:
            raise StudentNotProvisioned("The account is not linked to a student")
        return student

    def get_profile(self, actor_user_id: UUID) -> LinkedInProfileView:
        session = self._session_factory()
        try:
            return self._view(session, self._student(session, actor_user_id))
        except StudentNotProvisioned:
            raise
        except Exception as exc:
            logger.error("LinkedIn profile state could not be read")
            raise LinkedInServiceUnavailable("El perfil de LinkedIn no está disponible.") from exc
        finally:
            session.close()

    def update_profile(self, actor_user_id: UUID, linkedin_url: str | None) -> LinkedInProfileView:
        try:
            normalized = normalize_linkedin_url(linkedin_url)
        except ValueError as exc:
            raise ValueError(str(exc)) from exc

        session = self._session_factory()
        try:
            with session.begin():
                student = self._student(session, actor_user_id)
                now = _utc_now()
                changed = student.linkedin_url != normalized
                student.linkedin_url = normalized
                student.linkedin_consent_at = now if normalized else None
                if changed:
                    student.linkedin_last_sync_at = None
                    student.linkedin_sync_status = "NEVER"
                    student.linkedin_sync_error = None
                _audit(
                    session,
                    actor_user_id=actor_user_id,
                    action="LINKEDIN_PROFILE_UPDATED",
                    entity_type="STUDENT",
                    entity_id=student.id,
                    before=None,
                    after={"linkedin_url": normalized, "consent": bool(normalized)},
                )
                session.flush()
                return self._view(session, student)
        except StudentNotProvisioned:
            raise
        except Exception as exc:
            logger.error("LinkedIn profile state could not be updated")
            raise LinkedInServiceUnavailable("El perfil de LinkedIn no está disponible.") from exc
        finally:
            session.close()

    def _set_sync_state(
        self,
        actor_user_id: UUID,
        *,
        status: str,
        error: str | None = None,
        synced_at: datetime | None = None,
    ) -> LinkedInProfileView:
        session = self._session_factory()
        try:
            with session.begin():
                student = self._student(session, actor_user_id)
                student.linkedin_sync_status = status
                student.linkedin_sync_error = error
                if synced_at is not None:
                    student.linkedin_last_sync_at = synced_at
                session.flush()
                return self._view(session, student)
        finally:
            session.close()

    def _already_imported(self, candidate: LinkedInCandidate, student_id: UUID) -> bool:
        session = self._session_factory()
        try:
            return session.scalar(
                select(Certification.id).where(
                    Certification.student_id == student_id,
                    Certification.source_external_id == candidate.source_external_id,
                )
            ) is not None
        finally:
            session.close()

    def _create_candidate(
        self,
        actor_user_id: UUID,
        student_id: UUID,
        candidate: LinkedInCandidate,
    ) -> bool:
        if self._already_imported(candidate, student_id):
            return False
        draft = CertificationDraft(
            issuer_name=candidate.issuer_name,
            issuer_url=candidate.issuer_url,
            credential_name=candidate.credential_name,
            external_id=candidate.external_id,
            issued_on=candidate.issued_on,
            expires_on=candidate.expires_on,
            source_url=candidate.source_url,
            skills=tuple(SkillInput(name=skill) for skill in candidate.skills),
            source_kind=candidate.source_kind,
            source_external_id=candidate.source_external_id,
        )
        try:
            created = self._certification_service.create_certification(actor_user_id, draft)
        except CertificationDuplicate:
            return False
        # A public source link is evidence for review, not proof of approval.
        # The validator still has to inspect it and make the decision.
        try:
            self._certification_service.add_url_evidence(
                actor_user_id,
                created.id,
                candidate.source_url,
            )
        except Exception:
            logger.warning("LinkedIn evidence could not be attached candidate=%s", candidate.source_external_id)
        return True

    def sync_profile(self, actor_user_id: UUID, *, force: bool = False) -> LinkedInSyncReport:
        if not self._settings.apify_configured:
            raise ApifyIntegrationError("La integración de Apify no está configurada en el servidor.")

        session = self._session_factory()
        try:
            student = self._student(session, actor_user_id)
            profile_url = normalize_linkedin_url(student.linkedin_url)
            if profile_url is None:
                raise ValueError("Primero registra una URL de perfil de LinkedIn.")
            last_sync = _as_utc(student.linkedin_last_sync_at)
            if (
                not force
                and student.linkedin_sync_status == "SUCCEEDED"
                and last_sync is not None
                and _utc_now() - last_sync
                < timedelta(seconds=self._settings.apify_sync_cooldown_seconds)
            ):
                raise LinkedInSyncCooldown(
                    "El perfil ya fue sincronizado recientemente. Usa actualizar datos cuando necesites forzar otra consulta."
                )
            student_id = student.id
        finally:
            session.close()

        self._set_sync_state(actor_user_id, status="RUNNING", error=None)
        profile_candidates: tuple[LinkedInCandidate, ...] = ()
        publication_candidates: tuple[LinkedInCandidate, ...] = ()
        errors: list[str] = []

        try:
            profile_result = self._apify.run_actor(
                self._settings.apify_profile_actor_id,
                {"urls": [profile_url], "profileScraperMode": "Profile details"},
            )
            if profile_result.items:
                profile_candidates = normalize_profile_certifications(
                    profile_result.items[0], profile_url=profile_url
                )
        except (ApifyIntegrationError, ValueError) as exc:
            errors.append(f"perfil: {_safe_error(exc)}")

        try:
            posts_result = self._apify.run_actor(
                self._settings.apify_posts_actor_id,
                {
                    "targetUrls": [profile_url],
                    "maxPosts": self._settings.apify_max_posts,
                    "postedLimit": "year",
                    "includeQuotePosts": True,
                    "includeReposts": True,
                },
            )
            publication_candidates = normalize_publication_candidates(
                posts_result.items, profile_url=profile_url
            )
        except (ApifyIntegrationError, ValueError) as exc:
            errors.append(f"publicaciones: {_safe_error(exc)}")

        created = 0
        duplicates = 0
        for candidate in (*profile_candidates, *publication_candidates):
            try:
                if self._create_candidate(actor_user_id, student_id, candidate):
                    created += 1
                else:
                    duplicates += 1
            except Exception as exc:
                logger.warning("LinkedIn candidate could not be persisted source=%s", candidate.source_external_id)
                errors.append(f"candidato: {_safe_error(exc)}")

        if errors and profile_candidates == () and publication_candidates == ():
            final_status = "FAILED"
        elif errors:
            final_status = "PARTIAL"
        else:
            final_status = "SUCCEEDED"
        message = (
            "Sincronización completada; los candidatos quedaron pendientes de validación."
            if final_status == "SUCCEEDED"
            else "Sincronización parcial; revisa el detalle y vuelve a intentar lo pendiente."
            if final_status == "PARTIAL"
            else "No se pudo completar la sincronización."
        )
        self._set_sync_state(
            actor_user_id,
            status=final_status,
            error="; ".join(errors) if errors else None,
            synced_at=_utc_now(),
        )
        if final_status == "FAILED":
            raise ApifyIntegrationError("; ".join(errors) or "No se pudo sincronizar el perfil de LinkedIn.")
        return LinkedInSyncReport(
            profile_candidates=len(profile_candidates),
            publication_candidates=len(publication_candidates),
            created=created,
            duplicates=duplicates,
            status=final_status,
            message=message,
        )


class UnavailableLinkedInService:
    def get_profile(self, actor_user_id: UUID) -> LinkedInProfileView:
        raise LinkedInServiceUnavailable("El servicio de LinkedIn no está disponible.")

    def update_profile(self, actor_user_id: UUID, linkedin_url: str | None) -> LinkedInProfileView:
        raise LinkedInServiceUnavailable("El servicio de LinkedIn no está disponible.")

    def sync_profile(self, actor_user_id: UUID, *, force: bool = False) -> LinkedInSyncReport:
        raise LinkedInServiceUnavailable("El servicio de LinkedIn no está disponible.")


__all__ = [
    "LinkedInProfileView",
    "LinkedInServiceProtocol",
    "LinkedInServiceUnavailable",
    "LinkedInSyncCooldown",
    "LinkedInSyncReport",
    "LinkedInSyncService",
    "UnavailableLinkedInService",
]
