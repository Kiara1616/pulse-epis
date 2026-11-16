"""HTTP contracts for canonical issuer resolution."""

from __future__ import annotations

from datetime import datetime
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _text(value: str, *, field: str, maximum: int) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized or len(normalized) > maximum:
        raise ValueError(f"{field} is invalid")
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
        raise ValueError(f"{field} must be an HTTP(S) URL")
    return normalized


class IssuerCatalogResponse(BaseModel):
    id: UUID
    name: str
    website_url: str | None
    logo_url: str | None
    is_active: bool
    archived_at: datetime | None
    created_at: datetime


class IssuerCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    website_url: str | None = Field(default=None, max_length=2048)
    logo_url: str | None = Field(default=None, max_length=2048)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return _text(value, field="name", maximum=150)

    @field_validator("website_url", "logo_url")
    @classmethod
    def validate_urls(cls, value: str | None, info) -> str | None:
        return _url(value, field=str(info.field_name))


class IssuerUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    website_url: str | None = Field(default=None, max_length=2048)
    logo_url: str | None = Field(default=None, max_length=2048)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        return _text(value, field="name", maximum=150) if value is not None else None

    @field_validator("website_url", "logo_url")
    @classmethod
    def validate_urls(cls, value: str | None, info) -> str | None:
        return _url(value, field=str(info.field_name))


class IssuerAssignmentRequest(BaseModel):
    issuer_id: UUID


class IssuerRequestCreate(BaseModel):
    raw_name: str | None = Field(default=None, max_length=150)
    website_url: str | None = Field(default=None, max_length=2048)
    note: str = Field(min_length=1, max_length=2000)

    @field_validator("raw_name", "note")
    @classmethod
    def normalize_text(cls, value: str | None, info) -> str | None:
        return _text(value, field=str(info.field_name), maximum=2000 if info.field_name == "note" else 150) if value is not None else None

    @field_validator("website_url")
    @classmethod
    def validate_website_url(cls, value: str | None) -> str | None:
        return _url(value, field="website_url")


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


class IssuerRequestApprove(BaseModel):
    issuer_id: UUID | None = None
    name: str | None = Field(default=None, max_length=150)
    website_url: str | None = Field(default=None, max_length=2048)
    logo_url: str | None = Field(default=None, max_length=2048)
    comment: str | None = Field(default=None, max_length=2000)

    @field_validator("name", "comment")
    @classmethod
    def normalize_optional_text(cls, value: str | None, info) -> str | None:
        if value is None:
            return None
        return _text(value, field=str(info.field_name), maximum=2000 if info.field_name == "comment" else 150)

    @field_validator("website_url", "logo_url")
    @classmethod
    def validate_optional_urls(cls, value: str | None, info) -> str | None:
        return _url(value, field=str(info.field_name))


class IssuerRequestReject(BaseModel):
    comment: str = Field(min_length=1, max_length=2000)

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str) -> str:
        return _text(value, field="comment", maximum=2000)


class IssuerResolutionResponse(BaseModel):
    certification_id: UUID
    issuer: IssuerCatalogResponse
    request_id: UUID | None = None


__all__ = [
    "IssuerAssignmentRequest",
    "IssuerCatalogResponse",
    "IssuerCreateRequest",
    "IssuerRequestApprove",
    "IssuerRequestCreate",
    "IssuerRequestReject",
    "IssuerRequestResponse",
    "IssuerResolutionResponse",
    "IssuerUpdateRequest",
]
