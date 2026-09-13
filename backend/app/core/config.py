"""Environment-based application settings."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_DEVELOPMENT_SESSION_SECRET = "development-only-change-me"


class Settings(BaseSettings):
    """Non-secret settings needed to boot the API."""

    app_name: str = "Pulse EPIS API"
    app_version: str = "0.1.0"
    environment: Literal["development", "test", "staging", "production"] = "development"
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"
    database_url: str | None = None
    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"
    google_allowed_domains: str = "virtual.upt.pe,upt.edu.pe"
    auth_session_secret: SecretStr = SecretStr(_DEVELOPMENT_SESSION_SECRET)
    auth_session_cookie: str = "pulse_session"
    auth_session_max_age: int = 3600
    auth_cookie_secure: bool = False
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    auth_success_redirect: str = "/"

    model_config = SettingsConfigDict(
        env_prefix="PULSE_",
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @field_validator("api_prefix")
    @classmethod
    def normalize_api_prefix(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("api_prefix cannot be empty")
        if not value.startswith("/"):
            value = f"/{value}"
        return value.rstrip("/") or "/"

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        normalized = value.strip().upper()
        allowed = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}
        if normalized not in allowed:
            raise ValueError(f"log_level must be one of: {', '.join(sorted(allowed))}")
        return normalized

    @field_validator("google_redirect_uri")
    @classmethod
    def validate_google_redirect_uri(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith("http://") and not value.startswith("https://"):
            raise ValueError("google_redirect_uri must be an absolute HTTP(S) URL")
        return value

    @field_validator("google_allowed_domains")
    @classmethod
    def normalize_google_allowed_domains(cls, value: str) -> str:
        domains = [domain.strip().lower().lstrip("@") for domain in value.split(",")]
        domains = [domain for domain in domains if domain]
        if not domains:
            raise ValueError("google_allowed_domains must contain at least one domain")
        if any("@" in domain or "/" in domain for domain in domains):
            raise ValueError("google_allowed_domains must contain host names only")
        return ",".join(dict.fromkeys(domains))

    @field_validator("auth_session_cookie")
    @classmethod
    def validate_session_cookie(cls, value: str) -> str:
        value = value.strip()
        if not value or any(character in value for character in " ;\t\r\n"):
            raise ValueError("auth_session_cookie must be a valid cookie name")
        return value

    @field_validator("auth_session_max_age")
    @classmethod
    def validate_session_max_age(cls, value: int) -> int:
        if value < 60:
            raise ValueError("auth_session_max_age must be at least 60 seconds")
        return value

    @field_validator("auth_success_redirect")
    @classmethod
    def validate_success_redirect(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith("/") or value.startswith("//"):
            raise ValueError("auth_success_redirect must be a relative path")
        return value

    @model_validator(mode="after")
    def validate_auth_configuration(self) -> "Settings":
        if self.auth_cookie_samesite == "none" and not self.auth_cookie_secure:
            raise ValueError("auth_cookie_secure must be true when SameSite is 'none'")
        if self.environment == "production":
            if self.auth_session_secret.get_secret_value() == _DEVELOPMENT_SESSION_SECRET:
                raise ValueError("auth_session_secret must be changed in production")
            if not self.google_client_id or not self.google_client_secret:
                raise ValueError("Google OIDC credentials are required in production")
            if not self.google_client_secret.get_secret_value().strip():
                raise ValueError("Google OIDC credentials are required in production")
            if not self.auth_cookie_secure:
                raise ValueError("auth_cookie_secure must be true in production")
        return self

    @property
    def allowed_google_email_domains(self) -> tuple[str, ...]:
        """Return normalized domains used as an additional OIDC check."""

        return tuple(
            domain.strip().lower().lstrip("@")
            for domain in self.google_allowed_domains.split(",")
            if domain.strip()
        )

    @property
    def google_oidc_configured(self) -> bool:
        """Whether the application can perform the authorization-code flow."""

        return bool(
            self.google_client_id
            and self.google_client_secret
            and self.google_client_secret.get_secret_value().strip()
        )


@lru_cache
def get_settings() -> Settings:
    """Load settings once per process, allowing tests to clear the cache."""

    return Settings()
