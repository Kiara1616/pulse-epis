"""Explicit role-scoped learning API with atomic publication and capacity decisions."""
from contextlib import contextmanager
from datetime import date, datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, delete, func
from sqlalchemy.exc import IntegrityError
from ...auth.dependencies import require_roles
from ...auth.models import AuthenticatedUser, Role
from ...db.models import Student
from ...learning.models import LearningInterest as Interest, LearningRoute as Route, LearningStep as Step, StudentLearningProfile as Profile, StudentLearningInterest as StudentInterest, LearningCourse as Course, LearningOpportunity as Offer, LearningOfferInterest as OfferInterest, LearningWorkshop as Workshop, LearningApplication as Application, LearningAudit as Audit
from ...learning.schemas import InterestOutput, RouteOutput, CourseOutput, OfferOutput, WorkshopOutput, ApplicationOutput, AuditOutput
from ...learning.schemas import InterestInput, RouteInput, CourseInput, OfferInput, WorkshopInput, PreferenceInput, Decision, ApplyInput
router = APIRouter(prefix='/learning', tags=['learning'])
admin = require_roles(Role.ADMIN)
student = require_roles(Role.STUDENT)
reader = require_roles(Role.ADMIN, Role.STUDENT)
MODELS = {'routes': Route, 'courses': Course, 'offers': Offer, 'workshops': Workshop}

def fail(code, status, message):
    raise HTTPException(status, detail={'code': code, 'message': message})

@contextmanager
def transaction(request):
    factory = request.app.state.session_factory
    if factory is None:
        fail('LEARNING_UNAVAILABLE', 503, 'Base de datos no disponible')
    with factory() as session:
        try:
            with session.begin():
                yield session
        except IntegrityError as exc:
            raise HTTPException(409, detail={'code': 'LEARNING_CONFLICT', 'message': 'Registro duplicado o referencia en conflicto'}) from exc

def primitive(value):
    if isinstance(value, (UUID, date, datetime)):
        return str(value) if isinstance(value, UUID) else value.isoformat()
    return value

def serialize(session, item):
    data = {c.name: primitive(getattr(item, c.name)) for c in item.__table__.columns}
    if isinstance(item, Route):
        data['steps'] = [serialize(session, s) for s in session.scalars(select(Step).where(Step.route_id == item.id).order_by(Step.position))]
    if isinstance(item, Workshop):
        occupied=session.scalar(select(func.count()).select_from(Application).where(Application.workshop_id==item.id, Application.status.in_(['ACCEPTED','COMPLETED'])))
        data['occupied_places']=occupied
        data['available_places']=max(0,item.capacity-occupied)
    if isinstance(item, Profile):
        data['interest_ids'] = [str(v) for v in session.scalars(select(StudentInterest.interest_id).where(StudentInterest.student_id == item.student_id).order_by(StudentInterest.interest_id))]
    if isinstance(item, Offer):
        data['interest_ids'] = [str(v) for v in session.scalars(select(OfferInterest.interest_id).where(OfferInterest.offer_id == item.id).order_by(OfferInterest.interest_id))]
    return data

def get(session, model, identifier, lock=False):
    stmt = select(model).where(model.id == identifier)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    item = session.scalar(stmt)
    if item is None:
        fail('LEARNING_NOT_FOUND', 404, 'Registro no disponible')
    return item

def audit(session, actor, item, action, reason, before=None):
    session.flush()
    sequence = (session.scalar(select(func.max(Audit.sequence)).where(Audit.entity_type == item.__tablename__, Audit.entity_id == item.id)) or 0) + 1
    session.add(Audit(sequence=sequence, actor_id=actor.id, entity_type=item.__tablename__, entity_id=item.id, action=action, before=before, after=serialize(session, item), reason=reason))

