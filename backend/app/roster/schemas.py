"""API response contracts for padrón imports."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class RosterPeriodResponse(BaseModel):
    code: str
    starts_on: date
    ends_on: date


class RosterPeriodCreate(BaseModel):
    code: str = Field(pattern=r"^20\d{2}-(?:I|II)$")
    starts_on: date
    ends_on: date

    @model_validator(mode="after")
    def dates(self):
        if self.ends_on < self.starts_on:
            raise ValueError("La fecha final debe ser posterior al inicio.")
        return self


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


class RosterCandidateUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    cycle: str = Field(min_length=1, max_length=32)
    email: str = Field(min_length=3, max_length=320)
    student_code: str = Field(min_length=3, max_length=64)
    school: str = Field(min_length=1, max_length=150)
    study_plan: str = Field(min_length=1, max_length=120)
    student_status: Literal["ACTIVE", "INACTIVE", "GRADUATED"] = "ACTIVE"


class RosterCandidateExclusion(BaseModel):
    reason: str = Field(min_length=5, max_length=500)
