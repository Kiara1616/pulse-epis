"""Consent-aware LinkedIn synchronization backed by Apify actors.

Only normalized certification candidates are persisted.  Raw Apify payloads
are intentionally discarded and every candidate is created as ``PENDING`` so
that a validator still makes the official decision.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Protocol, Sequence
from urllib.parse import urlsplit
from uuid import UUID, uuid4

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
from ..db.models import AuditLog, Certification, Student
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
    updated: int
    duplicates: int
    status: str
    message: str


@dataclass(frozen=True, slots=True)
class LinkedInBatchItemReport:
    student_id: UUID
    status: str
    message: str
    profile_candidates: int = 0
    publication_candidates: int = 0
    created: int = 0
    updated: int = 0
    duplicates: int = 0


class LinkedInServiceProtocol(Protocol):
    def get_profile(self, actor_user_id: UUID) -> LinkedInProfileView:
        """Return the consent and synchronization state for the signed-in student."""

    def update_profile(self, actor_user_id: UUID, linkedin_url: str | None) -> LinkedInProfileView:
        """Store or clear the signed-in student's LinkedIn profile URL."""

    def sync_profile(
        self,
        actor_user_id: UUID,
        *,
        force: bool = False,
        include_publications: bool = True,
    ) -> LinkedInSyncReport:
        """Extract public profile data and queue normalized candidates for validation."""

    def sync_students(
        self,
        requester_user_id: UUID,
        student_ids: Sequence[UUID],
        *,
        force: bool = False,
        include_publications: bool = True,
    ) -> tuple[LinkedInBatchItemReport, ...]:
        """Synchronize an explicit, bounded staff-selected list of students."""


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


