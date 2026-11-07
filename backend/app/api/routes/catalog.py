"""Controlled issuer, credential and skill vocabulary."""

from datetime import datetime, timezone
from datetime import date
import hashlib
import unicodedata
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select

from ...auth.dependencies import require_roles
from ...auth.models import AuthenticatedUser, Role
from ...db.models import (
    CatalogProposal, CertificationSubmissionDraft, CredentialCatalog, CredentialCatalogSkill,
    Issuer, IssuerAlias, Skill, AuditLog,
)
from ...evidence.storage import LocalEvidenceStorage
from ...certifications.service import CertificationInvalid, EvidenceDuplicate, EvidenceFileTooLarge

router = APIRouter(prefix="/catalog", tags=["catalog"])
admin = require_roles(Role.ADMIN)
reader = require_roles(Role.ADMIN, Role.STUDENT, Role.VALIDATOR)
student = require_roles(Role.STUDENT)


def key(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value.casefold())
    return " ".join("".join(c for c in folded if not unicodedata.combining(c)).split())


def clean(value: str, limit: int = 200) -> str:
    result = " ".join(value.strip().split())
    if not result or len(result) > limit:
        raise HTTPException(422, detail={"code": "INVALID_NAME", "message": "Indica un nombre válido."})
    return result


def factory(request: Request):
    value = request.app.state.session_factory
    if value is None:
        raise HTTPException(503, detail={"code": "CATALOG_UNAVAILABLE", "message": "El catálogo no está disponible."})
    return value


def issuer_view(session, item: Issuer) -> dict:
    aliases = session.scalars(select(IssuerAlias.name).where(IssuerAlias.issuer_id == item.id).order_by(IssuerAlias.name)).all()
    return {"id": item.id, "name": item.name, "website_url": item.website_url, "active": item.active, "aliases": aliases}


def credential_view(session, item: CredentialCatalog) -> dict:
    skill_ids = session.scalars(select(CredentialCatalogSkill.skill_id).where(CredentialCatalogSkill.credential_id == item.id)).all()
    return {"id": item.id, "issuer_id": item.issuer_id, "name": item.name, "active": item.active, "skill_ids": skill_ids}


def record(session, actor: AuthenticatedUser, action: str, kind: str, identifier: UUID, before: dict | None, after: dict) -> None:
    session.add(AuditLog(actor_user_id=actor.id, action=action, entity_type=kind, entity_id=str(identifier), before_data=before, after_data=after))


