"""State transitions, validator queues and cutoff-aware certification status."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from ..certifications.service import (
    EvidenceAccess,
    append_status_history,
    _as_utc,
    _audit,
    _utc_now,
)
from ..core.config import Settings
from ..db.models import (
    Certification,
    CertificationStatusHistory,
    Evidence,
    Issuer,
    Student,
    User,
    Validation,
)


logger = logging.getLogger(__name__)

CERTIFICATION_STATUSES = frozenset(
    {
        "PENDING",
        "UNDER_REVIEW",
        "APPROVED",
        "OBSERVED",
        "RESUBMITTED",
        "REJECTED",
        "EXPIRED",
    }
)
VALIDATION_ACTIONS = frozenset({"START_REVIEW", "APPROVE", "OBSERVE", "REJECT"})


class ValidationActorNotAllowed(RuntimeError):
    """The actor is not an active validator."""


class ValidationNotFound(RuntimeError):
    """The certification or history target is not visible to the validator."""


class ValidationInvalid(RuntimeError):
    """The validation request is malformed."""


class ValidationCommentRequired(ValidationInvalid):
    """Observations and rejections must explain the decision."""


class ValidationTransitionNotAllowed(RuntimeError):
    """The requested action is not valid for the current status."""


class ValidationServiceUnavailable(RuntimeError):
    """The validation persistence dependency is unavailable."""


@dataclass(frozen=True, slots=True)
class ValidationEvidenceView:
    id: UUID
    evidence_type: str
    original_filename: str | None
    content_type: str | None


@dataclass(frozen=True, slots=True)
class ValidationQueueItem:
    id: UUID
    student_key: str
    credential_name: str
    issuer_name: str
    issued_on: date
    expires_on: date | None
    stored_status: str
    status: str
    source_url: str | None
    evidences: tuple[ValidationEvidenceView, ...]
    latest_comment: str | None
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class ValidationHistoryView:
    id: UUID
    certification_id: UUID
    actor_user_id: UUID | None
    from_status: str | None
    to_status: str
    comment: str | None
    cutoff_date: date | None
    changed_at: datetime


@dataclass(frozen=True, slots=True)
class ValidationDecision:
    certification_id: UUID
    action: str
    status: str
    history: ValidationHistoryView


def effective_status(
    status: str,
    expires_on: date | None,
    cutoff_date: date,
) -> str:
    """Return the status visible at a reproducible cutoff date.

    Expiration is derived only from an approval and never overwrites its
    decision, so historical KPI snapshots remain reproducible.
    """

    if status == "APPROVED" and expires_on is not None and expires_on < cutoff_date:
        return "EXPIRED"
    return status


def is_kpi_eligible(certification: Certification, cutoff_date: date) -> bool:
    """Only a non-expired persisted approval can enter official KPIs."""

    return (
        certification.status == "APPROVED"
        and effective_status(certification.status, certification.expires_on, cutoff_date)
        == "APPROVED"
    )


class ValidationServiceProtocol(Protocol):
    def list_queue(
        self,
        actor_user_id: UUID,
        *,
        status_filter: str | None = None,
        cutoff_date: date,
    ) -> list[ValidationQueueItem]:
        """List validator-visible certification records without student PII."""

    def transition(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        *,
        action: str,
        comment: str | None = None,
        cutoff_date: date,
    ) -> ValidationDecision:
        """Apply one authorized transition and append its history."""

    def history(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
    ) -> list[ValidationHistoryView]:
        """Read the immutable transition history."""

    def create_evidence_access(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        evidence_id: UUID,
    ) -> EvidenceAccess:
        """Issue temporary evidence access for a validator."""


def _normalize_comment(comment: str | None) -> str | None:
    if comment is None:
        return None
    normalized = " ".join(comment.strip().split())
    if not normalized:
        return None
    if len(normalized) > 2000:
        raise ValidationInvalid("comment must be at most 2000 characters")
    return normalized


class ValidationService:
    """Apply the certification validation state machine transactionally."""

    def __init__(self, session_factory: sessionmaker[Session], settings: Settings) -> None:
        self._session_factory = session_factory
        self._settings = settings

    def _validator(self, session: Session, actor_user_id: UUID) -> User:
        actor = session.get(User, actor_user_id)
        if actor is None or not actor.is_active or actor.role != "VALIDATOR":
            raise ValidationActorNotAllowed("Only an active validator can decide certifications")
        return actor

    def _queue_item(
        self,
        session: Session,
        certification: Certification,
        cutoff_date: date,
    ) -> ValidationQueueItem:
        issuer = session.get(Issuer, certification.issuer_id)
        student = session.get(Student, certification.student_id)
        if issuer is None or student is None:
            raise ValidationServiceUnavailable("Certification references are incomplete")
        evidence_rows = session.scalars(
            select(Evidence)
            .where(Evidence.certification_id == certification.id)
            .order_by(Evidence.uploaded_at, Evidence.id)
        ).all()
        latest = session.scalar(
            select(CertificationStatusHistory)
            .where(
                CertificationStatusHistory.certification_id == certification.id,
                CertificationStatusHistory.comment.is_not(None),
            )
            .order_by(
                CertificationStatusHistory.changed_at.desc(),
                CertificationStatusHistory.id.desc(),
            )
        )
        return ValidationQueueItem(
            id=certification.id,
            student_key=student.student_key,
            credential_name=certification.credential_name,
            issuer_name=issuer.name,
            issued_on=certification.issued_on,
            expires_on=certification.expires_on,
            stored_status=certification.status,
            status=effective_status(certification.status, certification.expires_on, cutoff_date),
            source_url=certification.source_url,
            evidences=tuple(
                ValidationEvidenceView(
                    id=evidence.id,
                    evidence_type=evidence.evidence_type,
                    original_filename=evidence.original_filename,
                    content_type=evidence.content_type,
                )
                for evidence in evidence_rows
            ),
            latest_comment=latest.comment if latest is not None else None,
            updated_at=_as_utc(certification.updated_at),
        )

    def list_queue(
        self,
        actor_user_id: UUID,
        *,
        status_filter: str | None = None,
        cutoff_date: date,
    ) -> list[ValidationQueueItem]:
        if status_filter is not None and status_filter not in CERTIFICATION_STATUSES:
            raise ValidationInvalid("status filter is invalid")
        session = self._session_factory()
        try:
            self._validator(session, actor_user_id)
            certifications = session.scalars(
                select(Certification).order_by(
                    Certification.updated_at.desc(), Certification.id
                )
            ).all()
            result = [self._queue_item(session, item, cutoff_date) for item in certifications]
            if status_filter is not None:
                result = [item for item in result if item.status == status_filter]
            return result
        except (ValidationActorNotAllowed, ValidationInvalid):
            raise
        except Exception as exc:
            logger.error("Validation queue listing failed")
            raise ValidationServiceUnavailable("Validation service is unavailable") from exc
        finally:
            session.close()

    def transition(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        *,
        action: str,
        comment: str | None = None,
        cutoff_date: date,
    ) -> ValidationDecision:
        if action not in VALIDATION_ACTIONS:
            raise ValidationInvalid("action is invalid")
        normalized_comment = _normalize_comment(comment)
        if action in {"OBSERVE", "REJECT"} and normalized_comment is None:
            raise ValidationCommentRequired("A comment is required for this decision")

        session = self._session_factory()
        try:
            with session.begin():
                self._validator(session, actor_user_id)
                certification = session.scalar(
                    select(Certification)
                    .where(Certification.id == certification_id)
                    .with_for_update()
                )
                if certification is None:
                    raise ValidationNotFound("Certification not found")
                current_status = certification.status
                visible_status = effective_status(
                    current_status,
                    certification.expires_on,
                    cutoff_date,
                )
                if visible_status == "EXPIRED":
                    raise ValidationTransitionNotAllowed(
                        "An expired certification cannot receive a new decision"
                    )

                transition_map = {
                    "START_REVIEW": {
                        "PENDING": "UNDER_REVIEW",
                        "RESUBMITTED": "UNDER_REVIEW",
                    },
                    "APPROVE": {"UNDER_REVIEW": "APPROVED"},
                    "OBSERVE": {"UNDER_REVIEW": "OBSERVED"},
                    "REJECT": {"UNDER_REVIEW": "REJECTED"},
                }
                target_status = transition_map[action].get(current_status)
                if target_status is None:
                    raise ValidationTransitionNotAllowed(
                        f"Action {action} is not allowed from {current_status}"
                    )

                now = _utc_now()
                certification.status = target_status
                certification.updated_at = now
                if action in {"APPROVE", "OBSERVE", "REJECT"}:
                    session.add(
                        Validation(
                            id=uuid4(),
                            certification_id=certification.id,
                            validator_user_id=actor_user_id,
                            decision=target_status,
                            comment=normalized_comment,
                            decided_at=now,
                        )
                    )
                history = append_status_history(
                    session,
                    certification_id=certification.id,
                    actor_user_id=actor_user_id,
                    from_status=current_status,
                    to_status=target_status,
                    comment=normalized_comment,
                    cutoff_date=cutoff_date,
                    changed_at=now,
                )
                _audit(
                    session,
                    actor_user_id=actor_user_id,
                    action="CERTIFICATION_STATUS_CHANGED",
                    entity_type="CERTIFICATION",
                    entity_id=certification.id,
                    before={"status": current_status},
                    after={
                        "status": target_status,
                        "action": action,
                        "comment_present": normalized_comment is not None,
                    },
                )
                session.flush()
                return ValidationDecision(
                    certification_id=certification.id,
                    action=action,
                    status=target_status,
                    history=self._history_view(history),
                )
        except (
            ValidationActorNotAllowed,
            ValidationInvalid,
            ValidationNotFound,
            ValidationTransitionNotAllowed,
        ):
            raise
        except IntegrityError as exc:
            raise ValidationServiceUnavailable("Validation service is unavailable") from exc
        except Exception as exc:
            logger.error("Certification validation transition failed")
            raise ValidationServiceUnavailable("Validation service is unavailable") from exc
        finally:
            session.close()

    @staticmethod
    def _history_view(item: CertificationStatusHistory) -> ValidationHistoryView:
        return ValidationHistoryView(
            id=item.id,
            certification_id=item.certification_id,
            actor_user_id=item.actor_user_id,
            from_status=item.from_status,
            to_status=item.to_status,
            comment=item.comment,
            cutoff_date=item.cutoff_date,
            changed_at=_as_utc(item.changed_at),
        )

    def history(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
    ) -> list[ValidationHistoryView]:
        session = self._session_factory()
        try:
            self._validator(session, actor_user_id)
            if session.scalar(select(Certification.id).where(Certification.id == certification_id)) is None:
                raise ValidationNotFound("Certification not found")
            rows = session.scalars(
                select(CertificationStatusHistory)
                .where(CertificationStatusHistory.certification_id == certification_id)
                .order_by(CertificationStatusHistory.changed_at, CertificationStatusHistory.id)
            ).all()
            return [self._history_view(row) for row in rows]
        except (ValidationActorNotAllowed, ValidationNotFound):
            raise
        except Exception as exc:
            logger.error("Validation history lookup failed")
            raise ValidationServiceUnavailable("Validation service is unavailable") from exc
        finally:
            session.close()

    def create_evidence_access(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        evidence_id: UUID,
    ) -> EvidenceAccess:
        from ..certifications.service import CertificationService

        # Keep token creation and download authorization in the certification
        # service so both student and validator links share one implementation.
        return CertificationService(
            self._session_factory,
            self._settings,
        ).create_validator_evidence_access(
            actor_user_id,
            certification_id,
            evidence_id,
        )


class UnavailableValidationService:
    """Explicit failure mode when the API has no configured database."""

    def _raise(self) -> None:
        raise ValidationServiceUnavailable("PULSE_DATABASE_URL is not configured")

    def list_queue(
        self,
        actor_user_id: UUID,
        *,
        status_filter: str | None = None,
        cutoff_date: date,
    ) -> list[ValidationQueueItem]:
        self._raise()
        return []

    def transition(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        *,
        action: str,
        comment: str | None = None,
        cutoff_date: date,
    ) -> ValidationDecision:
        self._raise()
        raise AssertionError("unreachable")

    def history(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
    ) -> list[ValidationHistoryView]:
        self._raise()
        return []

    def create_evidence_access(
        self,
        actor_user_id: UUID,
        certification_id: UUID,
        evidence_id: UUID,
    ) -> EvidenceAccess:
        self._raise()
        raise AssertionError("unreachable")


__all__ = [
    "CERTIFICATION_STATUSES",
    "VALIDATION_ACTIONS",
    "UnavailableValidationService",
    "ValidationActorNotAllowed",
    "ValidationCommentRequired",
    "ValidationDecision",
    "ValidationEvidenceView",
    "ValidationHistoryView",
    "ValidationInvalid",
    "ValidationNotFound",
    "ValidationQueueItem",
    "ValidationService",
    "ValidationServiceProtocol",
    "ValidationServiceUnavailable",
    "ValidationTransitionNotAllowed",
    "effective_status",
    "is_kpi_eligible",
]
