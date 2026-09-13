"""Pydantic contracts for validator queue and decisions."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


ValidationAction = Literal["START_REVIEW", "APPROVE", "OBSERVE", "REJECT"]
CertificationStatus = Literal[
    "PENDING",
    "UNDER_REVIEW",
    "APPROVED",
    "OBSERVED",
    "RESUBMITTED",
    "REJECTED",
    "EXPIRED",
]


class ValidationDecisionRequest(BaseModel):
    action: ValidationAction
    comment: str | None = Field(default=None, max_length=2000)

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.strip().split())
        return normalized or None


class ValidationEvidenceResponse(BaseModel):
    id: UUID
    evidence_type: Literal["URL", "FILE"]
    original_filename: str | None
    content_type: str | None


class ValidationQueueResponse(BaseModel):
    id: UUID
    student_key: str
    credential_name: str
    issuer_name: str
    issued_on: date
    expires_on: date | None
    stored_status: CertificationStatus
    status: CertificationStatus
    source_url: str | None
    evidences: list[ValidationEvidenceResponse]
    latest_comment: str | None
    updated_at: datetime


class ValidationHistoryResponse(BaseModel):
    id: UUID
    certification_id: UUID
    actor_user_id: UUID | None
    from_status: CertificationStatus | None
    to_status: CertificationStatus
    comment: str | None
    cutoff_date: date | None
    changed_at: datetime


class ValidationDecisionResponse(BaseModel):
    certification_id: UUID
    action: ValidationAction
    status: CertificationStatus
    history: ValidationHistoryResponse


class ValidationEvidenceAccessResponse(BaseModel):
    evidence_id: UUID
    access_url: str
    expires_at: datetime


__all__ = [
    "ValidationDecisionRequest",
    "ValidationDecisionResponse",
    "ValidationEvidenceAccessResponse",
    "ValidationEvidenceResponse",
    "ValidationHistoryResponse",
    "ValidationQueueResponse",
]