class IssuerInput(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    website_url: HttpUrl | None = None
    active: bool = True


class CredentialInput(BaseModel):
    issuer_id: UUID
    name: str = Field(min_length=1, max_length=200)
    skill_ids: list[UUID] = Field(default_factory=list, max_length=20)
    active: bool = True


class SkillInput(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    category: str | None = Field(default=None, max_length=100)
    active: bool = True


class ProposalInput(BaseModel):
    kind: str
    proposed_name: str = Field(min_length=1, max_length=200)
    issuer_id: UUID | None = None


class ResolutionInput(BaseModel):
    target_id: UUID
    reason: str = Field(min_length=3, max_length=2000)


class RejectionInput(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)


class DraftInput(BaseModel):
    issuer_id: UUID | None = None
    catalog_credential_id: UUID | None = None
    skill_ids: list[UUID] = Field(default_factory=list, max_length=20)
    proposal_ids: list[UUID] = Field(default_factory=list, max_length=20)
    issued_on: date
    expires_on: date | None = None
    source_url: HttpUrl | None = None


class DraftSubmitInput(BaseModel):
    issuer_id: UUID
    catalog_credential_id: UUID
    skill_ids: list[UUID] = Field(min_length=1, max_length=20)


@router.get("/issuers")
def issuers(request: Request, actor: AuthenticatedUser = Depends(reader)):
    with factory(request)() as session:
        query = select(Issuer).order_by(Issuer.name)
        if actor.role != Role.ADMIN:
            query = query.where(Issuer.active.is_(True))
        return [issuer_view(session, item) for item in session.scalars(query)]


@router.post("/issuers", status_code=201)
def create_issuer(payload: IssuerInput, request: Request, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        with session.begin():
            name = clean(payload.name, 150)
            normalized = key(name)
            if session.scalar(select(IssuerAlias.id).where(IssuerAlias.normalized_name == normalized)):
                raise HTTPException(409, detail={"code": "DUPLICATE_ISSUER", "message": "La entidad ya figura en el catálogo o sus alias."})
            item = Issuer(name=name, website_url=str(payload.website_url) if payload.website_url else None, active=payload.active)
            session.add(item)
            session.flush()
            session.add(IssuerAlias(issuer_id=item.id, name=name, normalized_name=normalized))
            result = issuer_view(session, item)
            record(session, actor, "CATALOG_CREATE", "ISSUER", item.id, None, {"name": name, "active": item.active})
        return result


@router.put("/issuers/{identifier}")
def update_issuer(identifier: UUID, payload: IssuerInput, request: Request, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        with session.begin():
            item = session.get(Issuer, identifier)
            if item is None:
                raise HTTPException(404, detail="Entidad no disponible")
            before = {"name": item.name, "active": item.active}
            name = clean(payload.name, 150)
            normalized = key(name)
            existing = session.scalar(select(IssuerAlias).where(IssuerAlias.normalized_name == normalized))
            if existing is not None and existing.issuer_id != identifier:
                raise HTTPException(409, detail="El nombre pertenece a otra entidad")
            if existing is None:
                session.add(IssuerAlias(issuer_id=identifier, name=name, normalized_name=normalized))
            item.name = name
            item.website_url = str(payload.website_url) if payload.website_url else None
            item.active = payload.active
            session.flush()
            record(session, actor, "CATALOG_UPDATE", "ISSUER", item.id, before, {"name": item.name, "active": item.active})
            return issuer_view(session, item)


@router.post("/issuers/{identifier}/aliases", status_code=201)
def add_alias(identifier: UUID, payload: SkillInput, request: Request, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        with session.begin():
            item = session.get(Issuer, identifier)
            if item is None:
                raise HTTPException(404, detail="Entidad no disponible")
            name = clean(payload.name, 150)
            normalized = key(name)
            if session.scalar(select(IssuerAlias.id).where(IssuerAlias.normalized_name == normalized)):
                raise HTTPException(409, detail="El alias ya existe")
            session.add(IssuerAlias(issuer_id=item.id, name=name, normalized_name=normalized))
            session.flush()
            record(session, actor, "CATALOG_ALIAS", "ISSUER", item.id, None, {"alias": name})
            return issuer_view(session, item)


@router.get("/skills")
def skills(request: Request, actor: AuthenticatedUser = Depends(reader)):
    with factory(request)() as session:
        query = select(Skill).order_by(Skill.name)
        if actor.role != Role.ADMIN:
            query = query.where(Skill.active.is_(True))
        return [{"id": item.id, "name": item.name, "category": item.category, "active": item.active} for item in session.scalars(query)]


@router.post("/skills", status_code=201)
def create_skill(payload: SkillInput, request: Request, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        with session.begin():
            name = clean(payload.name, 150)
            if any(key(item.name) == key(name) for item in session.scalars(select(Skill))):
                raise HTTPException(409, detail="La habilidad ya existe")
            item = Skill(name=name, category=payload.category, active=payload.active)
            session.add(item)
            session.flush()
            record(session, actor, "CATALOG_CREATE", "SKILL", item.id, None, {"name": name})
            return {"id": item.id, "name": item.name, "category": item.category, "active": item.active}


@router.put("/skills/{identifier}")
def update_skill(identifier: UUID, payload: SkillInput, request: Request, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        with session.begin():
            item = session.get(Skill, identifier)
            if item is None:
                raise HTTPException(404, detail="Habilidad no disponible")
            before = {"name": item.name, "active": item.active}
            name = clean(payload.name, 150)
            if any(other.id != item.id and key(other.name) == key(name) for other in session.scalars(select(Skill))):
                raise HTTPException(409, detail="La habilidad ya existe")
            item.name = name
            item.category = payload.category
            item.active = payload.active
            record(session, actor, "CATALOG_UPDATE", "SKILL", item.id, before, {"name": item.name, "active": item.active})
            return {"id": item.id, "name": item.name, "category": item.category, "active": item.active}


@router.get("/credentials")
def credentials(request: Request, issuer_id: UUID | None = None, actor: AuthenticatedUser = Depends(reader)):
    with factory(request)() as session:
        query = select(CredentialCatalog).order_by(CredentialCatalog.name)
        if issuer_id is not None:
            query = query.where(CredentialCatalog.issuer_id == issuer_id)
        if actor.role != Role.ADMIN:
            query = query.where(CredentialCatalog.active.is_(True))
        return [credential_view(session, item) for item in session.scalars(query)]


@router.post("/credentials", status_code=201)
def create_credential(payload: CredentialInput, request: Request, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        with session.begin():
            issuer = session.get(Issuer, payload.issuer_id)
            if issuer is None:
                raise HTTPException(422, detail="Selecciona una entidad registrada")
            name = clean(payload.name)
            normalized = key(name)
            if session.scalar(select(CredentialCatalog.id).where(CredentialCatalog.issuer_id == issuer.id, CredentialCatalog.normalized_name == normalized)):
                raise HTTPException(409, detail="La certificación ya existe para esta entidad")
            ids = set(payload.skill_ids)
            if ids and set(session.scalars(select(Skill.id).where(Skill.id.in_(ids), Skill.active.is_(True)))) != ids:
                raise HTTPException(422, detail="Selecciona habilidades activas")
            item = CredentialCatalog(issuer_id=issuer.id, name=name, normalized_name=normalized, active=payload.active)
            session.add(item)
            session.flush()
            session.add_all(CredentialCatalogSkill(credential_id=item.id, skill_id=skill_id) for skill_id in ids)
            session.flush()
            record(session, actor, "CATALOG_CREATE", "CREDENTIAL", item.id, None, {"name": name, "issuer_id": str(issuer.id), "skill_ids": [str(value) for value in ids]})
            return credential_view(session, item)


@router.put("/credentials/{identifier}")
def update_credential(identifier: UUID, payload: CredentialInput, request: Request, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        with session.begin():
            item = session.get(CredentialCatalog, identifier)
            if item is None:
                raise HTTPException(404, detail="Certificación no disponible")
            before = {"name": item.name, "active": item.active}
            if item.issuer_id != payload.issuer_id:
                raise HTTPException(422, detail="La entidad de una certificación existente no puede cambiarse")
            name = clean(payload.name)
            normalized = key(name)
            duplicate = session.scalar(select(CredentialCatalog.id).where(CredentialCatalog.issuer_id == item.issuer_id, CredentialCatalog.normalized_name == normalized, CredentialCatalog.id != item.id))
            if duplicate:
                raise HTTPException(409, detail="La certificación ya existe")
            ids = set(payload.skill_ids)
            if ids and set(session.scalars(select(Skill.id).where(Skill.id.in_(ids), Skill.active.is_(True)))) != ids:
                raise HTTPException(422, detail="Selecciona habilidades activas")
            item.name = name
            item.normalized_name = normalized
            item.active = payload.active
            session.query(CredentialCatalogSkill).filter(CredentialCatalogSkill.credential_id == item.id).delete()
            session.add_all(CredentialCatalogSkill(credential_id=item.id, skill_id=skill_id) for skill_id in ids)
            session.flush()
            record(session, actor, "CATALOG_UPDATE", "CREDENTIAL", item.id, before, {"name": item.name, "active": item.active, "skill_ids": [str(value) for value in ids]})
            return credential_view(session, item)


@router.post("/proposals", status_code=201)
def propose(payload: ProposalInput, request: Request, actor: AuthenticatedUser = Depends(student)):
    if payload.kind not in {"ISSUER", "CREDENTIAL", "SKILL"}:
        raise HTTPException(422, detail="Tipo de solicitud no disponible")
    if payload.kind == "CREDENTIAL" and payload.issuer_id is None:
        raise HTTPException(422, detail="Selecciona primero la entidad emisora")
    if actor.student_id is None:
        raise HTTPException(403, detail="Estudiante no vinculado al padrón")
    with factory(request)() as session:
        with session.begin():
            item = CatalogProposal(student_id=actor.student_id, kind=payload.kind, proposed_name=clean(payload.proposed_name), issuer_id=payload.issuer_id)
            session.add(item)
            session.flush()
            record(session, actor, "CATALOG_PROPOSE", "CATALOG_PROPOSAL", item.id, None, {"kind": item.kind, "name": item.proposed_name})
            return {"id": item.id, "kind": item.kind, "status": item.status, "proposed_name": item.proposed_name}


@router.get("/proposals")
def proposals(request: Request, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        return [{"id": item.id, "kind": item.kind, "proposed_name": item.proposed_name, "issuer_id": item.issuer_id, "student_id": item.student_id, "status": item.status, "resolved_id": item.resolved_id, "reason": item.reason, "created_at": item.created_at} for item in session.scalars(select(CatalogProposal).order_by(CatalogProposal.created_at.desc()))]


@router.post("/proposals/{identifier}/resolve")
def resolve(identifier: UUID, payload: ResolutionInput, request: Request, actor: AuthenticatedUser = Depends(admin)):
    target_models = {"ISSUER": Issuer, "CREDENTIAL": CredentialCatalog, "SKILL": Skill}
    with factory(request)() as session:
        with session.begin():
            proposal = session.get(CatalogProposal, identifier)
            if proposal is None or proposal.status != "PENDING":
                raise HTTPException(404, detail="Solicitud pendiente no disponible")
            target = session.get(target_models[proposal.kind], payload.target_id)
            if target is None or not target.active:
                raise HTTPException(422, detail="Selecciona una opción activa del catálogo")
            if proposal.kind == "CREDENTIAL" and target.issuer_id != proposal.issuer_id:
                raise HTTPException(422, detail="La certificación debe pertenecer a la entidad solicitada")
            if proposal.kind == "ISSUER":
                normalized = key(proposal.proposed_name)
                alias = session.scalar(select(IssuerAlias).where(IssuerAlias.normalized_name == normalized))
                if alias is not None and alias.issuer_id != target.id:
                    raise HTTPException(409, detail="Este nombre ya pertenece a otra entidad; revisa el catálogo")
                if alias is None:
                    session.add(IssuerAlias(issuer_id=target.id, name=proposal.proposed_name, normalized_name=normalized))
            proposal.status = "RESOLVED"
            proposal.resolved_id = target.id
            proposal.reviewer_id = actor.id
            proposal.reason = clean(payload.reason, 2000)
            proposal.resolved_at = datetime.now(timezone.utc)
            record(session, actor, "CATALOG_RESOLVE", "CATALOG_PROPOSAL", proposal.id, {"status": "PENDING"}, {"status": "RESOLVED", "target_id": str(target.id), "reason": proposal.reason})
            return {"id": proposal.id, "status": proposal.status, "resolved_id": proposal.resolved_id}


@router.post("/proposals/{identifier}/reject")
def reject(identifier: UUID, payload: RejectionInput, request: Request, actor: AuthenticatedUser = Depends(admin)):
    with factory(request)() as session:
        with session.begin():
            proposal = session.get(CatalogProposal, identifier)
            if proposal is None or proposal.status != "PENDING":
                raise HTTPException(404, detail="Solicitud pendiente no disponible")
            proposal.status = "REJECTED"
            proposal.reviewer_id = actor.id
            proposal.reason = clean(payload.reason, 2000)
            proposal.resolved_at = datetime.now(timezone.utc)
            record(session, actor, "CATALOG_REJECT", "CATALOG_PROPOSAL", proposal.id, {"status": "PENDING"}, {"status": "REJECTED", "reason": proposal.reason})
            return {"id": proposal.id, "status": proposal.status, "reason": proposal.reason}


def draft_view(session, item: CertificationSubmissionDraft) -> dict:
    proposals = list(session.scalars(select(CatalogProposal).where(CatalogProposal.id.in_([UUID(value) for value in item.proposal_ids])))) if item.proposal_ids else []
    return {
        "id": item.id,
        "form_data": item.form_data,
        "proposals": [{"id": p.id, "kind": p.kind, "name": p.proposed_name, "status": p.status, "resolved_id": p.resolved_id, "reason": p.reason} for p in proposals],
        "evidence_filename": item.evidence_filename,
        "submitted_certification_id": item.submitted_certification_id,
        "created_at": item.created_at,
    }


@router.get("/drafts")
def drafts(request: Request, actor: AuthenticatedUser = Depends(student)):
    with factory(request)() as session:
        return [draft_view(session, item) for item in session.scalars(select(CertificationSubmissionDraft).where(CertificationSubmissionDraft.student_id == actor.student_id).order_by(CertificationSubmissionDraft.created_at.desc()))]


@router.post("/drafts", status_code=201)
def create_draft(payload: DraftInput, request: Request, actor: AuthenticatedUser = Depends(student)):
    if actor.student_id is None:
        raise HTTPException(403, detail="Estudiante no vinculado al padrón")
    if payload.expires_on is not None and payload.expires_on < payload.issued_on:
        raise HTTPException(422, detail="El vencimiento no puede preceder a la emisión")
    with factory(request)() as session:
        with session.begin():
            ids = list(dict.fromkeys(payload.proposal_ids))
            proposals = list(session.scalars(select(CatalogProposal).where(CatalogProposal.id.in_(ids), CatalogProposal.student_id == actor.student_id))) if ids else []
            if len(ids) != len(proposals):
                raise HTTPException(422, detail="Selecciona solicitudes propias")
            item = CertificationSubmissionDraft(
                student_id=actor.student_id,
                form_data=payload.model_dump(mode="json", exclude={"proposal_ids"}),
                proposal_ids=[str(value) for value in ids],
            )
            session.add(item)
            session.flush()
            return draft_view(session, item)


@router.post("/drafts/{identifier}/evidence")
def upload_draft_evidence(identifier: UUID, request: Request, file: UploadFile = File(...), actor: AuthenticatedUser = Depends(student)):
    service = request.app.state.certification_service
    content = file.file.read(request.app.state.settings.evidence_max_bytes + 1)
    try:
        filename, content_type, extension = service._file_metadata(filename=file.filename or "", content_type=file.content_type or "", content=content)
    except EvidenceFileTooLarge as exc:
        raise HTTPException(413, detail="El archivo supera el tamaño permitido") from exc
    except CertificationInvalid as exc:
        raise HTTPException(422, detail=str(exc)) from exc
    storage = LocalEvidenceStorage(request.app.state.settings.evidence_storage_path)
    object_key = f"draft-{uuid4().hex}{extension}"
    saved = False
    try:
        with factory(request)() as session:
            with session.begin():
                item = session.scalar(select(CertificationSubmissionDraft).where(CertificationSubmissionDraft.id == identifier, CertificationSubmissionDraft.student_id == actor.student_id))
                if item is None or item.submitted_certification_id is not None:
                    raise HTTPException(404, detail="Borrador disponible no encontrado")
                old_key = item.evidence_object_key
                storage.save(object_key, content)
                saved = True
                item.evidence_object_key = object_key
                item.evidence_filename = filename
                item.evidence_content_type = content_type
                item.evidence_sha256 = hashlib.sha256(content).hexdigest()
                item.evidence_size = len(content)
                result = draft_view(session, item)
    except Exception:
        if saved:
            storage.delete(object_key)
        raise
    if old_key:
        storage.delete(old_key)
    return result


@router.post("/drafts/{identifier}/submit")
def submit_draft(identifier: UUID, payload: DraftSubmitInput, request: Request, actor: AuthenticatedUser = Depends(student)):
    with factory(request)() as session:
        item = session.scalar(select(CertificationSubmissionDraft).where(CertificationSubmissionDraft.id == identifier, CertificationSubmissionDraft.student_id == actor.student_id))
        if item is None:
            raise HTTPException(404, detail="Borrador no encontrado")
        already_submitted = item.submitted_certification_id
        proposals = list(session.scalars(select(CatalogProposal).where(CatalogProposal.id.in_([UUID(value) for value in item.proposal_ids])))) if item.proposal_ids else []
        if any(proposal.status != "RESOLVED" for proposal in proposals):
            raise HTTPException(409, detail="Administración aún revisa las opciones solicitadas")
        for proposal in proposals:
            if proposal.kind == "ISSUER" and proposal.resolved_id != payload.issuer_id:
                raise HTTPException(422, detail="Selecciona la entidad resuelta por administración")
            if proposal.kind == "CREDENTIAL" and proposal.resolved_id != payload.catalog_credential_id:
                raise HTTPException(422, detail="Selecciona la certificación resuelta por administración")
            if proposal.kind == "SKILL" and proposal.resolved_id not in payload.skill_ids:
                raise HTTPException(422, detail="Incluye la habilidad resuelta por administración")
        form = item.form_data
        file_key, filename, content_type = item.evidence_object_key, item.evidence_filename, item.evidence_content_type
    from ...certifications.schemas import CertificationCreateRequest
    from .certifications import create_certification
    if already_submitted:
        created_id = already_submitted
    else:
        from ...certifications.service import CertificationDuplicate
        try:
            created = create_certification(CertificationCreateRequest(
                issuer_id=payload.issuer_id,
                catalog_credential_id=payload.catalog_credential_id,
                skill_ids=payload.skill_ids,
                issued_on=date.fromisoformat(form["issued_on"]),
                expires_on=date.fromisoformat(form["expires_on"]) if form.get("expires_on") else None,
                source_url=form.get("source_url"),
            ), request, actor)
        except CertificationDuplicate:
            raise HTTPException(409, detail="Ya existe una certificación equivalente; revisa tu historial antes de reintentar")
        created_id = created.id
        with factory(request)() as session:
            with session.begin():
                saved = session.get(CertificationSubmissionDraft, identifier)
                saved.submitted_certification_id = created_id
    service = request.app.state.certification_service
    try:
        if file_key and filename and content_type:
            content = LocalEvidenceStorage(request.app.state.settings.evidence_storage_path).path_for(file_key).read_bytes()
            service.add_file_evidence(actor.id, created_id, filename=filename, content_type=content_type, content=content)
        elif form.get("source_url"):
            service.add_url_evidence(actor.id, created_id, form["source_url"])
    except EvidenceDuplicate:
        pass
    return {"certification_id": created_id, "status": "SUBMITTED"}
