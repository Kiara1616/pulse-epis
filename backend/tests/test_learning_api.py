from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import os
import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from backend.app.main import create_app
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import Student, User
from backend.app.auth.dependencies import get_current_user
from backend.app.auth.models import AuthenticatedUser, Role

@pytest.fixture
def context():
    pg = os.getenv('LEARNING_TEST_DATABASE_URL')
    schema = 'learning_test_' + uuid4().hex
    root = None
    if pg:
        root = create_engine(pg)
        with root.begin() as c:
            c.execute(text(f'CREATE SCHEMA {schema}'))
        engine = create_engine(pg, connect_args={'options': f'-csearch_path={schema}'})
    else:
        engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)

        @event.listens_for(engine, 'connect')
        def sqlite_fk(connection, _):
            connection.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    ids = {name: uuid4() for name in ['admin', 'validator', 'one', 'two']}
    students = {name: uuid4() for name in ['one', 'two']}
    actors = {name: AuthenticatedUser(id=ids[name], email=f'{name}@example.invalid', role=Role.ADMIN if name == 'admin' else Role.VALIDATOR if name == 'validator' else Role.STUDENT, student_id=students.get(name)) for name in ids}
    with factory.begin() as s:
        s.add_all((User(id=actor.id, email=actor.email, role=actor.role.value) for actor in actors.values()))
        s.flush()
        s.add_all((Student(id=students[name], user_id=ids[name], student_key=f'DEMO-{name}-{uuid4().hex}') for name in students))
    app = create_app(Settings(environment='test', log_level='WARNING', auth_session_secret='test-learning-only'))
    app.state.session_factory = factory

    def identity(request: Request):
        return actors[request.headers['x-test-actor']]
    app.dependency_overrides[get_current_user] = identity
    clients = {name: TestClient(app, headers={'x-test-actor': name}) for name in actors}
    yield (clients, app, factory, pg)
    for client in clients.values():
        client.close()
    engine.dispose()
    if root:
        with root.begin() as c:
            c.execute(text(f'DROP SCHEMA {schema} CASCADE'))
        root.dispose()

def post(client, path, data, expected=201):
    response = client.post('/api/v1/learning' + path, json=data)
    assert response.status_code == expected, response.text
    return response.json()

def publish(client, kind, item, status):
    return post(client, f"/{kind}/{item['id']}/status", {'status': status, 'reason': 'DecisiÃ³n sintÃ©tica revisada por el administrador.'}, 200)

def setup_offer(clients, capacity=1):
    admin = clients['admin']
    interest = post(admin, '/interests', {'name': 'IA sintÃ©tica'})
    route = post(admin, '/routes', {'title': 'Ruta IA sintÃ©tica', 'description': 'Ejemplo de ruta formativa sintÃ©tica', 'steps': [{'title': 'Fundamentos', 'skills': ['Python'], 'prerequisites': []}]})
    publish(admin, 'routes', route, 'PUBLISHED')
    course = post(admin, '/courses', {'title': 'Curso sintÃ©tico', 'provider': 'Proveedor de prueba', 'source_url': 'https://example.invalid/curso', 'checked_on': '2026-01-01', 'requirements': ['Python bÃ¡sico'], 'skills': ['IA']})
    publish(admin, 'courses', course, 'IN_REVIEW')
    offer = post(admin, '/offers', {'course_id': course['id'], 'title': 'Oferta sintÃ©tica', 'cycles': ['V'], 'interest_ids': [interest['id']], 'relevance': 'FormaciÃ³n de ejemplo para una ruta de IA.'})
    publish(admin, 'offers', offer, 'PUBLISHED')
    workshop = post(admin, '/workshops', {'offer_id': offer['id'], 'title': 'Taller sintÃ©tico', 'capacity': capacity, 'requirements': ['Python bÃ¡sico']})
    publish(admin, 'workshops', workshop, 'OPEN')
    return (interest, route, course, offer, workshop)

