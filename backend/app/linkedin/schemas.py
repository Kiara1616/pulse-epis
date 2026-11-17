"""HTTP contracts for the student's LinkedIn profile integration."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


LinkedInSyncStatus = Literal["NEVER", "RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"]


class LinkedInProfileUpdate(BaseModel):
    """A student may clear an old URL or replace it with a new profile URL."""

    linkedin_url: str | None = Field(default=None, max_length=2048)

    @field_validator("linkedin_url")
    @classmethod
    def normalize_whitespace(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.strip().split())
        return normalized or None


class LinkedInProfileResponse(BaseModel):
    linkedin_url: str | None
    consent_at: datetime | None
    last_sync_at: datetime | None
    sync_status: LinkedInSyncStatus
    sync_error: str | None
    pending_candidates: int = 0


class LinkedInSyncResponse(BaseModel):
    profile_candidates: int
    publication_candidates: int
    created: int
    updated: int = 0
    duplicates: int
    status: Literal["SUCCEEDED", "PARTIAL", "FAILED"]
    message: str


__all__ = [
    "LinkedInProfileResponse",
    "LinkedInProfileUpdate",
    "LinkedInSyncResponse",
    "LinkedInSyncStatus",
]
