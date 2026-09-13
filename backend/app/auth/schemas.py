"""Public schemas for the authenticated session."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from .models import Permission, Role


class CurrentUserResponse(BaseModel):
    id: UUID
    email: str
    role: Role
    student_id: UUID | None
    permissions: list[Permission]
