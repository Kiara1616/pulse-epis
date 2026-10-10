"""Integrated HTTP workflow against an isolated database, with real services."""
from datetime import date
from io import BytesIO
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlalchemy import select

from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import AcademicPeriod, Enrollment, Student, User
from backend.app.db.session import create_session_factory
from backend.app.main import create_app


def test_register_review_correct_publish_and_export(tmp_path):
    db = f"sqlite+pysqlite:///{(tmp_path / 'workflow.db').as_posix()}"
    factory = create_session_factory(db)
    Base.metadata.create_all(factory.kw["bind"])
    settings = Settings(environment="test", database_url=db, auth_provider="local", local_auth_seed=True,
                        evidence_storage_path=str(tmp_path / "evidence"), log_level="WARNING")
    app = create_app(settings=settings)
    def login(client, role):
        assert client.post("/api/v1/auth/local/login", json={"email": f"{role}@local.pulse-epis.test", "password": "pulse-local-demo"}).status_code == 200
    with TestClient(app) as client:
        assert client.post("/api/v1/etl/runs", json={"period_code": "2026-II", "cutoff_date": "2026-10-10"}).status_code == 401
        login(client, "admin")
        assert client.post("/api/v1/padron/periods", json={"code": "2026-II", "starts_on": "2026-08-17", "ends_on": "2026-12-18"}).status_code == 201
        # Use a synthetic demo enrollment; source roster users remain unchanged.
        with factory.begin() as session:
            period = session.scalar(select(AcademicPeriod).where(AcademicPeriod.code == "2026-II"))
            demo = session.scalar(select(Student).join(User, User.id == Student.user_id).where(User.email == "student@local.pulse-epis.test"))
            session.add(Enrollment(student_id=demo.id, period_id=period.id, status="ACTIVE", cycle="VIII", school="EPIS"))
        csv = b"code,email,school,plan,cycle,status,period\nkz20251234,synthetic@virtual.upt.pe,EPIS,Plan 2020,VIII,ACTIVE,2026-II\n"
        assert client.post("/api/v1/padron/imports?period_code=2026-II&selected_period_only=true", files={"file": ("demo.csv", csv)}).status_code == 201
        directory = client.get("/api/v1/padron/students", params={"q": "kz20251234"}).json()
        assert directory["total"] == 1
        assert directory["items"][0]["code"] == "kz20251234"
        assert client.get("/api/v1/padron/students", params={"q": "%"}).json()["total"] == 0
        login(client, "student")
        assert client.get("/api/v1/padron/students").status_code == 403
        draft = {"credential_name": "Cloud Fundamentals", "issuer_name": "AWS", "issued_on": "2026-09-01", "skills": [{"name": "Cloud Computing", "level": "Fundamentals"}]}
        created = client.post("/api/v1/certifications", json=draft)
        assert created.status_code == 201
        id = created.json()["id"]
        assert client.post(f"/api/v1/certifications/{id}/evidence", data={"source_url": "https://issuer.example.test/demo"}).status_code == 201
        assert client.post("/api/v1/etl/runs", json={"period_code": "2026-II", "cutoff_date": "2026-10-10"}).status_code == 403
        login(client, "validator")
        assert client.get("/api/v1/padron/students").status_code == 403
        assert client.post(f"/api/v1/validations/{id}", json={"action": "START_REVIEW"}).status_code == 200
        assert client.post(f"/api/v1/validations/{id}", json={"action": "OBSERVE", "comment": "Corrige el nombre del logro"}).status_code == 200
        login(client, "student")
        assert client.get(f"/api/v1/certifications/{id}").json()["latest_comment"] == "Corrige el nombre del logro"
        assert client.patch(f"/api/v1/certifications/{id}", json={"credential_name": "AWS Cloud Fundamentals"}).json()["status"] == "RESUBMITTED"
        login(client, "validator")
        assert client.post(f"/api/v1/validations/{id}", json={"action": "START_REVIEW"}).status_code == 200
        assert client.post(f"/api/v1/validations/{id}", json={"action": "APPROVE"}).status_code == 200
        assert len(client.get(f"/api/v1/validations/{id}/history").json()) == 6
        assert client.get("/api/v1/etl/runs?period_code=2026-II").status_code == 403
        login(client, "admin")
        params = {"period_code": "2026-II", "cutoff_date": "2026-10-10"}
        published = client.post("/api/v1/etl/runs", json=params)
        assert published.status_code == 201 and published.json()["status"] == "APPLIED"
        assert client.post("/api/v1/etl/runs", json=params).json()["idempotent"]
        overview = client.get("/api/v1/indicators/overview", params=params).json()
        assert overview["kpis"]["active_students"] == 2
        assert overview["kpis"]["certified_students"] == 1
        assert overview["kpis"]["coverage_percent"] == 50
        pdf = client.get("/api/v1/indicators/report.pdf", params=params)
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
        text = "\n".join(p.extract_text() for p in PdfReader(BytesIO(pdf.content)).pages)
        assert "2026-II" in text and "10/10/2026" in text and "50" in text
        assert "@" not in text
        assert client.post("/api/v1/etl/runs", json={**params, "cutoff_date": "2027-01-01"}).status_code == 422
