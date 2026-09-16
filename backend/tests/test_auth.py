from __future__ import annotations

from dataclasses import replace
from typing import Any
from urllib.parse import parse_qs, urlparse
from uuid import UUID, uuid4

from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.auth.dependencies import require_permissions, require_student_access
from backend.app.auth.models import AuthenticatedUser, GoogleIdentity, Permission, Role
from backend.app.auth.oidc import GOOGLE_SCOPE, GoogleOidcClient
from backend.app.auth.store import InMemoryUserDirectory, SqlAlchemyUserDirectory
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.models import Student, User
from backend.app.main import create_app


class FakeOidcClient:
    configured = True

    def __init__(self, identity: GoogleIdentity) -> None:
        self.identity = identity
        self.last_expected_nonce: str | None = None

    def authorization_url(self, *, state: str, nonce: str) -> str:
        self.last_expected_nonce = nonce
        return (
            "https://accounts.google.com/o/oauth2/v2/auth?"
            f"state={state}&nonce={nonce}&scope={GOOGLE_SCOPE.replace(' ', '%20')}"
        )

    def exchange_code(self, code: str) -> str:
        assert code == "one-time-code"
        return "fake-id-token"

    def verify_id_token(self, encoded_token: str, *, expected_nonce: str) -> GoogleIdentity:
        assert encoded_token == "fake-id-token"
        self.last_expected_nonce = expected_nonce
        return replace(self.identity, nonce=expected_nonce)


def make_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "environment": "test",
        "log_level": "WARNING",
        "auth_session_secret": "test-session-secret",
        "google_client_id": "test-client-id",
        "google_client_secret": "test-client-secret",
        "google_allowed_domains": "virtual.upt.pe",
    }
    values.update(overrides)
    return Settings(**values)


def make_user(role: Role, email: str, *, student_id: UUID | None = None) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=uuid4(),
        email=email,
        role=role,
        student_id=student_id,
    )


def make_app(
    identity: GoogleIdentity,
    users: list[AuthenticatedUser],
) -> tuple[Any, InMemoryUserDirectory, FakeOidcClient]:
    directory = InMemoryUserDirectory(users)
    oidc_client = FakeOidcClient(identity)
    app = create_app(
        settings=make_settings(),
        user_directory=directory,
        oidc_client=oidc_client,
    )
    return app, directory, oidc_client


def sign_in(client: TestClient) -> None:
    login = client.get("/api/v1/auth/google/login", follow_redirects=False)
    assert login.status_code == 302
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    callback = client.get(
        "/api/v1/auth/google/callback",
        params={"code": "one-time-code", "state": state},
        follow_redirects=False,
    )
    assert callback.status_code == 302


def test_google_login_requests_identity_scopes_without_gmail_access():
    settings = make_settings()
    client = GoogleOidcClient(settings)

    location = client.authorization_url(state="state", nonce="nonce")
    scope = parse_qs(urlparse(location).query)["scope"][0].split()

    assert scope == ["openid", "email", "profile"]
    assert "gmail" not in location.lower()


def test_google_login_requires_server_configuration():
    student = make_user(
        Role.STUDENT,
        "student@virtual.upt.pe",
        student_id=uuid4(),
    )
    app = create_app(
        settings=make_settings(google_client_id=None, google_client_secret=None),
        user_directory=InMemoryUserDirectory([student]),
    )

    with TestClient(app) as client:
        response = client.get("/api/v1/auth/google/login")

    assert response.status_code == 503
    assert response.json()["code"] == "AUTH_NOT_CONFIGURED"


def test_student_oidc_login_uses_padrón_and_rehydrates_server_role():
    student = make_user(
        Role.STUDENT,
        "student@virtual.upt.pe",
        student_id=uuid4(),
    )
    identity = GoogleIdentity(
        subject="google-student-123",
        email=student.email,
        email_verified=True,
    )
    app, directory, _ = make_app(identity, [student])

    with TestClient(app) as client:
        sign_in(client)
        response = client.get("/api/v1/auth/me")
        logout = client.post("/api/v1/auth/logout")
        after_logout = client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["id"] == str(student.id)
    assert response.json()["role"] == "STUDENT"
    assert response.json()["student_id"] == str(student.student_id)
    assert "CERTIFICATION_READ_OWN" in response.json()["permissions"]
    assert directory.find_by_google_subject(identity.subject).id == student.id
    assert logout.status_code == 204
    assert after_logout.status_code == 401