def _same_url(left: str | None, right: str | None) -> bool:
    """Compare URLs while ignoring query strings and trailing slashes."""

    if not left or not right:
        return False
    left_parts = urlsplit(left)
    right_parts = urlsplit(right)
    return (
        left_parts.scheme.casefold(),
        (left_parts.hostname or "").casefold(),
        left_parts.path.rstrip("/").casefold(),
    ) == (
        right_parts.scheme.casefold(),
        (right_parts.hostname or "").casefold(),
        right_parts.path.rstrip("/").casefold(),
    )


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

    def _find_imported(
        self,
        candidate: LinkedInCandidate,
        student_id: UUID,
    ) -> Certification | None:
        session = self._session_factory()
        try:
            existing = session.scalar(
                select(Certification).where(
                    Certification.student_id == student_id,
                    Certification.source_external_id == candidate.source_external_id,
                )
            )
            if existing is not None:
                return existing
            # Older syncs included the source URL in source_external_id.  If a
            # later Apify run discovers a direct Credly/issuer URL, match the
            # same pending profile certificate by its stable name/date identity
            # so the evidence is enriched instead of duplicated.
            if candidate.source_kind != "LINKEDIN_PROFILE":
                return None
            return session.scalar(
                select(Certification)
                .where(
                    Certification.student_id == student_id,
                    Certification.source_kind == "LINKEDIN_PROFILE",
                    Certification.credential_name == candidate.credential_name,
                    Certification.issued_on == candidate.issued_on,
                    Certification.status.in_(
                        ("PENDING", "UNDER_REVIEW", "OBSERVED", "RESUBMITTED")
                    ),
                )
                .order_by(Certification.created_at.desc())
                .limit(1)
            )
        finally:
            session.close()

    def _refresh_source_url(
        self,
        actor_user_id: UUID,
        existing: Certification,
        candidate: LinkedInCandidate,
        *,
        profile_url: str,
    ) -> bool:
        """Replace a profile-only reference with a direct credential link."""

        if existing.status not in {"PENDING", "UNDER_REVIEW", "OBSERVED", "RESUBMITTED"}:
            return False
        if _same_url(existing.source_url, candidate.source_url):
            return False
        # Do not overwrite a direct link that a student or validator already
        # supplied.  Only the generic LinkedIn profile fallback is replaceable.
        if existing.source_url and not _same_url(existing.source_url, profile_url):
            return False
        if _same_url(candidate.source_url, profile_url):
            return False

        session = self._session_factory()
        try:
            with session.begin():
                certification = session.get(Certification, existing.id)
                if certification is None:
                    return False
                before = {
                    "source_url": certification.source_url,
                    "source_external_id": certification.source_external_id,
                }
                certification.source_url = candidate.source_url
                certification.source_external_id = candidate.source_external_id
                certification.updated_at = _utc_now()
                _audit(
                    session,
                    actor_user_id=actor_user_id,
                    action="LINKEDIN_EVIDENCE_URL_REFRESHED",
                    entity_type="CERTIFICATION",
                    entity_id=certification.id,
                    before=before,
                    after={
                        "source_url": certification.source_url,
                        "source_external_id": certification.source_external_id,
                    },
                )
                session.flush()
                return True
        finally:
            session.close()

    def _create_candidate(
        self,
        actor_user_id: UUID,
        student_id: UUID,
        candidate: LinkedInCandidate,
        *,
        profile_url: str,
    ) -> str:
        existing = self._find_imported(candidate, student_id)
        if existing is not None:
            if self._refresh_source_url(
                actor_user_id,
                existing,
                candidate,
                profile_url=profile_url,
            ):
                try:
                    self._certification_service.add_url_evidence(
                        actor_user_id,
                        existing.id,
                        candidate.source_url,
                    )
                except Exception:
                    logger.warning(
                        "LinkedIn refreshed evidence could not be attached candidate=%s",
                        candidate.source_external_id,
                    )
                return "updated"
            return "duplicate"
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
            return "duplicate"
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
        return "created"

    def sync_profile(
        self,
        actor_user_id: UUID,
        *,
        force: bool = False,
        include_publications: bool = True,
    ) -> LinkedInSyncReport:
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
                {
                    # These names match the public input schema of
                    # harvestapi/linkedin-profile-scraper.  The actor accepts
                    # profile URLs in ``queries`` and requires the complete
                    # mode label, not a shorthand value.
                    "profileScraperMode": "Profile details no email ($4 per 1k)",
                    "queries": [profile_url],
                },
            )
            if profile_result.items:
                profile_candidates = normalize_profile_certifications(
                    profile_result.items[0], profile_url=profile_url
                )
        except (ApifyIntegrationError, ValueError) as exc:
            errors.append(f"perfil: {_safe_error(exc)}")

        if include_publications:
            try:
                posts_result = self._apify.run_actor(
                    self._settings.apify_posts_actor_id,
                    {
                        "targetUrls": [profile_url],
                        "maxPosts": self._settings.apify_max_posts,
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
        updated = 0
        duplicates = 0
        for candidate in (*profile_candidates, *publication_candidates):
            try:
                outcome = self._create_candidate(
                    actor_user_id,
                    student_id,
                    candidate,
                    profile_url=profile_url,
                )
                if outcome == "created":
                    created += 1
                elif outcome == "updated":
                    updated += 1
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
            updated=updated,
            duplicates=duplicates,
            status=final_status,
            message=message,
        )

    def sync_students(
        self,
        requester_user_id: UUID,
        student_ids: Sequence[UUID],
        *,
        force: bool = False,
        include_publications: bool = True,
    ) -> tuple[LinkedInBatchItemReport, ...]:
        """Run only an explicit, bounded list selected by staff.

        The roster may contain students who have not authenticated yet. Those
        rows are reported as skipped before Apify is called, so a batch cannot
        spend credits for an unusable account or a missing URL.
        """

        unique_ids = list(dict.fromkeys(student_ids))
        if not unique_ids:
            return ()
        if len(unique_ids) > self._settings.apify_batch_max_profiles:
            raise ValueError(
                f"Selecciona como máximo {self._settings.apify_batch_max_profiles} estudiantes por lote."
            )

        batch_id = uuid4()
        audit_session = self._session_factory()
        try:
            with audit_session.begin():
                audit_session.add(
                    AuditLog(
                        actor_user_id=requester_user_id,
                        action="LINKEDIN_BATCH_REQUESTED",
                        entity_type="LINKEDIN_BATCH",
                        entity_id=str(batch_id),
                        after_data={
                            "student_count": len(unique_ids),
                            "student_ids": [str(item) for item in unique_ids],
                            "force": force,
                            "include_publications": include_publications,
                        },
                    )
                )
        finally:
            audit_session.close()

        session = self._session_factory()
        try:
            students = {
                student.id: student
                for student in session.scalars(
                    select(Student).where(Student.id.in_(unique_ids))
                ).all()
            }
        finally:
            session.close()

        # Keep deterministic output order, but do not make the HTTP request
        # wait for twenty complete profile+posts actor runs one after another.
        # Each sync_profile call creates its own SQLAlchemy sessions, so these
        # independent students can safely be processed concurrently.
        results_by_id: dict[UUID, LinkedInBatchItemReport] = {}
        eligible: list[tuple[UUID, UUID]] = []
        for student_id in unique_ids:
            student = students.get(student_id)
            if student is None:
                results_by_id[student_id] = LinkedInBatchItemReport(
                    student_id=student_id,
                    status="SKIPPED",
                    message="El estudiante ya no pertenece al padrón disponible.",
                )
                continue
            if not student.linkedin_url:
                results_by_id[student_id] = LinkedInBatchItemReport(
                    student_id=student_id,
                    status="SKIPPED",
                    message="El estudiante no tiene un enlace de LinkedIn registrado.",
                )
                continue
            if student.linkedin_sync_status == "SUCCEEDED" and not force:
                results_by_id[student_id] = LinkedInBatchItemReport(
                    student_id=student_id,
                    status="SKIPPED",
                    message="El perfil ya fue sincronizado; solicita una actualización explícita para volver a consultarlo.",
                )
                continue
            if student.user_id is None:
                results_by_id[student_id] = LinkedInBatchItemReport(
                    student_id=student_id,
                    status="SKIPPED",
                    message="La cuenta institucional todavía no está vinculada al estudiante.",
                )
                continue
            eligible.append((student_id, student.user_id))

        def sync_one(student_id: UUID, user_id: UUID) -> LinkedInBatchItemReport:
            try:
                report = self.sync_profile(
                    user_id,
                    force=force,
                    include_publications=include_publications,
                )
                return LinkedInBatchItemReport(
                    student_id=student_id,
                    status=report.status,
                    message=report.message,
                    profile_candidates=report.profile_candidates,
                    publication_candidates=report.publication_candidates,
                    created=report.created,
                    updated=report.updated,
                    duplicates=report.duplicates,
                )
            except LinkedInSyncCooldown as exc:
                return LinkedInBatchItemReport(
                    student_id=student_id,
                    status="SKIPPED",
                    message=str(exc),
                )
            except (ValueError, StudentNotProvisioned) as exc:
                return LinkedInBatchItemReport(
                    student_id=student_id,
                    status="SKIPPED",
                    message=_safe_error(exc),
                )
            except Exception as exc:
                logger.warning("LinkedIn batch item failed student=%s", student_id)
                return LinkedInBatchItemReport(
                    student_id=student_id,
                    status="FAILED",
                    message=_safe_error(exc),
                )

        if eligible:
            with ThreadPoolExecutor(
                max_workers=min(len(eligible), self._settings.apify_batch_max_profiles)
            ) as executor:
                futures = {
                    executor.submit(sync_one, student_id, user_id): student_id
                    for student_id, user_id in eligible
                }
                for future in as_completed(futures):
                    student_id = futures[future]
                    try:
                        results_by_id[student_id] = future.result()
                    except Exception as exc:  # pragma: no cover - defensive
                        logger.warning("LinkedIn batch worker failed student=%s", student_id)
                        results_by_id[student_id] = LinkedInBatchItemReport(
                            student_id=student_id,
                            status="FAILED",
                            message=_safe_error(exc),
                        )

        return tuple(results_by_id[student_id] for student_id in unique_ids)



class UnavailableLinkedInService:
    def get_profile(self, actor_user_id: UUID) -> LinkedInProfileView:
        raise LinkedInServiceUnavailable("El servicio de LinkedIn no está disponible.")

    def update_profile(self, actor_user_id: UUID, linkedin_url: str | None) -> LinkedInProfileView:
        raise LinkedInServiceUnavailable("El servicio de LinkedIn no está disponible.")

    def sync_profile(
        self,
        actor_user_id: UUID,
        *,
        force: bool = False,
        include_publications: bool = True,
    ) -> LinkedInSyncReport:
        raise LinkedInServiceUnavailable("El servicio de LinkedIn no está disponible.")

    def sync_students(
        self,
        requester_user_id: UUID,
        student_ids: Sequence[UUID],
        *,
        force: bool = False,
        include_publications: bool = True,
    ) -> tuple[LinkedInBatchItemReport, ...]:
        raise LinkedInServiceUnavailable("El servicio de LinkedIn no está disponible.")


__all__ = [
    "LinkedInProfileView",
    "LinkedInServiceProtocol",
    "LinkedInServiceUnavailable",
    "LinkedInSyncCooldown",
    "LinkedInSyncReport",
    "LinkedInBatchItemReport",
    "LinkedInSyncService",
    "UnavailableLinkedInService",
]