def test_publication_preferences_privacy_and_capacity(context):
    clients, app, _, _ = context
    a = clients['admin']
    one = clients['one']
    two = clients['two']
    interest, route, course, offer, workshop = setup_offer(clients)
    for who in ['one', 'two', 'validator']:
        assert clients[who].post('/api/v1/learning/courses', json={}).status_code == 403
        assert clients[who].get('/api/v1/learning/admin/audit').status_code == 403
    assert clients['validator'].get('/api/v1/learning/offers').status_code == 403
    assert one.put('/api/v1/learning/me/profile', json={'route_id': route['id'], 'interest_ids': [interest['id'], interest['id']]}).status_code == 200
    assert two.get('/api/v1/learning/me/profile').json() == {'route_id': None, 'interest_ids': []}
    assert one.put('/api/v1/learning/me/profile', json={'student_id': uuid4().hex, 'interest_ids': []}).status_code == 422
    assert one.get('/api/v1/learning/offers').json()[0]['interest_ids'] == [interest['id']]
    request = post(one, '/me/applications', {'workshop_id': workshop['id'], 'requirements_acknowledged': True})
    request2 = post(two, '/me/applications', {'workshop_id': workshop['id'], 'requirements_acknowledged': True})
    post(one, '/me/applications', {'workshop_id': workshop['id'], 'requirements_acknowledged': True}, 409)
    assert two.get('/api/v1/learning/me/applications/' + request['id']).status_code == 404
    path = '/admin/applications/' + request['id'] + '/status'
    post(a, path, {'status': 'ACCEPTED', 'reason': 'Requisitos revisados y cupo disponible.'}, 200)
    post(a, '/admin/applications/' + request2['id'] + '/status', {'status': 'ACCEPTED', 'reason': 'Requisitos revisados y cupo disponible.'}, 409)
    post(a, path, {'status': 'COMPLETED', 'reason': 'ParticipaciÃ³n finalizada segÃºn evidencia revisada.'}, 200)
    assert one.get('/api/v1/learning/me/applications').json()[0]['status'] == 'COMPLETED'
    publish(a, 'offers', offer, 'RETIRED')
    assert one.get('/api/v1/learning/offers').json() == []
    assert one.get('/api/v1/learning/workshops').json() == []
    assert any((row['action'] == 'PREFERENCES' and row['after']['interest_ids'] == [interest['id']] for row in a.get('/api/v1/learning/admin/audit').json()))

def test_review_and_audience_are_required_and_drafts_hidden(context):
    clients, _, _, _ = context
    a = clients['admin']
    one = clients['one']
    course = post(a, '/courses', {'title': 'Curso sintÃ©tico', 'provider': 'Proveedor', 'source_url': 'https://example.invalid/curso', 'checked_on': '2026-01-01', 'skills': ['IA']})
    post(a, '/offers', {'course_id': course['id'], 'title': 'Oferta'}, 409)
    assert one.get('/api/v1/learning/courses').json() == []
    publish(a, 'courses', course, 'IN_REVIEW')
    offer = post(a, '/offers', {'course_id': course['id'], 'title': 'Oferta'})
    post(a, '/offers/' + offer['id'] + '/status', {'status': 'PUBLISHED', 'reason': 'Contenido revisado manualmente.'}, 422)
    assert one.get('/api/v1/learning/offers').json() == []
    response = a.put('/api/v1/learning/offers/' + offer['id'], json={'course_id': course['id'], 'title': 'Oferta corregida', 'cycles': ['VI'], 'relevance': 'JustificaciÃ³n de relevancia revisada.'})
    assert response.status_code == 200
    publish(a, 'offers', offer, 'PUBLISHED')
    assert a.put('/api/v1/learning/courses/' + course['id'], json={'title': 'Cambio', 'provider': 'Proveedor', 'source_url': 'https://example.invalid/cambio', 'checked_on': '2026-01-01', 'skills': ['IA']}).status_code == 409
    assert one.get('/api/v1/learning/offers').json()[0]['title'] == 'Oferta corregida'

@pytest.mark.parametrize('field,value', [('source_url', 'http://example.invalid/x'), ('checked_on', '2099-01-01'), ('skills', []), ('student_id', 'other')])
def test_invalid_payloads(context, field, value):
    clients, _, _, _ = context
    payload = {'title': 'Curso', 'provider': 'Proveedor', 'source_url': 'https://example.invalid/curso', 'checked_on': '2026-01-01', 'skills': ['IA']}
    payload[field] = value
    assert clients['admin'].post('/api/v1/learning/courses', json=payload).status_code == 422

def test_authentication_and_unavailable_database():
    app = create_app(Settings(environment='test', auth_session_secret='test-learning-only', log_level='WARNING'))
    with TestClient(app) as c:
        assert c.get('/api/v1/learning/interests').status_code == 401
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=uuid4(), email='demo@example.invalid', role=Role.ADMIN)
    with TestClient(app) as c:
        assert c.get('/api/v1/learning/interests').status_code == 503

def test_concurrent_acceptance_cannot_overbook_postgres(context):
    clients, app, _, pg = context
    if not pg:
        pytest.skip('Requires LEARNING_TEST_DATABASE_URL PostgreSQL')
    _, _, _, _, workshop = setup_offer(clients, 1)
    requests = [post(clients[name], '/me/applications', {'workshop_id': workshop['id'], 'requirements_acknowledged': True}) for name in ['one', 'two']]

    def accept(item):
        with TestClient(app, headers={'x-test-actor': 'admin'}) as client:
            return client.post('/api/v1/learning/admin/applications/' + item['id'] + '/status', json={'status': 'ACCEPTED', 'reason': 'Requisitos revisados en prueba concurrente.'}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(accept, requests))
    assert sorted(codes) == [200, 409]
