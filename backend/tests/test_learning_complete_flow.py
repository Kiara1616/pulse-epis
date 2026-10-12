"""API end-to-end scenario using real sessions and persisted services, no identity mocks."""
from pathlib import Path
import json
import os
from datetime import date,datetime,timezone
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import select
from backend.app.main import create_app
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.session import create_session_factory
from backend.app.db.models import CertificationStatusHistory,Student
from backend.app.certifications.service import append_status_history
from backend.tests.test_learning_api import post,publish

def test_certification_to_learning_request_with_real_sessions(tmp_path):
    db=f"sqlite:///{(tmp_path/'complete-learning.db').as_posix()}"
    factory=create_session_factory(db);Base.metadata.create_all(factory.kw['bind'])
    app=create_app(Settings(environment='test',database_url=db,auth_provider='local',local_auth_seed=True,demo_data_seed=False,auth_session_secret='test-complete-learning-only',evidence_storage_path=str(tmp_path/'evidence'),log_level='WARNING'))
    def login(client,role):
        response=client.post('/api/v1/auth/local/login',json={'email':f'{role}@local.pulse-epis.test','password':'pulse-local-demo'})
        assert response.status_code==200,response.text
    with TestClient(app) as admin,TestClient(app) as validator,TestClient(app) as student:
        login(admin,'admin');login(validator,'validator');login(student,'student')
        interest=post(admin,'/interests',{'name':'IA sintética'})
        route=post(admin,'/routes',{'title':'Ruta sintética de IA','description':'Formación de ejemplo con evidencia registrada','steps':[{'title':'Fundamentos','skills':['Python'],'prerequisites':[]}]});publish(admin,'routes',route,'PUBLISHED')
        response=student.post('/api/v1/certifications',json={'credential_name':'Python sintético','issuer_name':'Emisor demo','issued_on':'2026-09-01','skills':[{'name':'Python','level':'Fundamentals'}]});assert response.status_code==201,response.text
        credential=response.json()['id']
        evidence=student.post(f'/api/v1/certifications/{credential}/evidence',files={'file':('evidencia-demo.pdf',b'%PDF-1.4\nsynthetic evidence\n%%EOF','application/pdf')});assert evidence.status_code==201,evidence.text
        assert validator.post(f'/api/v1/validations/{credential}',json={'action':'START_REVIEW'}).status_code==200
        approval=validator.post(f'/api/v1/validations/{credential}',json={'action':'APPROVE','comment':'Evidencia sintética revisada en prueba integral.'});assert approval.status_code==200,approval.text
        assert student.get(f'/api/v1/certifications/{credential}').json()['status']=='APPROVED'
        assert student.put('/api/v1/learning/me/profile',json={'route_id':route['id'],'interest_ids':[interest['id']]}).status_code==200
        course=post(admin,'/courses',{'title':'Curso de IA sintético','provider':'Proveedor demo','source_url':'https://example.invalid/course','checked_on':'2026-01-01','requirements':['Python'],'skills':['IA']});publish(admin,'courses',course,'IN_REVIEW')
        offer=post(admin,'/offers',{'course_id':course['id'],'title':'Oportunidad sintética','interest_ids':[interest['id']],'relevance':'Ejemplo para profundizar formación posterior en IA.'});publish(admin,'offers',offer,'PUBLISHED')
        workshop=post(admin,'/workshops',{'offer_id':offer['id'],'title':'Taller de IA sintético','capacity':1,'requirements':['Python']});publish(admin,'workshops',workshop,'OPEN')
        assert student.get('/api/v1/learning/offers').json()[0]['id']==offer['id']
        application=post(student,'/me/applications',{'workshop_id':workshop['id'],'requirements_acknowledged':True})
        post(admin,f'/admin/applications/{application["id"]}/status',{'status':'ACCEPTED','reason':'Requisitos de la solicitud revisados manualmente.'},200)
        with TestClient(app) as returning:
            login(returning,'student')
            assert returning.get('/api/v1/learning/me/profile').json()['route_id']==route['id']
            assert returning.get('/api/v1/learning/me/applications').json()[0]['status']=='ACCEPTED'
            assert returning.get('/api/v1/learning/workshops').json()[0]['available_places']==0
        assert validator.get('/api/v1/learning/admin/applications').status_code==403
        assert student.get('/api/v1/learning/admin/audit').status_code==403
        assert admin.get('/api/v1/learning/admin/audit').json()
        report_path=os.getenv('LEARNING_FLOW_REPORT')
        if report_path:
            target=Path(report_path);target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text(json.dumps({'source':'HTTP integration test with real local sessions',
                'synthetic':True,'browser_flow_complete':False,
                'steps':['Registrar credencial y evidencia privada','Validar credencial','Actualizar preferencias propias','Publicar oportunidad revisada','Abrir taller','Solicitar participación','Aceptar con control de cupos','Consultar persistencia en una nueva sesión'],
                'result':'PASS','application_status':'ACCEPTED','capacity':1,'available_places':0,
                'permission_checks':['VALIDATOR sin administración de solicitudes: 403','STUDENT sin acceso a auditoría: 403'],
                'remaining':'Conectar pantallas en #79 y aprobar aceptación visual conjunta en #80'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def test_tied_history_times_keep_append_order_including_unflushed_events(tmp_path):
    # Existing test helpers supply a real certification and actors; do not reconstruct old history.
    from backend.tests.test_validation import make_context
    engine,factory,settings,student_id,validator_id,_,credential_id=make_context(tmp_path)
    fixed=datetime(2026,10,11,12,0,0,tzinfo=timezone.utc)
    with factory.begin() as s:
        first=append_status_history(s,certification_id=credential_id,actor_user_id=validator_id,from_status='PENDING',to_status='UNDER_REVIEW',changed_at=fixed)
        second=append_status_history(s,certification_id=credential_id,actor_user_id=validator_id,from_status='UNDER_REVIEW',to_status='APPROVED',changed_at=fixed)
        assert second.changed_at>first.changed_at
        third=append_status_history(s,certification_id=credential_id,actor_user_id=validator_id,from_status='APPROVED',to_status='EXPIRED',changed_at=fixed)
        assert third.changed_at>second.changed_at
    with factory() as s:
        rows=s.scalars(select(CertificationStatusHistory).where(CertificationStatusHistory.certification_id==credential_id).order_by(CertificationStatusHistory.changed_at,CertificationStatusHistory.id)).all()
        assert [r.to_status for r in rows][-3:]==['UNDER_REVIEW','APPROVED','EXPIRED']
    engine.dispose()
