from fastapi.testclient import TestClient
from backend.app.analytics.demo import demo_analytics
from backend.app.main import create_app
from backend.app.core.config import Settings
from backend.app.auth.dependencies import get_current_user
from backend.app.auth.models import AuthenticatedUser, Role
from uuid import uuid4

def test_demo_covers_2020_to_2026_with_consistent_unique_counts():
    service = demo_analytics()
    periods = service.periods()
    assert len(periods) == 14
    assert {p.code for p in periods} == {f"{year}-{term}" for year in range(2020,2027) for term in ["I","II"]}
    for period in periods:
        data = service.overview(period_code=period.code)
        assert data.kpis.approved_certifications == sum(x.value for x in data.by_issuer)
        assert data.kpis.approved_certifications == sum(x.value for x in data.by_credential)
        assert sum(x.value for x in data.by_skill) > data.kpis.approved_certifications
        assert data.kpis.certified_students <= data.kpis.active_students
        assert data.kpis.coverage_percent == round(data.kpis.certified_students*100/data.kpis.active_students,2)
        assert str(data.filters.cutoff_date) <= "2026-10-10"
    assert len(service.overview(period_code="2025-II").by_credential) == 6

def test_demo_is_unavailable_without_local_authentication():
    app = create_app(Settings())
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=uuid4(), email="admin@example.test", role=Role.ADMIN)
    with TestClient(app) as client:
        assert client.get("/api/v1/indicators/periods?dataset=demo").status_code == 403
