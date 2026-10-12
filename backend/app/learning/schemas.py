"""Validated public contracts; no client-supplied ownership or publication flags."""
from datetime import date, datetime, timezone
from typing import Annotated, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, field_validator
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Skill = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
Cycle = Literal['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class InterestInput(Input):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    active: bool = True

class StepInput(Input):
    title: Text
    skills: list[Skill] = Field(default_factory=list, max_length=20)
    prerequisites: list[Skill] = Field(default_factory=list, max_length=20)

class RouteInput(Input):
    title: Text
    description: str = Field(min_length=10, max_length=2000)
    steps: list[StepInput] = Field(min_length=1, max_length=30)

class CourseInput(Input):
    title: Text
    provider: Annotated[str, StringConstraints(min_length=1, max_length=150)]
    source_url: HttpUrl
    checked_on: date
    requirements: list[Skill] = Field(default_factory=list, max_length=20)
    skills: list[Skill] = Field(min_length=1, max_length=20)

    @field_validator('source_url')
    @classmethod
    def https(cls, value):
        if value.scheme != 'https' or value.username or value.password or (len(str(value)) > 2048):
            raise ValueError('Fuente HTTPS sin credenciales requerida')
        return value

    @field_validator('checked_on')
    @classmethod
    def checked_date(cls, value):
        if value > datetime.now(timezone.utc).date():
            raise ValueError('Fecha de consulta futura')
        return value

class OfferInput(Input):
    course_id: UUID
    title: Text
    cycles: list[Cycle] = Field(default_factory=list, max_length=10)
    interest_ids: list[UUID] = Field(default_factory=list, max_length=30)
    relevance: str = Field(default='', max_length=2000)

class WorkshopInput(Input):
    offer_id: UUID
    title: Text
    capacity: int = Field(ge=1, le=10000, strict=True)
    requirements: list[Skill] = Field(default_factory=list, max_length=20)

class PreferenceInput(Input):
    route_id: UUID | None = None
    interest_ids: list[UUID] = Field(default_factory=list, max_length=30)

class Decision(Input):
    status: Literal['IN_REVIEW', 'PUBLISHED', 'DISCARDED', 'RETIRED', 'OPEN', 'CLOSED', 'COMPLETED', 'ACCEPTED', 'REJECTED']
    reason: str = Field(min_length=10, max_length=2000)

class ApplyInput(Input):
    workshop_id: UUID
    requirements_acknowledged: Literal[True]
from datetime import datetime
from typing import Any

class InterestOutput(InterestInput):
    id: UUID
    created_at: datetime

class StepOutput(StepInput):
    id: UUID
    route_id: UUID
    position: int
    created_at: datetime

class RouteOutput(RouteInput):
    id: UUID
    status: Literal['DRAFT', 'PUBLISHED', 'RETIRED']
    created_at: datetime
    steps: list[StepOutput]

class CourseOutput(CourseInput):
    id: UUID
    status: Literal['DETECTED', 'IN_REVIEW', 'PUBLISHED', 'DISCARDED', 'RETIRED']
    created_at: datetime

class OfferOutput(OfferInput):
    id: UUID
    status: Literal['DRAFT', 'PUBLISHED', 'RETIRED']
    created_at: datetime

class WorkshopOutput(WorkshopInput):
    occupied_places: int
    available_places: int
    id: UUID
    status: Literal['DRAFT', 'OPEN', 'CLOSED', 'COMPLETED']
    created_at: datetime

class ApplicationOutput(Input):
    id: UUID
    student_id: UUID
    workshop_id: UUID
    status: Literal['SUBMITTED', 'ACCEPTED', 'REJECTED', 'COMPLETED']
    comment: str | None
    created_at: datetime

class AuditOutput(Input):
    id: UUID
    actor_id: UUID | None
    entity_type: str
    entity_id: UUID
    sequence: int
    action: str
    before: dict[str, Any] | None
    after: dict[str, Any]
    reason: str
    created_at: datetime
