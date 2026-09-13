"""Transactional certification registration and private evidence access."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Mapping, Protocol
from urllib.parse import urlsplit
from uuid import UUID, uuid4

from pydantic import SecretStr
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import Settings
from ..db.models import (
    AuditLog,
    Certification,
    CertificationStatusHistory,
    CertificationSkill,
    Evidence,
    Issuer,
    Skill,
    Student,
    User,
)
from ..evidence.storage import EvidenceStorageError, LocalEvidenceStorage


logger = logging.getLogger(__name__)
_ALLOWED_CERTIFICATION_STATUSES = {"PENDING", "OBSERVED", "RESUBMITTED"}
_FILE_SIGNATURES = {
    "application/pdf": (b"%PDF-",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
}
_FILE_EXTENSIONS = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
}


class CertificationNotFound(RuntimeError):
    """The certification is not visible to the current student."""


class StudentNotProvisioned(RuntimeError):
    """The authenticated account is not linked to a student in the padrón."""


class CertificationDuplicate(RuntimeError):
    """The same certification identity already exists for the student."""


class CertificationInvalid(RuntimeError):
    """The certification payload violates a domain rule."""


class CertificationNotCorrectable(RuntimeError):
    """The current validation state does not allow a student correction."""


class EvidenceNotFound(RuntimeError):
    """The evidence is not visible to the current student."""


class EvidenceDuplicate(RuntimeError):
    """The same evidence hash already exists for the certification."""


class EvidenceFileTooLarge(CertificationInvalid):
    """The uploaded evidence exceeds the configured byte limit."""


class EvidenceAccessDenied(RuntimeError):
    """A signed evidence access token is invalid or not owned by its subject."""


class CertificationServiceUnavailable(RuntimeError):
    """The persistence or private storage dependency is unavailable."""


@dataclass(frozen=True, slots=True)
class SkillInput:
    name: str
    level: str | None = None


@dataclass(frozen=True, slots=True)
class CertificationDraft:
    issuer_name: str
    issuer_url: str | None
    credential_name: str
    external_id: str | None
    issued_on: date
    expires_on: date | None
    source_url: str | None
    skills: tuple[SkillInput, ...]


@dataclass(frozen=True, slots=True)
class SkillView:
    id: UUID
    name: str
    level: str | None


@dataclass(frozen=True, slots=True)
class EvidenceView:
    id: UUID
    evidence_type: str
    source_url: str | None
    original_filename: str | None
    content_type: str | None
    byte_size: int | None
    sha256: str
    retention_until: datetime
    uploaded_at: datetime


@dataclass(frozen=True, slots=True)
class CertificationView:
    id: UUID
    issuer_id: UUID
    issuer_name: str
    issuer_url: str | None
    credential_name: str
    external_id: str | None
    issued_on: date
    expires_on: date | None
    status: str
    source_url: str | None
    skills: tuple[SkillView, ...]
    evidences: tuple[EvidenceView, ...]
    created_at: datetime
    updated_at: datetime
    correction_allowed: bool


@dataclass(frozen=True, slots=True)
class EvidenceAccess:
    evidence_id: UUID
    token: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class EvidenceDownload:
    evidence_id: UUID
    evidence_type: str
    source_url: str | None
    path: Path | None
    content_type: str | None
    original_filename: str | None


class EvidenceStorage(Protocol):
    def save(self, object_key: str, content: bytes) -> None:
        """Persist private bytes under a generated object key."""

    def path_for(self, object_key: str) -> Path:
        """Resolve an existing private object."""

    def delete(self, object_key: str) -> None:
        """Remove a private object after a failed transaction or purge."""


class CertificationServiceProtocol(Protocol):
    def create_certification(
        self,
        actor_user_id: UUID,
        draft: CertificationDraft,
    ) -> CertificationView:
        """Create a pending certification for the authenticated student."""

    def list_own(self, actor_user_id: UUID) -> list[CertificationView]:
        """List only the authenticated student's certifications."""

    def get_own(self, actor_user_id: UUID, certification_id: UUID) -> CertificationView:
        """Read one certification owned by the authenticated student."""

    def update_own(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        changes: Mapping[str, object],
    ) -> CertificationView:
        """Correct a pending/observed certification while preserving decisions."""

    def add_url_evidence(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        source_url: str,
    ) -> EvidenceView:
        """Attach a validated external URL to an owned certification."""

    def add_file_evidence(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        *,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> EvidenceView:
        """Validate and attach a private file to an owned certification."""

    def create_evidence_access(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        evidence_id: UUID,
    ) -> EvidenceAccess:
        """Issue a short-lived signed access token for owned evidence."""

    def create_validator_evidence_access(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        evidence_id: UUID,
    ) -> EvidenceAccess:
        """Issue a short-lived signed access token for validator evidence review."""

    def download_evidence(self, evidence_id: UUID, token: str) -> EvidenceDownload:
        """Resolve a signed token without exposing the private storage root."""


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    """Normalize SQLite's naive timestamps and PostgreSQL aware timestamps."""

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _clean_text(value: str, *, field: str, maximum: int) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized or len(normalized) > maximum:
        raise CertificationInvalid(f"{field} is invalid")
    return normalized


def _optional_text(value: object, *, field: str, maximum: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise CertificationInvalid(f"{field} is invalid")
    normalized = " ".join(value.strip().split())
    if not normalized:
        return None
    if len(normalized) > maximum:
        raise CertificationInvalid(f"{field} is invalid")
    return normalized


def _validated_url(value: str | None, *, field: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise CertificationInvalid(f"{field} is invalid")
    normalized = value.strip()
    parsed = urlsplit(normalized)
    if (
        parsed.scheme.lower() not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or len(normalized) > 2048
    ):
        raise CertificationInvalid(f"{field} must be an HTTP(S) URL")
    return normalized


def _date_value(value: object, *, field: str) -> date | None:
    if value is None:
        return None
    if not isinstance(value, date):
        raise CertificationInvalid(f"{field} is invalid")
    return value


def _audit(
    session: Session,
    *,
    actor_user_id: UUID,
    action: str,
    entity_type: str,
    entity_id: UUID,
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
            created_at=_utc_now(),
        )
    )


def append_status_history(
    session: Session,
    *,
    certification_id: UUID,
    actor_user_id: UUID | None,
    from_status: str | None,
    to_status: str,
    comment: str | None = None,
    cutoff_date: date | None = None,
    changed_at: datetime | None = None,
) -> CertificationStatusHistory:
    """Append a transition; callers never update or delete history rows."""

    history = CertificationStatusHistory(
        id=uuid4(),
        certification_id=certification_id,
        actor_user_id=actor_user_id,
        from_status=from_status,
        to_status=to_status,
        comment=comment,
        cutoff_date=cutoff_date,
        changed_at=changed_at or _utc_now(),
    )
    session.add(history)
    return history


class CertificationService:
    """Apply student-scoped certification and private evidence rules."""

    def __init__(
        self,
        session_factory: sessionmaker[Session],
        settings: Settings,
        storage: EvidenceStorage | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._settings = settings
        self._storage = storage or LocalEvidenceStorage(settings.evidence_storage_path)

    def _student(self, session: Session, actor_user_id: UUID) -> Student:
        student = session.scalar(select(Student).where(Student.user_id == actor_user_id))
        if student is None:
            raise StudentNotProvisioned("The account is not linked to a student")
        return student

    def _owned_certification(
        self,
        session: Session,
        actor_user_id: UUID,
        certification_id: UUID,
    ) -> Certification | None:
        return session.scalar(
            select(Certification)
            .join(Student, Certification.student_id == Student.id)
            .where(
                Certification.id == certification_id,
                Student.user_id == actor_user_id,
            )
        )

    def _issuer(
        self,
        session: Session,
        name: str,
        website_url: str | None,
    ) -> Issuer:
        normalized_name = _clean_text(name, field="issuer_name", maximum=150)
        issuer = session.scalar(
            select(Issuer).where(func.lower(Issuer.name) == normalized_name.casefold())
        )
        if issuer is None:
            issuer = Issuer(
                id=uuid4(),
                name=normalized_name,
                website_url=_validated_url(website_url, field="issuer_url"),
                created_at=_utc_now(),
            )
            session.add(issuer)
            session.flush()
        return issuer

    def _skills(
        self,
        session: Session,
        values: tuple[SkillInput, ...] | list[SkillInput],
    ) -> list[SkillView]:
        result: list[SkillView] = []
        seen: set[str] = set()
        for value in values:
            name = _clean_text(value.name, field="skill_name", maximum=150)
            key = name.casefold()
            if key in seen:
                raise CertificationInvalid("Skills cannot be duplicated")
            seen.add(key)
            level = _optional_text(value.level, field="skill_level", maximum=50)
            skill = session.scalar(select(Skill).where(func.lower(Skill.name) == key))
            if skill is None:
                skill = Skill(id=uuid4(), name=name, created_at=_utc_now())
                session.add(skill)
                session.flush()
            result.append(SkillView(id=skill.id, name=skill.name, level=level))
        return result

    def _certification_view(
        self,
        session: Session,
        certification: Certification,
    ) -> CertificationView:
        issuer = session.get(Issuer, certification.issuer_id)
        if issuer is None:
            raise CertificationServiceUnavailable("Certification issuer is unavailable")
        skill_rows = session.execute(
            select(CertificationSkill, Skill)
            .join(Skill, CertificationSkill.skill_id == Skill.id)
            .where(CertificationSkill.certification_id == certification.id)
            .order_by(Skill.name)
        ).all()
        evidence_rows = session.scalars(
            select(Evidence)
            .where(Evidence.certification_id == certification.id)
            .order_by(Evidence.uploaded_at, Evidence.id)
        ).all()
        return CertificationView(
            id=certification.id,
            issuer_id=issuer.id,
            issuer_name=issuer.name,
            issuer_url=issuer.website_url,
            credential_name=certification.credential_name,
            external_id=certification.external_id,
            issued_on=certification.issued_on,
            expires_on=certification.expires_on,
            status=certification.status,
            source_url=certification.source_url,
            skills=tuple(
                SkillView(id=skill.id, name=skill.name, level=link.level)
                for link, skill in skill_rows
            ),
            evidences=tuple(
                EvidenceView(
                    id=evidence.id,
                    evidence_type=evidence.evidence_type,
                    source_url=evidence.source_url,
                    original_filename=evidence.original_filename,
                    content_type=evidence.content_type,
                    byte_size=evidence.byte_size,
                    sha256=evidence.sha256 or "",
                    retention_until=(
                        _as_utc(evidence.retention_until)
                        if evidence.retention_until is not None
                        else _utc_now()
                    ),
                    uploaded_at=_as_utc(evidence.uploaded_at),
                )
                for evidence in evidence_rows
            ),
            created_at=_as_utc(certification.created_at),
            updated_at=_as_utc(certification.updated_at),
            correction_allowed=certification.status in _ALLOWED_CERTIFICATION_STATUSES,
        )

    def _duplicate_certification(
        self,
        session: Session,
        *,
        student_id: UUID,
        issuer_id: UUID,
        credential_name: str,
        issued_on: date,
        external_id: str | None,
        exclude_id: UUID | None = None,
    ) -> bool:
        identity = session.scalar(
            select(Certification.id).where(
                Certification.student_id == student_id,
                Certification.issuer_id == issuer_id,
                func.lower(Certification.credential_name) == credential_name.casefold(),
                Certification.issued_on == issued_on,
                Certification.id != exclude_id if exclude_id is not None else True,
            )
        )
        if identity is not None:
            return True
        if external_id is None:
            return False
        external = session.scalar(
            select(Certification.id).where(
                Certification.issuer_id == issuer_id,
                Certification.external_id == external_id,
                Certification.id != exclude_id if exclude_id is not None else True,
            )
        )
        return external is not None

    def _add_skill_links(
        self,
        session: Session,
        certification_id: UUID,
        values: tuple[SkillInput, ...] | list[SkillInput],
    ) -> None:
        views = self._skills(session, values)
        session.add_all(
            [
                CertificationSkill(
                    certification_id=certification_id,
                    skill_id=view.id,
                    level=view.level,
                )
                for view in views
            ]
        )

    def create_certification(
        self,
        actor_user_id: UUID,
        draft: CertificationDraft,
    ) -> CertificationView:
        credential_name = _clean_text(
            draft.credential_name,
            field="credential_name",
            maximum=200,
        )
        external_id = _optional_text(draft.external_id, field="external_id", maximum=200)
        issued_on = _date_value(draft.issued_on, field="issued_on")
        expires_on = _date_value(draft.expires_on, field="expires_on")
        if issued_on is None:
            raise CertificationInvalid("issued_on is required")
        if expires_on is not None and expires_on < issued_on:
            raise CertificationInvalid("expires_on cannot precede issued_on")
        source_url = _validated_url(draft.source_url, field="source_url")

        session = self._session_factory()
        try:
            with session.begin():
                student = self._student(session, actor_user_id)
                issuer = self._issuer(session, draft.issuer_name, draft.issuer_url)
                if self._duplicate_certification(
                    session,
                    student_id=student.id,
                    issuer_id=issuer.id,
                    credential_name=credential_name,
                    issued_on=issued_on,
                    external_id=external_id,
                ):
                    raise CertificationDuplicate("Certification already exists")
                now = _utc_now()
                certification = Certification(
                    id=uuid4(),
                    student_id=student.id,
                    issuer_id=issuer.id,
                    credential_name=credential_name,
                    external_id=external_id,
                    issued_on=issued_on,
                    expires_on=expires_on,
                    status="PENDING",
                    source_url=source_url,
                    created_at=now,
                    updated_at=now,
                )
                session.add(certification)
                session.flush()
                append_status_history(
                    session,
                    certification_id=certification.id,
                    actor_user_id=actor_user_id,
                    from_status=None,
                    to_status=certification.status,
                )
                self._add_skill_links(session, certification.id, draft.skills)
                _audit(
                    session,
                    actor_user_id=actor_user_id,
                    action="CERTIFICATION_CREATED",
                    entity_type="CERTIFICATION",
                    entity_id=certification.id,
                    before=None,
                    after={
                        "status": certification.status,
                        "issuer_id": str(issuer.id),
                        "credential_name": credential_name,
                        "issued_on": issued_on.isoformat(),
                    },
                )
                session.flush()
                return self._certification_view(session, certification)
        except (CertificationDuplicate, CertificationInvalid, StudentNotProvisioned):
            raise
        except IntegrityError as exc:
            raise CertificationDuplicate("Certification already exists") from exc
        except Exception as exc:
            logger.error("Certification creation failed and transaction was rolled back")
            raise CertificationServiceUnavailable("Certification service is unavailable") from exc
        finally:
            session.close()

    def list_own(self, actor_user_id: UUID) -> list[CertificationView]:
        session = self._session_factory()
        try:
            certifications = session.scalars(
                select(Certification)
                .join(Student, Certification.student_id == Student.id)
                .where(Student.user_id == actor_user_id)
                .order_by(Certification.created_at.desc(), Certification.id)
            ).all()
            return [self._certification_view(session, item) for item in certifications]
        except Exception as exc:
            logger.error("Certification listing failed")
            raise CertificationServiceUnavailable("Certification service is unavailable") from exc
        finally:
            session.close()

    def get_own(self, actor_user_id: UUID, certification_id: UUID) -> CertificationView:
        session = self._session_factory()
        try:
            certification = self._owned_certification(session, actor_user_id, certification_id)
            if certification is None:
                raise CertificationNotFound("Certification not found")
            return self._certification_view(session, certification)
        except CertificationNotFound:
            raise
        except Exception as exc:
            logger.error("Certification lookup failed")
            raise CertificationServiceUnavailable("Certification service is unavailable") from exc
        finally:
            session.close()

    def update_own(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        changes: Mapping[str, object],
    ) -> CertificationView:
        if not changes:
            raise CertificationInvalid("At least one correction is required")
        session = self._session_factory()
        try:
            with session.begin():
                certification = self._owned_certification(session, actor_user_id, certification_id)
                if certification is None:
                    raise CertificationNotFound("Certification not found")
                if certification.status not in _ALLOWED_CERTIFICATION_STATUSES:
                    raise CertificationNotCorrectable(
                        "Only pending, observed or resubmitted certifications can be corrected"
                    )
                issuer = session.get(Issuer, certification.issuer_id)
                if issuer is None:
                    raise CertificationServiceUnavailable("Certification issuer is unavailable")

                raw_credential_name = changes.get("credential_name", certification.credential_name)
                if not isinstance(raw_credential_name, str):
                    raise CertificationInvalid("credential_name is invalid")
                credential_name = _clean_text(
                    raw_credential_name,
                    field="credential_name",
                    maximum=200,
                )
                issued_on = _date_value(
                    changes.get("issued_on", certification.issued_on),
                    field="issued_on",
                )
                if issued_on is None:
                    raise CertificationInvalid("issued_on is required")
                expires_on = _date_value(
                    changes.get("expires_on", certification.expires_on),
                    field="expires_on",
                )
                if expires_on is not None and expires_on < issued_on:
                    raise CertificationInvalid("expires_on cannot precede issued_on")
                external_id = _optional_text(
                    changes.get("external_id", certification.external_id),
                    field="external_id",
                    maximum=200,
                )
                source_url = _validated_url(
                    changes.get("source_url", certification.source_url),
                    field="source_url",
                )
                if "issuer_name" in changes:
                    if not isinstance(changes["issuer_name"], str):
                        raise CertificationInvalid("issuer_name is invalid")
                    issuer = self._issuer(
                        session,
                        changes["issuer_name"],
                        changes.get("issuer_url")
                        if isinstance(changes.get("issuer_url"), str)
                        else None,
                    )
                if self._duplicate_certification(
                    session,
                    student_id=certification.student_id,
                    issuer_id=issuer.id,
                    credential_name=credential_name,
                    issued_on=issued_on,
                    external_id=external_id,
                    exclude_id=certification.id,
                ):
                    raise CertificationDuplicate("Certification already exists")

                before = {
                    "status": certification.status,
                    "issuer_id": str(certification.issuer_id),
                    "credential_name": certification.credential_name,
                    "issued_on": certification.issued_on.isoformat(),
                }
                certification.issuer_id = issuer.id
                certification.credential_name = credential_name
                certification.external_id = external_id
                certification.issued_on = issued_on
                certification.expires_on = expires_on
                certification.source_url = source_url
                previous_status = certification.status
                if certification.status == "OBSERVED":
                    certification.status = "RESUBMITTED"
                certification.updated_at = _utc_now()
                if "skills" in changes:
                    values = changes["skills"]
                    if not isinstance(values, (tuple, list)) or not all(
                        isinstance(item, SkillInput) for item in values
                    ):
                        raise CertificationInvalid("skills is invalid")
                    session.execute(
                        delete(CertificationSkill).where(
                            CertificationSkill.certification_id == certification.id
                        )
                    )
                    self._add_skill_links(session, certification.id, list(values))
                _audit(
                    session,
                    actor_user_id=actor_user_id,
                    action="CERTIFICATION_CORRECTED",
                    entity_type="CERTIFICATION",
                    entity_id=certification.id,
                    before=before,
                    after={
                        "status": certification.status,
                        "issuer_id": str(certification.issuer_id),
                        "credential_name": certification.credential_name,
                        "issued_on": certification.issued_on.isoformat(),
                    },
                )
                if certification.status != previous_status:
                    append_status_history(
                        session,
                        certification_id=certification.id,
                        actor_user_id=actor_user_id,
                        from_status=previous_status,
                        to_status=certification.status,
                    )
                session.flush()
                return self._certification_view(session, certification)
        except (
            CertificationDuplicate,
            CertificationInvalid,
            CertificationNotCorrectable,
            CertificationNotFound,
        ):
            raise
        except IntegrityError as exc:
            raise CertificationDuplicate("Certification already exists") from exc
        except Exception as exc:
            logger.error("Certification correction failed and transaction was rolled back")
            raise CertificationServiceUnavailable("Certification service is unavailable") from exc
        finally:
            session.close()

    def _owned_evidence(
        self,
        session: Session,
        actor_user_id: UUID,
        certification_id: UUID,
        evidence_id: UUID | None = None,
    ) -> tuple[Certification, Evidence] | None:
        statement = (
            select(Certification, Evidence)
            .join(Evidence, Evidence.certification_id == Certification.id)
            .join(Student, Certification.student_id == Student.id)
            .where(
                Certification.id == certification_id,
                Student.user_id == actor_user_id,
            )
        )
        if evidence_id is not None:
            statement = statement.where(Evidence.id == evidence_id)
        return session.execute(statement).first()

    def _evidence_view(self, evidence: Evidence) -> EvidenceView:
        if evidence.sha256 is None or evidence.retention_until is None:
            raise CertificationServiceUnavailable("Evidence metadata is incomplete")
        return EvidenceView(
            id=evidence.id,
            evidence_type=evidence.evidence_type,
            source_url=evidence.source_url,
            original_filename=evidence.original_filename,
            content_type=evidence.content_type,
            byte_size=evidence.byte_size,
            sha256=evidence.sha256,
            retention_until=_as_utc(evidence.retention_until),
            uploaded_at=_as_utc(evidence.uploaded_at),
        )

    def add_url_evidence(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        source_url: str,
    ) -> EvidenceView:
        normalized_url = _validated_url(source_url, field="source_url")
        if normalized_url is None:
            raise CertificationInvalid("source_url is required")
        source_hash = hashlib.sha256(normalized_url.encode("utf-8")).hexdigest()
        session = self._session_factory()
        try:
            with session.begin():
                certification = self._owned_certification(session, actor_user_id, certification_id)
                if certification is None:
                    raise CertificationNotFound("Certification not found")
                duplicate = session.scalar(
                    select(Evidence.id).where(
                        Evidence.certification_id == certification.id,
                        Evidence.sha256 == source_hash,
                    )
                )
                if duplicate is not None:
                    raise EvidenceDuplicate("Evidence already exists")
                now = _utc_now()
                evidence = Evidence(
                    id=uuid4(),
                    certification_id=certification.id,
                    evidence_type="URL",
                    source_url=normalized_url,
                    sha256=source_hash,
                    retention_until=now
                    + timedelta(days=self._settings.evidence_retention_days),
                    uploaded_at=now,
                )
                session.add(evidence)
                session.flush()
                _audit(
                    session,
                    actor_user_id=actor_user_id,
                    action="EVIDENCE_ADDED",
                    entity_type="EVIDENCE",
                    entity_id=evidence.id,
                    before=None,
                    after={
                        "certification_id": str(certification.id),
                        "evidence_type": evidence.evidence_type,
                        "sha256": source_hash,
                    },
                )
                session.flush()
                return self._evidence_view(evidence)
        except (CertificationInvalid, CertificationNotFound, EvidenceDuplicate):
            raise
        except IntegrityError as exc:
            raise EvidenceDuplicate("Evidence already exists") from exc
        except Exception as exc:
            logger.error("URL evidence creation failed and transaction was rolled back")
            raise CertificationServiceUnavailable("Evidence service is unavailable") from exc
        finally:
            session.close()

    def _file_metadata(
        self,
        *,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> tuple[str, str, str]:
        if len(content) == 0:
            raise CertificationInvalid("Evidence file cannot be empty")
        if len(content) > self._settings.evidence_max_bytes:
            raise EvidenceFileTooLarge("Evidence file exceeds the configured size limit")
        if not filename or "/" in filename or "\\" in filename:
            raise CertificationInvalid("Evidence filename is invalid")
        safe_filename = filename.strip()
        if (
            not safe_filename
            or len(safe_filename) > 255
            or any(ord(character) < 32 for character in safe_filename)
        ):
            raise CertificationInvalid("Evidence filename is invalid")
        normalized_type = content_type.split(";", 1)[0].strip().lower()
        if normalized_type not in self._settings.allowed_evidence_mime_types:
            raise CertificationInvalid("Evidence file type is not allowed")
        expected_extension = _FILE_EXTENSIONS.get(normalized_type)
        if expected_extension is None or Path(safe_filename).suffix.lower() != expected_extension:
            raise CertificationInvalid("Evidence filename extension does not match its type")
        signatures = _FILE_SIGNATURES.get(normalized_type, ())
        if not any(content.startswith(signature) for signature in signatures):
            raise CertificationInvalid("Evidence file signature is invalid")
        return safe_filename, normalized_type, expected_extension

    def add_file_evidence(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        *,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> EvidenceView:
        safe_filename, normalized_type, extension = self._file_metadata(
            filename=filename,
            content_type=content_type,
            content=content,
        )
        source_hash = hashlib.sha256(content).hexdigest()
        object_key = f"{uuid4().hex}{extension}"
        saved = False
        committed = False
        session = self._session_factory()
        try:
            with session.begin():
                certification = self._owned_certification(session, actor_user_id, certification_id)
                if certification is None:
                    raise CertificationNotFound("Certification not found")
                duplicate = session.scalar(
                    select(Evidence.id).where(
                        Evidence.certification_id == certification.id,
                        Evidence.sha256 == source_hash,
                    )
                )
                if duplicate is not None:
                    raise EvidenceDuplicate("Evidence already exists")
                self._storage.save(object_key, content)
                saved = True
                now = _utc_now()
                evidence = Evidence(
                    id=uuid4(),
                    certification_id=certification.id,
                    evidence_type="FILE",
                    object_key=object_key,
                    sha256=source_hash,
                    original_filename=safe_filename,
                    content_type=normalized_type,
                    byte_size=len(content),
                    retention_until=now
                    + timedelta(days=self._settings.evidence_retention_days),
                    uploaded_at=now,
                )
                session.add(evidence)
                session.flush()
                _audit(
                    session,
                    actor_user_id=actor_user_id,
                    action="EVIDENCE_ADDED",
                    entity_type="EVIDENCE",
                    entity_id=evidence.id,
                    before=None,
                    after={
                        "certification_id": str(certification.id),
                        "evidence_type": evidence.evidence_type,
                        "sha256": source_hash,
                        "byte_size": len(content),
                    },
                )
                session.flush()
                result = self._evidence_view(evidence)
            committed = True
            return result
        except (CertificationInvalid, CertificationNotFound, EvidenceDuplicate):
            raise
        except EvidenceStorageError as exc:
            raise CertificationServiceUnavailable("Evidence storage is unavailable") from exc
        except IntegrityError as exc:
            raise EvidenceDuplicate("Evidence already exists") from exc
        except Exception as exc:
            logger.error("File evidence creation failed and transaction was rolled back")
            raise CertificationServiceUnavailable("Evidence service is unavailable") from exc
        finally:
            session.close()
            if saved and not committed:
                try:
                    self._storage.delete(object_key)
                except EvidenceStorageError:
                    logger.error("Failed to clean up private evidence after rollback")

    def create_evidence_access(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        evidence_id: UUID,
    ) -> EvidenceAccess:
        session = self._session_factory()
        try:
            with session.begin():
                owned = self._owned_evidence(
                    session,
                    actor_user_id,
                    certification_id,
                    evidence_id,
                )
                if owned is None:
                    raise EvidenceNotFound("Evidence not found")
                _, evidence = owned
                now = _utc_now()
                if evidence.retention_until is None or _as_utc(evidence.retention_until) <= now:
                    raise EvidenceAccessDenied("Evidence retention period has expired")
                expires_at = _utc_now() + timedelta(
                    seconds=self._settings.evidence_access_ttl_seconds
                )
                _audit(
                    session,
                    actor_user_id=actor_user_id,
                    action="EVIDENCE_ACCESS_ISSUED",
                    entity_type="EVIDENCE",
                    entity_id=evidence.id,
                    before=None,
                    after={"expires_at": expires_at.isoformat()},
                )
                session.flush()
                return EvidenceAccess(
                    evidence_id=evidence.id,
                    token=_sign_access_token(
                        evidence.id,
                        actor_user_id,
                        expires_at,
                        self._settings.evidence_access_secret,
                    ),
                    expires_at=expires_at,
                )
        except (EvidenceAccessDenied, EvidenceNotFound):
            raise
        except Exception as exc:
            logger.error("Evidence access issuance failed")
            raise CertificationServiceUnavailable("Evidence service is unavailable") from exc
        finally:
            session.close()

    def create_validator_evidence_access(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        evidence_id: UUID,
    ) -> EvidenceAccess:
        session = self._session_factory()
        try:
            with session.begin():
                actor = session.get(User, actor_user_id)
                if actor is None or not actor.is_active or actor.role != "VALIDATOR":
                    raise EvidenceNotFound("Evidence not found")
                evidence = session.scalar(
                    select(Evidence)
                    .where(
                        Evidence.id == evidence_id,
                        Evidence.certification_id == certification_id,
                    )
                )
                if evidence is None:
                    raise EvidenceNotFound("Evidence not found")
                now = _utc_now()
                if evidence.retention_until is None or _as_utc(evidence.retention_until) <= now:
                    raise EvidenceAccessDenied("Evidence retention period has expired")
                expires_at = now + timedelta(seconds=self._settings.evidence_access_ttl_seconds)
                _audit(
                    session,
                    actor_user_id=actor_user_id,
                    action="EVIDENCE_ACCESS_ISSUED",
                    entity_type="EVIDENCE",
                    entity_id=evidence.id,
                    before=None,
                    after={"expires_at": expires_at.isoformat(), "scope": "VALIDATOR"},
                )
                session.flush()
                return EvidenceAccess(
                    evidence_id=evidence.id,
                    token=_sign_access_token(
                        evidence.id,
                        actor_user_id,
                        expires_at,
                        self._settings.evidence_access_secret,
                    ),
                    expires_at=expires_at,
                )
        except (EvidenceAccessDenied, EvidenceNotFound):
            raise
        except Exception as exc:
            logger.error("Validator evidence access issuance failed")
            raise CertificationServiceUnavailable("Evidence service is unavailable") from exc
        finally:
            session.close()

    def download_evidence(self, evidence_id: UUID, token: str) -> EvidenceDownload:
        try:
            token_evidence_id, actor_user_id, expires_at = _verify_access_token(
                token,
                self._settings.evidence_access_secret,
            )
            if token_evidence_id != evidence_id or _utc_now().timestamp() > expires_at:
                raise EvidenceAccessDenied("Evidence access token is invalid or expired")
        except (EvidenceAccessDenied, ValueError, UnicodeDecodeError):
            raise EvidenceAccessDenied("Evidence access token is invalid or expired")

        session = self._session_factory()
        try:
            evidence = session.get(Evidence, evidence_id)
            if evidence is None:
                raise EvidenceAccessDenied("Evidence access token is invalid")
            certification = session.get(Certification, evidence.certification_id)
            student = session.get(Student, certification.student_id) if certification else None
            actor = session.get(User, actor_user_id)
            validator_access = actor is not None and actor.is_active and actor.role == "VALIDATOR"
            if (
                certification is None
                or student is None
                or (student.user_id != actor_user_id and not validator_access)
            ):
                raise EvidenceAccessDenied("Evidence access token is invalid")
            if evidence.retention_until is None or _as_utc(evidence.retention_until) <= _utc_now():
                raise EvidenceAccessDenied("Evidence retention period has expired")
            if evidence.evidence_type == "URL":
                return EvidenceDownload(
                    evidence_id=evidence.id,
                    evidence_type=evidence.evidence_type,
                    source_url=evidence.source_url,
                    path=None,
                    content_type=None,
                    original_filename=None,
                )
            if not evidence.object_key:
                raise CertificationServiceUnavailable("Evidence metadata is incomplete")
            try:
                path = self._storage.path_for(evidence.object_key)
            except EvidenceStorageError as exc:
                raise CertificationServiceUnavailable("Evidence storage is unavailable") from exc
            return EvidenceDownload(
                evidence_id=evidence.id,
                evidence_type=evidence.evidence_type,
                source_url=None,
                path=path,
                content_type=evidence.content_type,
                original_filename=evidence.original_filename,
            )
        except EvidenceAccessDenied:
            raise
        except CertificationServiceUnavailable:
            raise
        except Exception as exc:
            logger.error("Evidence download resolution failed")
            raise CertificationServiceUnavailable("Evidence service is unavailable") from exc
        finally:
            session.close()


def _sign_access_token(
    evidence_id: UUID,
    actor_user_id: UUID,
    expires_at: datetime,
    secret: str | SecretStr,
) -> str:
    secret_value = secret.get_secret_value() if isinstance(secret, SecretStr) else secret
    payload = f"evidence:{evidence_id}:{actor_user_id}:{int(expires_at.timestamp())}".encode(
        "utf-8"
    )
    encoded = base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")
    signature = hmac.new(secret_value.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def _verify_access_token(
    token: str,
    secret: str | SecretStr,
) -> tuple[UUID, UUID, int]:
    secret_value = secret.get_secret_value() if isinstance(secret, SecretStr) else secret
    encoded, separator, signature = token.partition(".")
    if not separator or not encoded or not signature:
        raise ValueError("Malformed access token")
    padding = "=" * (-len(encoded) % 4)
    payload = base64.urlsafe_b64decode((encoded + padding).encode("ascii"))
    expected_signature = hmac.new(
        secret_value.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise ValueError("Invalid access token signature")
    parts = payload.decode("utf-8").split(":")
    if len(parts) != 4 or parts[0] != "evidence":
        raise ValueError("Invalid access token payload")
    return UUID(parts[1]), UUID(parts[2]), int(parts[3])


class UnavailableCertificationService:
    """Explicit failure mode when the API has no configured database."""

    def _raise(self) -> None:
        raise CertificationServiceUnavailable("PULSE_DATABASE_URL is not configured")

    def create_certification(
        self,
        actor_user_id: UUID,
        draft: CertificationDraft,
    ) -> CertificationView:
        self._raise()
        raise AssertionError("unreachable")

    def list_own(self, actor_user_id: UUID) -> list[CertificationView]:
        self._raise()
        return []

    def get_own(self, actor_user_id: UUID, certification_id: UUID) -> CertificationView:
        self._raise()
        raise AssertionError("unreachable")

    def update_own(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        changes: Mapping[str, object],
    ) -> CertificationView:
        self._raise()
        raise AssertionError("unreachable")

    def add_url_evidence(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        source_url: str,
    ) -> EvidenceView:
        self._raise()
        raise AssertionError("unreachable")

    def add_file_evidence(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        *,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> EvidenceView:
        self._raise()
        raise AssertionError("unreachable")

    def create_evidence_access(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        evidence_id: UUID,
    ) -> EvidenceAccess:
        self._raise()
        raise AssertionError("unreachable")

    def create_validator_evidence_access(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        evidence_id: UUID,
    ) -> EvidenceAccess:
        self._raise()
        raise AssertionError("unreachable")

    def download_evidence(self, evidence_id: UUID, token: str) -> EvidenceDownload:
        self._raise()
        raise AssertionError("unreachable")


__all__ = [
    "CertificationDraft",
    "CertificationDuplicate",
    "CertificationInvalid",
    "CertificationNotCorrectable",
    "CertificationNotFound",
    "CertificationService",
    "CertificationServiceProtocol",
    "CertificationServiceUnavailable",
    "CertificationView",
    "EvidenceAccess",
    "EvidenceAccessDenied",
    "EvidenceDownload",
    "EvidenceDuplicate",
    "EvidenceFileTooLarge",
    "EvidenceNotFound",
    "EvidenceView",
    "SkillInput",
    "StudentNotProvisioned",
    "UnavailableCertificationService",
    "append_status_history",
]
