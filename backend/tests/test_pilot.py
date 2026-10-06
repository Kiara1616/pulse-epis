"""An integral synthetic pilot with real sessions, repositories and ETL."""
from contextlib import ExitStack
from datetime import date
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.auth.models import GoogleIdentity
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import AcademicPeriod, User
from backend.app.db.session import create_session_factory
from backend.app.etl.service import EtlService
from backend.app.main import create_app


class SyntheticOidc:
    """Only the external Google provider is substituted in this local pilot."""
    configured = True

    def __init__(self, email):
        self.email = email

    def authorization_url(self, *, state, nonce):
        return f'https://accounts.google.com/auth?state={state}&nonce={nonce}'

    def exchange_code(self, code):
        assert code == 'synthetic-one-use-code'
        return 'synthetic-id-token'

    def verify_id_token(self, encoded_token, *, expected_nonce):
        assert encoded_token == 'synthetic-id-token'
        return GoogleIdentity(subject='pilot-' + self.email, email=self.email, email_verified=True, nonce=expected_nonce)


def login(client):
    response = client.get('/api/v1/auth/google/login', follow_redirects=False)
    state = parse_qs(urlparse(response.headers['location']).query)['state'][0]
    response = client.get('/api/v1/auth/google/callback', params={'code': 'synthetic-one-use-code', 'state': state}, follow_redirects=False)
    assert response.status_code == 302, response.text


def test_integral_synthetic_pilot(tmp_path):
    database_url = f'sqlite:///{tmp_path / "pilot.db"}'
    factory = create_session_factory(database_url)
    Base.metadata.create_all(factory.kw['bind'])
    with factory.begin() as session:
        session.add(AcademicPeriod(code='2026-II', name='Pilot', starts_on=date(2026, 8, 1), ends_on=date(2026, 12, 31)))
        session.add_all([User(email='pilot-admin@virtual.upt.pe', role='ADMIN'), User(email='pilot-validator@virtual.upt.pe', role='VALIDATOR')])
    settings = Settings(environment='test', database_url=database_url, auth_session_secret='synthetic-session-only', roster_pseudonym_secret='synthetic-roster-only', evidence_access_secret='synthetic-evidence-only', evidence_storage_path=str(tmp_path / 'evidence'), log_level='WARNING')
    with ExitStack() as stack:
        admin = stack.enter_context(TestClient(create_app(settings=settings, oidc_client=SyntheticOidc('pilot-admin@virtual.upt.pe'))))
        validator = stack.enter_context(TestClient(create_app(settings=settings, oidc_client=SyntheticOidc('pilot-validator@virtual.upt.pe'))))
        login(admin)
        login(validator)
        roster = 'code,email,school,plan,cycle,status,period\n' + ''.join(f'pilot2026{i:04d},pilot-student-{i}@virtual.upt.pe,EPIS,Plan 2020,VI,ACTIVE,2026-II\n' for i in range(20))
        response = admin.post('/api/v1/padron/imports', params={'period_code': '2026-II'}, files={'file': ('pilot.csv', roster.encode(), 'text/csv')})
        assert response.status_code == 201, response.text
        report = response.json()
        assert report['accepted_rows'] == report['total_rows'] == 20
        repeated = admin.post('/api/v1/padron/imports', params={'period_code': '2026-II'}, files={'file': ('pilot.csv', roster.encode(), 'text/csv')})
        assert repeated.json()['idempotent'] is True
        student = stack.enter_context(TestClient(create_app(settings=settings, oidc_client=SyntheticOidc('pilot-student-0@virtual.upt.pe'))))
        login(student)
        clients = {'ADMIN': admin, 'VALIDATOR': validator, 'STUDENT': student}
        for role, client in clients.items():
            assert client.get('/api/v1/auth/me').json()['role'] == role
        assert student.get('/api/v1/validations').status_code == 403
        assert validator.post('/api/v1/padron/imports', params={'period_code': '2026-II'}, files={'file': ('pilot.csv', roster.encode(), 'text/csv')}).status_code == 403
        certification_ids = []
        for i in range(3):
            response = student.post('/api/v1/certifications', json={'issuer_name': 'AWS', 'credential_name': f'Synthetic Cloud {i}', 'issued_on': '2026-08-15', 'skills': [{'name': 'Cloud Computing', 'level': 'Fundamentals'}]})
            assert response.status_code == 201, response.text
            certification_id = response.json()['id']
            certification_ids.append(certification_id)
            evidence = student.post(f'/api/v1/certifications/{certification_id}/evidence', files={'file': (f'synthetic-{i}.pdf', b'%PDF-1.4\nsynthetic evidence\n%%EOF', 'application/pdf')})
            assert evidence.status_code == 201, evidence.text
            evidence_id = evidence.json()['id']
            access = validator.post(f'/api/v1/validations/{certification_id}/evidence/{evidence_id}/access')
            assert access.status_code == 200, access.text
            assert validator.get(access.json()['access_url']).status_code == 200
            for action in ['START_REVIEW', 'APPROVE' if i < 2 else 'REJECT']:
                decision = validator.post(f'/api/v1/validations/{certification_id}', json={'action': action, 'comment': 'Synthetic pilot decision'})
                assert decision.status_code == 200, decision.text
            assert validator.get(f'/api/v1/validations/{certification_id}/history').status_code == 200
        cutoff = date(2026, 9, 13)
        etl = EtlService(factory)
        run = etl.run('2026-II', cutoff)
        assert run.status == 'APPLIED'
        assert etl.run('2026-II', cutoff).idempotent
        response = admin.get('/api/v1/indicators/overview', params={'period_code': '2026-II'})
        assert response.status_code == 200, response.text
        kpis = response.json()['kpis']
        assert kpis['active_students'] == 20
        assert kpis['certified_students'] == 1
        assert kpis['approved_certifications'] == 2
        assert kpis['coverage_percent'] == 5.0
        output = os.environ.get('PULSE_PILOT_REPORT')
        if output:
            evidence = {'mode': 'synthetic', 'reconciliation_percent': 100.0, 'approved_credential_accounting_percent': 100.0, 'kpis_contrasted': True, 'roles_demonstrated': sorted(clients), 'kpis': kpis, 'roster_rows': 20, 'approved_credentials': 2, 'rejected_credentials': 1, 'oidc_provider': 'test double; real Google authorization pending', 'public_deployment_verified': False}
            Path(output).parent.mkdir(parents=True, exist_ok=True)
            Path(output).write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
