from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.analytics.demo import (
    demo_analytics,
    demo_student_directory,
    reference_enrollment_history,
)
from backend.app.auth.dependencies import get_current_user
from backend.app.auth.models import AuthenticatedUser, Role
from backend.app.core.config import Settings
from backend.app.main import create_app


def _reference_app(initial_user: AuthenticatedUser):
    app = create_app(
        Settings(environment="test", demo_analytics_enabled=True, log_level="WARNING")
    )
    actor = {"user": initial_user}
    app.dependency_overrides[get_current_user] = lambda: actor["user"]
    return app, actor


def _user(role: Role, email: str) -> AuthenticatedUser:
    return AuthenticatedUser(id=uuid4(), email=email, role=role)


def test_reference_directory_is_limited_to_admin_and_validator_roles():
    app, actor = _reference_app(_user(Role.ADMIN, "admin@virtual.upt.pe"))
    with TestClient(app) as client:
        for role in (Role.ADMIN, Role.VALIDATOR):
            actor["user"] = _user(role, f"{role.value.lower()}@virtual.upt.pe")
            response = client.get(
                "/api/v1/indicators/reference/students",
                params={"period_code": "2025-II", "limit": 1},
            )
            assert response.status_code == 200
            assert response.json()["dataset"] == "demo"
            assert response.json()["reference_label"] == "Datos de referencia · no oficiales"
            assert response.json()["total"] == 342

        latest_directory = client.get(
            "/api/v1/indicators/reference/students", params={"limit": 2}
        )
        assert latest_directory.status_code == 200
        assert latest_directory.json()["period_code"] == "2026-II"
        assert [item["code"] for item in latest_directory.json()["items"]] == [
            "KZ2023077087",
            "VL2023076796",
        ]

        actor["user"] = _user(Role.STUDENT, "kz2023077087@virtual.upt.pe")
        denied = client.get("/api/v1/indicators/reference/students")
        assert denied.status_code == 403


def test_admin_and_validator_receive_the_same_read_only_reference_certifications():
    app, actor = _reference_app(_user(Role.ADMIN, "admin@virtual.upt.pe"))
    with TestClient(app) as client:
        admin_response = client.get(
            "/api/v1/validations/reference", params={"period_code": "2025-II"}
        )
        assert admin_response.status_code == 200
        admin_data = admin_response.json()
        assert admin_data["dataset"] == "demo"
        assert admin_data["reference_label"] == "Datos de referencia · no oficiales"
        assert admin_data["period_code"] == "2025-II"
        assert admin_data["total_students"] == 342
        assert admin_data["total_certifications"] > 0
        overview = demo_analytics().overview(period_code="2025-II")
        assert admin_data["total_certifications"] == overview.kpis.approved_certifications
        assert admin_data["students_with_certifications"] == overview.kpis.certified_students

        linked_accounts = {
            item["student_code"]: item
            for item in admin_data["items"]
            if item["student_code"] in {"KZ2023077087", "VL2023076796"}
        }
        assert set(linked_accounts) == {"KZ2023077087", "VL2023076796"}
        for student in linked_accounts.values():
            assert student["certifications"]
            for certification in student["certifications"]:
                traceability = certification["traceability"]
                assert traceability["source"] == "EXAMPLE"
                assert {traceability[key]["role"] for key in ("student", "validator", "administrator")} == {
                    "STUDENT",
                    "VALIDATOR",
                    "ADMIN",
                }

        latest_response = client.get("/api/v1/validations/reference")
        assert latest_response.status_code == 200
        latest_data = latest_response.json()
        assert latest_data["period_code"] == "2026-II"
        assert [item["student_code"] for item in latest_data["items"][:2]] == [
            "KZ2023077087",
            "VL2023076796",
        ]
        assert all(item["certifications"] for item in latest_data["items"][:2])

        actor["user"] = _user(Role.VALIDATOR, "validator@virtual.upt.pe")
        validator_response = client.get(
            "/api/v1/validations/reference", params={"period_code": "2025-II"}
        )
        assert validator_response.status_code == 200
        assert validator_response.json() == admin_data

        actor["user"] = _user(Role.STUDENT, "kz2023077087@virtual.upt.pe")
        assert client.get("/api/v1/validations/reference").status_code == 403


def test_student_reference_profile_returns_only_the_linked_account_history():
    app, actor = _reference_app(_user(Role.STUDENT, "kz2023077087@virtual.upt.pe"))
    with TestClient(app) as client:
        kz_response = client.get(
            "/api/v1/certifications/reference-preview",
            params={"email": "vl2023076796@virtual.upt.pe"},
        )
        assert kz_response.status_code == 200
        kz_profile = kz_response.json()
        assert kz_profile["dataset"] == "demo"
        assert kz_profile["reference_label"] == "Datos de referencia · no oficiales"
        assert kz_profile["student"]["code"] == "KZ2023077087"
        assert kz_profile["student"]["email"] == "kz2023077087@virtual.upt.pe"

        actor["user"] = _user(Role.ADMIN, "admin@virtual.upt.pe")
        for period in kz_profile["periods"]:
            certifications = period["certifications"]
            assert certifications
            for certification in certifications:
                traceability = certification["traceability"]
                assert traceability["source"] == "EXAMPLE"
                assert {traceability[key]["role"] for key in ("student", "validator", "administrator")} == {
                    "STUDENT",
                    "VALIDATOR",
                    "ADMIN",
                }
                assert all(
                    traceability[key]["action"].startswith("Evento de ejemplo:")
                    for key in ("student", "validator", "administrator")
                )

            directory = client.get(
                "/api/v1/indicators/reference/students",
                params={"period_code": period["period_code"], "q": "KZ2023077087", "limit": 5},
            )
            assert directory.status_code == 200
            matched = directory.json()["items"]
            assert len(matched) == 1
            assert matched[0]["code"] == kz_profile["student"]["code"]
            assert {item["id"] for item in matched[0]["certifications"]} == {
                item["id"] for item in certifications
            }

        actor["user"] = _user(Role.STUDENT, "kz2023077087@virtual.upt.pe")
        own_again = client.get(
            "/api/v1/certifications/reference-preview",
            params={"email": "vl2023076796@virtual.upt.pe"},
        ).json()
        assert own_again["student"]["code"] == "KZ2023077087"

        actor["user"] = _user(Role.STUDENT, "vl2023076796@virtual.upt.pe")
        vl_profile = client.get("/api/v1/certifications/reference-preview").json()
        assert vl_profile["student"]["code"] == "VL2023076796"
        assert vl_profile["student"]["email"] == "vl2023076796@virtual.upt.pe"

        actor["user"] = _user(Role.STUDENT, "another@virtual.upt.pe")
        assert client.get("/api/v1/certifications/reference-preview").status_code == 404

        actor["user"] = _user(Role.ADMIN, "admin@virtual.upt.pe")
        assert client.get("/api/v1/certifications/reference-preview").status_code == 403


def test_reference_directory_counts_match_indicators_for_every_period():
    service = demo_analytics()
    history = {item["period_code"]: item["active_students"] for item in reference_enrollment_history()}

    for period in service.periods():
        overview = service.overview(period_code=period.code)
        directory = demo_student_directory(period_code=period.code, limit=500)
        students = directory["items"]
        certified_students = [student for student in students if student["certifications"]]
        approved_certifications = [
            certification
            for student in students
            for certification in student["certifications"]
        ]

        assert directory["dataset"] == "demo"
        assert directory["total"] == overview.kpis.active_students == history[period.code]
        assert len(certified_students) == overview.kpis.certified_students
        assert len(approved_certifications) == overview.kpis.approved_certifications
