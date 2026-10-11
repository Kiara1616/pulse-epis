"""Admin-only manual source intake, review and auditable publication."""
from datetime import date, datetime, timezone
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from ...auth.dependencies import require_permissions
from ...auth.models import AuthenticatedUser, Permission
from ...db.models import LearningOpportunity

admin = require_permissions(Permission.CATALOG_MANAGE)
router = APIRouter(prefix="/opportunities", tags=["opportunities"], dependencies=[Depends(admin)])

class OpportunityInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(min_length=3, max_length=200)
    provider: str = Field(min_length=2, max_length=120)
    source_url: HttpUrl
    area: Literal["IA", "Datos", "Desarrollo", "Redes", "Nube", "Otros"]
    level: Literal["Inicial", "Intermedio", "Avanzado"]
    skills: list[str] = Field(min_length=1, max_length=20)
    prerequisites: str = Field(min_length=1, max_length=1000)
    rationale: str = Field(min_length=10, max_length=1000)
    cost_pen: float | None = Field(default=None, ge=0, le=1000000, allow_inf_nan=False)
    checked_on: date

    @field_validator("source_url")
    @classmethod
    def https_only(cls, value):
        if value.scheme != "https" or value.username or value.password or len(str(value)) > 2048:
            raise ValueError("Usa una URL HTTPS sin credenciales.")
        return value

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, values):
        result = list(dict.fromkeys(v.strip().casefold() for v in values))
        if any(not v or len(v) > 100 for v in result):
            raise ValueError("Competencias vacías o demasiado largas.")
        return result

    @field_validator("checked_on")
    @classmethod
    def not_future(cls, value):
        if value > datetime.now(timezone.utc).date():
            raise ValueError("La consulta no puede tener fecha futura.")
        return value

class Decision(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    status: Literal["PUBLISHED", "RETIRED"]
    reason: str = Field(min_length=10, max_length=1000)

def factory(request):
    if request.app.state.session_factory is None:
        raise HTTPException(503, "Base de datos no disponible.")
    return request.app.state.session_factory

def serialize(item):
    return {"id": str(item.id), **item.details, "source_url": item.source_url,
            "status": item.status, "history": item.history}

def event(actor, status, reason):
    return {"actor_id": str(actor.id), "status": status, "reason": reason,
            "at": datetime.now(timezone.utc).isoformat()}

@router.get("")
def listing(request: Request):
    with factory(request)() as session:
        return [serialize(i) for i in session.scalars(select(LearningOpportunity).order_by(LearningOpportunity.source_url))]

@router.post("", status_code=201)
def create(request: Request, payload: OpportunityInput, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        item = LearningOpportunity(source_url=str(payload.source_url), status="DRAFT",
            details=payload.model_dump(mode="json", exclude={"source_url"}),
            history=[event(actor, "DRAFT", "Registro manual de fuente")])
        session.add(item)
        try:
            session.commit()
        except IntegrityError as exc:
            session.rollback()
            raise HTTPException(409, "La fuente ya está registrada.") from exc
        return serialize(item)

@router.post("/{item_id}/decision")
def decide(item_id: UUID, request: Request, payload: Decision, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        item = session.scalar(select(LearningOpportunity).where(LearningOpportunity.id == item_id).with_for_update())
        if item is None:
            raise HTTPException(404, "Oportunidad no encontrada.")
        allowed = {"DRAFT": {"PUBLISHED", "RETIRED"}, "PUBLISHED": {"RETIRED"}, "RETIRED": set()}
        if payload.status not in allowed[item.status]:
            raise HTTPException(409, "La transición ya no está disponible.")
        item.status = payload.status
        item.history = [*item.history, event(actor, payload.status, payload.reason)]
        session.commit()
        return serialize(item)
