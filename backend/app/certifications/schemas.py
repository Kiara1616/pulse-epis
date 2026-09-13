"""Validated HTTP contracts for student certifications and evidence."""

from __future__ import annotations

from datetime import date, datetime
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _text(value: str, *, field: str, maximum: int) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized or len(normalized) > maximum:
        raise ValueError(f"{field} is invalid")
    return normalized


def _optional_text(value: str | None, *, field: str, maximum: int) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.strip().split())
    if not normalized:
        return None
    if len(normalized) > maximum:
        raise ValueError(f"{field} is invalid")
    return normalized


def _url(value: str | None, *, field: str) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    parsed = urlsplit(normalized)
    if (
        parsed.scheme.lower() not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or len(normalized) > 2048
    ):
        raise ValueError(f"{field} must be an HTTP(S) URL")
    return normalized


class SkillRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    level: str | None = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return _text(value, field="skill_name", maximum=150)

    @field_validator("level")
    @classmethod
    def normalize_level(cls, value: str | None) -> str | None:
        return _optional_text(value, field="skill_level", maximum=50)


class CertificationCreateRequest(BaseModel):
    issuer_name: str = Field(min_length=1, max_length=150)
    issuer_url: str | None = Field(default=None, max_length=2048)
    credential_name: str = Field(min_length=1, max_length=200)
    external_id: str | None = Field(default=None, max_length=200)
    issued_on: date
    expires_on: date | None = None
    source_url: str | None = Field(default=None, max_length=2048)
    skills: list[SkillRequest] = Field(default_factory=list, max_length=20)

    @field_validator("issuer_name")
    @classmethod
    def normalize_issuer_name(cls, value: str) -> str:
        return _text(value, field="issuer_name", maximum=150)

    @field_validator("credential_name")
    @classmethod
    def normalize_credential_name(cls, value: str) -> str:
        return _text(value, field="credential_name", maximum=200)

    @field_validator("external_id")
    @classmethod
    def normalize_external_id(cls, value: str | None) -> str | None:
        return _optional_text(value, field="external_id", maximum=200)

    @field_validator("issuer_url", "source_url")
    @classmethod
    def validate_urls(cls, value: str | None, info) -> str | None:
        return _url(value, field=str(info.field_name))

    @model_validator(mode="after")
    def validate_dates_and_skills(self) -> "CertificationCreateRequest":
        if self.expires_on is not None and self.expires_on < self.issued_on:
            raise ValueError("expires_on cannot precede issued_on")
        names = [skill.name.casefold() for skill in self.skills]
        if len(names) != len(set(names)):
            raise ValueError("skills cannot be duplicated")
        return self


class CertificationUpdateRequest(BaseModel):
    issuer_name: str | None = Field(default=None, max_length=150)
    issuer_url: str | None = Field(default=None, max_length=2048)
    credential_name: str | None = Field(default=None, max_length=200)
    external_id: str | None = Field(default=None, max_length=200)
    issued_on: date | None = None
    expires_on: date | None = None
    source_url: str | None = Field(default=None, max_length=2048)
    skills: list[SkillRequest] | None = Field(default=None, max_length=20)

    @field_validator("issuer_name")
    @classmethod
    def normalize_issuer_name(cls, value: str | None) -> str | None:
        return _text(value, field="issuer_name", maximum=150) if value is not None else None

    @field_validator("credential_name")
    @classmethod
    def normalize_credential_name(cls, value: str | None) -> str | None:
        return _text(value, field="credential_name", maximum=200) if value is not None else None

    @field_validator("external_id")
    @classmethod
    def normalize_external_id(cls, value: str | None) -> str | None:
        return _optional_text(value, field="external_id", maximum=200)

    @field_validator("issuer_url", "source_url")
    @classmethod
    def validate_urls(cls, value: str | None, info) -> str | None:
        return _url(value, field=str(info.field_name))

    @model_validator(mode="after")
    def validate_dates_and_skills(self) -> "CertificationUpdateRequest":
        if (
            self.issued_on is not None
            and self.expires_on is not None
            and self.expires_on < self.issued_on
        ):
            raise ValueError("expires_on cannot precede issued_on")
        if self.skills is not None:
            names = [skill.name.casefold() for skill in self.skills]
            if len(names) != len(set(names)):
                raise ValueError("skills cannot be duplicated")
        return self


class SkillResponse(BaseModel):
    id: UUID
    name: str
    level: str | None


class EvidenceResponse(BaseModel):
    id: UUID
    evidence_type: str
    source_url: str | None
    original_filename: str | None
    content_type: str | None
    byte_size: int | None
    sha256: str
    retention_until: datetime
    uploaded_at: datetime


class CertificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    skills: list[SkillResponse]
    evidences: list[EvidenceResponse]
    created_at: datetime
    updated_at: datetime
    correction_allowed: bool


class EvidenceAccessResponse(BaseModel):
    evidence_id: UUID
    access_url: str
    expires_at: datetime


__all__ = [
    "CertificationCreateRequest",
    "CertificationResponse",
    "CertificationUpdateRequest",
    "EvidenceAccessResponse",
    "EvidenceResponse",
    "SkillRequest",
    "SkillResponse",
]