def own_student(session, actor, lock=False):
    if actor.student_id is None:
        fail('STUDENT_NOT_PROVISIONED', 403, 'Perfil estudiantil no provisionado')
    stmt = select(Student).where(Student.id == actor.student_id, Student.user_id == actor.id)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    item = session.scalar(stmt)
    if item is None:
        fail('STUDENT_NOT_PROVISIONED', 403, 'Perfil estudiantil no provisionado')
    return item

def active_interests(session, ids):
    ids = list(dict.fromkeys(ids))
    found = set(session.scalars(select(Interest.id).where(Interest.id.in_(ids), Interest.active.is_(True))))
    if found != set(ids):
        fail('INVALID_INTEREST', 422, 'Interés inexistente o inactivo')
    return ids

def set_offer_interests(session, offer, ids):
    session.execute(delete(OfferInterest).where(OfferInterest.offer_id == offer.id))
    session.add_all((OfferInterest(offer_id=offer.id, interest_id=value) for value in ids))
    session.flush()

def available_offer(session, item):
    item = get(session, Offer, item.id, True)
    course = get(session, Course, item.course_id, True)
    if item.status != 'PUBLISHED' or course.status != 'PUBLISHED':
        fail('OFFER_UNAVAILABLE', 409, 'La oportunidad no está publicada')

def route_steps(session, item, steps):
    session.execute(delete(Step).where(Step.route_id == item.id))
    session.add_all((Step(route_id=item.id, position=n + 1, **step) for n, step in enumerate(steps)))
    session.flush()

@router.get('/interests', response_model=list[InterestOutput])
def interests(request: Request, actor: AuthenticatedUser=Depends(reader)):
    with transaction(request) as s:
        stmt = select(Interest).order_by(Interest.name)
        if actor.role == Role.STUDENT:
            stmt = stmt.where(Interest.active.is_(True))
        return [serialize(s, i) for i in s.scalars(stmt)]

