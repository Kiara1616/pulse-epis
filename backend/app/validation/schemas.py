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


class ValidationSkillResponse(BaseModel):
    name: str
    level: str | None


class ValidationQueueResponse(BaseModel):
    id: UUID
    student_name: str
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
    external_id: str | None = None
    issuer_url: str | None = None
    skills: list[ValidationSkillResponse] = Field(default_factory=list)
    updated_at: datetime
    source_kind: str = "MANUAL"
    source_external_id: str | None = None


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


class IssuerAssignmentRequest(BaseModel):
    issuer_id: UUID


class IssuerRequestCreate(BaseModel):
    raw_name: str | None = Field(default=None, max_length=150)
    website_url: str | None = Field(default=None, max_length=2048)
    note: str = Field(min_length=1, max_length=2000)


class IssuerRequestResponse(BaseModel):
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


__all__ = [
    "ValidationDecisionRequest",
    "ValidationDecisionResponse",
    "ValidationEvidenceAccessResponse",
    "ValidationEvidenceResponse",
    "ValidationHistoryResponse",
    "ValidationQueueResponse",
    "IssuerAssignmentRequest",
    "IssuerRequestCreate",
    "IssuerRequestResponse",
]