def test_callback_rejects_state_replay_or_mismatch():
    student = make_user(
        Role.STUDENT,
        "student@virtual.upt.pe",
        student_id=uuid4(),
    )
    identity = GoogleIdentity("google-student-123", student.email, True)
    app, _, _ = make_app(identity, [student])

    with TestClient(app) as client:
        client.get("/api/v1/auth/google/login", follow_redirects=False)
        response = client.get(
            "/api/v1/auth/google/callback",
            params={"code": "one-time-code", "state": "attacker-state"},
        )

    assert response.status_code == 400
    assert response.json()["code"] == "AUTH_STATE_MISMATCH"


def test_allowed_domain_alone_does_not_authorize_a_user():
    identity = GoogleIdentity(
        subject="google-outsider-123",
        email="not-in-padron@virtual.upt.pe",
        email_verified=True,
    )
    app, _, _ = make_app(identity, [])

    with TestClient(app) as client:
        login = client.get("/api/v1/auth/google/login", follow_redirects=False)
        state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
        response = client.get(
            "/api/v1/auth/google/callback",
            params={"code": "one-time-code", "state": state},
        )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_rbac_prevents_validator_from_admin_and_student_from_other_records():
    student = make_user(
        Role.STUDENT,
        "student@virtual.upt.pe",
        student_id=uuid4(),
    )
    other_student_id = uuid4()
    identity = GoogleIdentity("google-student-123", student.email, True)
    app, _, _ = make_app(identity, [student])

    @app.get("/_test/admin")
    def admin_probe(
        _: AuthenticatedUser = Depends(
            require_permissions(Permission.PADRON_MANAGE)
        ),
    ):
        return {"allowed": True}

    @app.get("/_test/student/{student_id}")
    def student_probe(
        student_id: UUID,
        _: AuthenticatedUser = Depends(require_student_access),
    ):
        return {"student_id": str(student_id)}

    with TestClient(app) as client:
        sign_in(client)
        admin = client.get("/_test/admin")
        own = client.get(f"/_test/student/{student.student_id}")
        other = client.get(f"/_test/student/{other_student_id}")

    assert admin.status_code == 403
    assert own.status_code == 200
    assert other.status_code == 403


def test_admin_can_manage_but_validator_only_validates():
    admin = make_user(Role.ADMIN, "admin@virtual.upt.pe")
    validator = make_user(Role.VALIDATOR, "validator@virtual.upt.pe")

    for user, expected_admin, expected_validator in (
        (admin, 200, 403),
        (validator, 403, 200),
    ):
        identity = GoogleIdentity(f"google-{user.role.value.lower()}", user.email, True)
        app, _, _ = make_app(identity, [user])

        @app.get("/_test/admin")
        def admin_probe(
            _: AuthenticatedUser = Depends(
                require_permissions(Permission.PADRON_MANAGE)
            ),
        ):
            return {"allowed": True}

        @app.get("/_test/validate")
        def validation_probe(
            _: AuthenticatedUser = Depends(
                require_permissions(Permission.CERTIFICATION_VALIDATE)
            ),
        ):
            return {"allowed": True}

        with TestClient(app) as client:
            sign_in(client)
            admin_response = client.get("/_test/admin")
            validator_response = client.get("/_test/validate")

        assert admin_response.status_code == expected_admin
        assert validator_response.status_code == expected_validator


def test_sqlalchemy_directory_resolves_students_and_binds_google_subject():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    user_id = uuid4()
    student_id = uuid4()

    with Session(engine) as session:
        session.add(
            User(
                id=user_id,
                email="student@virtual.upt.pe",
                role="STUDENT",
            )
        )
        session.add(
            Student(
                id=student_id,
                user_id=user_id,
                student_key="student-auth-001",
                entry_year=2026,
            )
        )
        session.commit()

    directory = SqlAlchemyUserDirectory(session_factory)
    before = directory.find_by_email("STUDENT@VIRTUAL.UPT.PE")
    after = directory.bind_google_subject(user_id, "google-student-123")

    assert before is not None
    assert before.student_id == student_id
    assert before.google_subject is None
    assert after.google_subject == "google-student-123"
    assert directory.find_by_google_subject("google-student-123").id == user_id
    engine.dispose()


def test_callback_redirects_to_the_configured_frontend_origin():
    student = make_user(
        Role.STUDENT,
        "student@virtual.upt.pe",
        student_id=uuid4(),
    )
    identity = GoogleIdentity("google-student-redirect", student.email, True)
    app, _, _ = make_app(identity, [student])
    app.state.settings = make_settings(auth_success_redirect="http://localhost:3000/")

    with TestClient(app) as client:
        login = client.get("/api/v1/auth/google/login", follow_redirects=False)
        state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
        callback = client.get(
            "/api/v1/auth/google/callback",
            params={"code": "one-time-code", "state": state},
            follow_redirects=False,
        )

    assert callback.status_code == 302
    assert callback.headers["location"] == "http://localhost:3000/"