@router.post('/interests', status_code=201, response_model=InterestOutput)
def create_interest(request: Request, payload: InterestInput, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        item = Interest(**payload.model_dump())
        s.add(item)
        audit(s, actor, item, 'CREATE', 'Alta de interés')
        return serialize(s, item)

@router.put('/interests/{identifier}', response_model=InterestOutput)
def edit_interest(identifier: UUID, request: Request, payload: InterestInput, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        item = get(s, Interest, identifier, True)
        before = serialize(s, item)
        for k, v in payload.model_dump().items():
            setattr(item, k, v)
        audit(s, actor, item, 'UPDATE', 'Corrección de interés', before)
        return serialize(s, item)

@router.get('/{kind}', response_model=list[RouteOutput | CourseOutput | OfferOutput | WorkshopOutput])
def catalog(kind: str, request: Request, actor: AuthenticatedUser=Depends(reader)):
    model = MODELS.get(kind)
    if model is None:
        fail('LEARNING_NOT_FOUND', 404, 'Catálogo no disponible')
    with transaction(request) as s:
        stmt = select(model).order_by(model.created_at, model.id)
        if actor.role == Role.STUDENT:
            if model is Workshop:
                stmt = stmt.join(Offer, Offer.id == Workshop.offer_id).join(Course, Course.id == Offer.course_id).where(Workshop.status == 'OPEN', Offer.status == 'PUBLISHED', Course.status == 'PUBLISHED')
            elif model is Offer:
                stmt = stmt.join(Course, Course.id == Offer.course_id).where(Offer.status == 'PUBLISHED', Course.status == 'PUBLISHED')
            else:
                stmt = stmt.where(model.status == 'PUBLISHED')
        return [serialize(s, i) for i in s.scalars(stmt)]

@router.post('/routes', status_code=201, response_model=RouteOutput)
def create_route(request: Request, payload: RouteInput, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        values = payload.model_dump()
        steps = values.pop('steps')
        item = Route(**values)
        s.add(item)
        s.flush()
        route_steps(s, item, steps)
        audit(s, actor, item, 'CREATE', 'Alta de ruta')
        return serialize(s, item)

@router.put('/routes/{identifier}', response_model=RouteOutput)
def edit_route(identifier: UUID, request: Request, payload: RouteInput, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        item = get(s, Route, identifier, True)
        if item.status != 'DRAFT':
            fail('INVALID_STATE', 409, 'Solo se modifica una ruta en borrador')
        before = serialize(s, item)
        values = payload.model_dump()
        steps = values.pop('steps')
        for k, v in values.items():
            setattr(item, k, v)
        route_steps(s, item, steps)
        audit(s, actor, item, 'UPDATE', 'Corrección de ruta', before)
        return serialize(s, item)

@router.post('/courses', status_code=201, response_model=CourseOutput)
def create_course(request: Request, payload: CourseInput, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        values = payload.model_dump()
        values['source_url'] = str(payload.source_url)
        item = Course(**values)
        s.add(item)
        audit(s, actor, item, 'CREATE', 'Alta manual de fuente')
        return serialize(s, item)

@router.put('/courses/{identifier}', response_model=CourseOutput)
def edit_course(identifier: UUID, request: Request, payload: CourseInput, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        item = get(s, Course, identifier, True)
        if item.status not in {'DETECTED', 'IN_REVIEW'}:
            fail('INVALID_STATE', 409, 'El curso no admite corrección')
        before = serialize(s, item)
        values = payload.model_dump()
        values['source_url'] = str(payload.source_url)
        for k, v in values.items():
            setattr(item, k, v)
        audit(s, actor, item, 'UPDATE', 'Corrección de fuente', before)
        return serialize(s, item)

@router.post('/offers', status_code=201, response_model=OfferOutput)
def create_offer(request: Request, payload: OfferInput, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        course = get(s, Course, payload.course_id, True)
        if course.status != 'IN_REVIEW':
            fail('INVALID_STATE', 409, 'Revisa el curso antes de crear la oportunidad')
        ids = active_interests(s, payload.interest_ids)
        values = payload.model_dump(exclude={'interest_ids'})
        values['cycles'] = list(dict.fromkeys(values['cycles']))
        item = Offer(**values)
        s.add(item)
        s.flush()
        set_offer_interests(s, item, ids)
        audit(s, actor, item, 'CREATE', 'Alta de oportunidad en borrador')
        return serialize(s, item)

@router.put('/offers/{identifier}', response_model=OfferOutput)
def edit_offer(identifier: UUID, request: Request, payload: OfferInput, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        item = get(s, Offer, identifier, True)
        if item.status != 'DRAFT' or item.course_id != payload.course_id:
            fail('INVALID_STATE', 409, 'Solo se corrige el borrador sin cambiar su curso')
        before = serialize(s, item)
        ids = active_interests(s, payload.interest_ids)
        item.title = payload.title
        item.cycles = list(dict.fromkeys(payload.cycles))
        item.relevance = payload.relevance
        set_offer_interests(s, item, ids)
        audit(s, actor, item, 'UPDATE', 'Corrección de oportunidad', before)
        return serialize(s, item)

@router.post('/workshops', status_code=201, response_model=WorkshopOutput)
def create_workshop(request: Request, payload: WorkshopInput, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        available_offer(s, get(s, Offer, payload.offer_id))
        item = Workshop(**payload.model_dump())
        s.add(item)
        audit(s, actor, item, 'CREATE', 'Alta de taller')
        return serialize(s, item)

@router.put('/workshops/{identifier}', response_model=WorkshopOutput)
def edit_workshop(identifier: UUID, request: Request, payload: WorkshopInput, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        item = get(s, Workshop, identifier, True)
        if item.status != 'DRAFT' or item.offer_id != payload.offer_id:
            fail('INVALID_STATE', 409, 'Solo se corrige el taller en borrador sin cambiar su oportunidad')
        before = serialize(s, item)
        item.title = payload.title
        item.capacity = payload.capacity
        item.requirements = payload.requirements
        audit(s, actor, item, 'UPDATE', 'Corrección de taller', before)
        return serialize(s, item)

@router.post('/{kind}/{identifier}/status', response_model=RouteOutput | CourseOutput | OfferOutput | WorkshopOutput)
def transition(kind: str, identifier: UUID, request: Request, payload: Decision, actor: AuthenticatedUser=Depends(admin)):
    model = MODELS.get(kind)
    if model is None:
        fail('LEARNING_NOT_FOUND', 404, 'Catálogo no disponible')
    with transaction(request) as s:
        item = get(s, model, identifier, True)
        before = serialize(s, item)
        maps = {Route: {'DRAFT': {'PUBLISHED', 'RETIRED'}, 'PUBLISHED': {'RETIRED'}}, Course: {'DETECTED': {'IN_REVIEW', 'DISCARDED'}, 'IN_REVIEW': {'DISCARDED'}}, Offer: {'DRAFT': {'PUBLISHED', 'RETIRED'}, 'PUBLISHED': {'RETIRED'}}, Workshop: {'DRAFT': {'OPEN'}, 'OPEN': {'CLOSED'}, 'CLOSED': {'COMPLETED'}}}
        if payload.status not in maps[model].get(item.status, set()):
            fail('INVALID_STATE', 409, 'Transición no permitida')
        if model is Offer:
            course = get(s, Course, item.course_id, True)
            if payload.status == 'PUBLISHED':
                ids = list(s.scalars(select(OfferInterest.interest_id).where(OfferInterest.offer_id == item.id)))
                active_interests(s, ids)
                if course.status != 'IN_REVIEW' or (not ids and (not item.cycles)) or len(item.relevance) < 10:
                    fail('PUBLICATION_INCOMPLETE', 422, 'Revisa contenido, audiencia y relevancia antes de publicar')
            course_before = serialize(s, course)
            course.status = 'PUBLISHED' if payload.status == 'PUBLISHED' else 'RETIRED'
            audit(s, actor, course, 'STATUS', payload.reason, course_before)
        if model is Workshop and payload.status == 'OPEN':
            available_offer(s, get(s, Offer, item.offer_id))
        if model is Route and payload.status == 'PUBLISHED' and (not s.scalar(select(Step.id).where(Step.route_id == item.id))):
            fail('PUBLICATION_INCOMPLETE', 422, 'La ruta requiere pasos')
        item.status = payload.status
        audit(s, actor, item, 'STATUS', payload.reason, before)
        return serialize(s, item)

@router.get('/me/profile', response_model=PreferenceInput)
def get_preferences(request: Request, actor: AuthenticatedUser=Depends(student)):
    with transaction(request) as s:
        own = own_student(s, actor)
        item = s.scalar(select(Profile).where(Profile.student_id == own.id))
        ids = s.scalars(select(StudentInterest.interest_id).where(StudentInterest.student_id == own.id)).all()
        return {'route_id': str(item.route_id) if item and item.route_id else None, 'interest_ids': [str(i) for i in ids]}

@router.put('/me/profile', response_model=PreferenceInput)
def preferences(request: Request, payload: PreferenceInput, actor: AuthenticatedUser=Depends(student)):
    with transaction(request) as s:
        own = own_student(s, actor, True)
        ids = active_interests(s, payload.interest_ids)
        if payload.route_id and get(s, Route, payload.route_id).status != 'PUBLISHED':
            fail('ROUTE_UNAVAILABLE', 422, 'Ruta no publicada')
        item = s.scalar(select(Profile).where(Profile.student_id == own.id))
        before = serialize(s, item) if item else None
        if item is None:
            item = Profile(student_id=own.id)
            s.add(item)
        item.route_id = payload.route_id
        s.execute(delete(StudentInterest).where(StudentInterest.student_id == own.id))
        s.add_all((StudentInterest(student_id=own.id, interest_id=i) for i in ids))
        audit(s, actor, item, 'PREFERENCES', 'Actualización de preferencias propias', before)
        return {'route_id': str(item.route_id) if item.route_id else None, 'interest_ids': [str(i) for i in ids]}

@router.get('/me/applications', response_model=list[ApplicationOutput])
def my_applications(request: Request, actor: AuthenticatedUser=Depends(student)):
    with transaction(request) as s:
        own = own_student(s, actor)
        return [serialize(s, i) for i in s.scalars(select(Application).where(Application.student_id == own.id).order_by(Application.created_at, Application.id))]

@router.get('/me/applications/{identifier}', response_model=ApplicationOutput)
def my_application(identifier: UUID, request: Request, actor: AuthenticatedUser=Depends(student)):
    with transaction(request) as s:
        own = own_student(s, actor)
        item = s.scalar(select(Application).where(Application.id == identifier, Application.student_id == own.id))
        if item is None:
            fail('LEARNING_NOT_FOUND', 404, 'Solicitud no disponible')
        return serialize(s, item)

@router.post('/me/applications', status_code=201, response_model=ApplicationOutput)
def apply(request: Request, payload: ApplyInput, actor: AuthenticatedUser=Depends(student)):
    with transaction(request) as s:
        own = own_student(s, actor)
        workshop = get(s, Workshop, payload.workshop_id, True)
        if workshop.status != 'OPEN':
            fail('WORKSHOP_UNAVAILABLE', 409, 'Taller no abierto')
        available_offer(s, get(s, Offer, workshop.offer_id))
        item = Application(student_id=own.id, workshop_id=workshop.id)
        s.add(item)
        audit(s, actor, item, 'SUBMIT', 'Requisitos leídos; solicitud sujeta a revisión')
        return serialize(s, item)

@router.get('/admin/applications', response_model=list[ApplicationOutput])
def applications(request: Request, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        return [serialize(s, i) for i in s.scalars(select(Application).order_by(Application.created_at, Application.id))]

@router.post('/admin/applications/{identifier}/status', response_model=ApplicationOutput)
def decide_application(identifier: UUID, request: Request, payload: Decision, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        initial = get(s, Application, identifier)
        workshop = get(s, Workshop, initial.workshop_id, True)
        item = get(s, Application, identifier, True)
        if payload.status not in {'SUBMITTED': {'ACCEPTED', 'REJECTED'}, 'ACCEPTED': {'COMPLETED'}}.get(item.status, set()):
            fail('INVALID_STATE', 409, 'Transición de solicitud no permitida')
        if payload.status == 'ACCEPTED':
            if workshop.status != 'OPEN':
                fail('WORKSHOP_UNAVAILABLE', 409, 'El taller no está abierto')
            available_offer(s, get(s, Offer, workshop.offer_id))
            occupied = s.scalar(select(func.count()).select_from(Application).where(Application.workshop_id == workshop.id, Application.status.in_(['ACCEPTED', 'COMPLETED'])))
            if occupied >= workshop.capacity:
                fail('CAPACITY_FULL', 409, 'No quedan cupos')
        before = serialize(s, item)
        item.status = payload.status
        item.comment = payload.reason
        audit(s, actor, item, 'STATUS', payload.reason, before)
        return serialize(s, item)

@router.get('/admin/audit', response_model=list[AuditOutput])
def history(request: Request, entity_id: UUID | None=None, actor: AuthenticatedUser=Depends(admin)):
    with transaction(request) as s:
        stmt = select(Audit)
        if entity_id is not None:
            stmt = stmt.where(Audit.entity_id == entity_id).order_by(Audit.sequence)
        else:
            stmt = stmt.order_by(Audit.created_at, Audit.entity_type, Audit.entity_id, Audit.sequence)
        return [serialize(s, i) for i in s.scalars(stmt)]
