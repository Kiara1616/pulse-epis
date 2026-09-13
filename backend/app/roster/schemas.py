"""API response contracts for padrón imports."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class RosterRejectionResponse(BaseModel):
    row_number: int
    field_name: str
    reason_code: str
    message: str


class RosterImportResponse(BaseModel):
    id: UUID
    period_code: str
    status: Literal["APPLIED", "REJECTED"]
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    rejections: list[RosterRejectionResponse]
    idempotent: bool


class RosterImportHistoryResponse(BaseModel):
    id: UUID
    period_code: str
    status: Literal["APPLIED", "REJECTED"]
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    created_at: datetime
    completed_at: datetime | None
