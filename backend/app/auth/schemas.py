"""Public schemas for the authenticated session."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from .models import Permission, Role


class CurrentUserResponse(BaseModel):
    id: UUID
    email: str
    role: Role
    student_id: UUID | None
    permissions: list[Permission]


class AuthConfigurationResponse(BaseModel):
    """Public authentication mode used by the frontend login screen."""

    provider: Literal["google", "local"]


class LocalLoginRequest(BaseModel):
    """Credentials accepted only by the development local provider."""

    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)
