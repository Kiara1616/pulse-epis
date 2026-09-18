"""Environment-based application settings."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_DEVELOPMENT_SESSION_SECRET = "development-only-change-me"
_DEVELOPMENT_ROSTER_SECRET = "development-only-roster-secret"
_DEVELOPMENT_EVIDENCE_SECRET = "development-only-evidence-secret"


class Settings(BaseSettings):
    """Non-secret settings needed to boot the API."""

    app_name: str = "Pulse EPIS API"
    app_version: str = "0.1.0"
    environment: Literal["development", "test", "staging", "production"] = "development"
    api_prefix: str = "/api/v1"
    cors_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
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
    roster_allowed_schools: str = "EPIS"
    roster_allowed_statuses: str = "ACTIVE,INACTIVE,GRADUATED"
    roster_pseudonym_secret: SecretStr = SecretStr(_DEVELOPMENT_ROSTER_SECRET)
    roster_max_bytes: int = 5_000_000
    roster_max_rows: int = 10_000
    evidence_storage_path: str = ".data/evidence"
    evidence_access_secret: SecretStr = SecretStr(_DEVELOPMENT_EVIDENCE_SECRET)
    evidence_access_ttl_seconds: int = 600
    evidence_max_bytes: int = 10_000_000
    evidence_retention_days: int = 1_825
    evidence_allowed_mime_types: str = "application/pdf,image/png,image/jpeg"

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

    @field_validator("cors_allowed_origins")
    @classmethod
    def normalize_cors_allowed_origins(cls, value: str) -> str:
        origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        if not origins or any(
            not origin.startswith(("http://", "https://")) or "/" in origin.split("://", 1)[1]
            for origin in origins
        ):
            raise ValueError("cors_allowed_origins must contain absolute origins without paths")
        return ",".join(dict.fromkeys(origins))

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
        if value.startswith("/") and not value.startswith("//"):
            return value
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.username is not None
            or parsed.password is not None
            or parsed.fragment
        ):
            raise ValueError("auth_success_redirect must be a relative path or HTTP(S) URL")
        return value

    @field_validator("roster_allowed_schools", "roster_allowed_statuses")
    @classmethod
    def normalize_roster_lists(cls, value: str) -> str:
        values = [item.strip() for item in value.split(",") if item.strip()]
        if not values:
            raise ValueError("roster configuration lists cannot be empty")
        return ",".join(dict.fromkeys(values))

    @field_validator("roster_max_bytes")
    @classmethod
    def validate_roster_max_bytes(cls, value: int) -> int:
        if value < 1024:
            raise ValueError("roster_max_bytes must be at least 1024 bytes")
        return value

    @field_validator("roster_max_rows")
    @classmethod
    def validate_roster_max_rows(cls, value: int) -> int:
        if value < 1:
            raise ValueError("roster_max_rows must be positive")
        return value

    @field_validator("evidence_storage_path")
    @classmethod
    def validate_evidence_storage_path(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("evidence_storage_path cannot be empty")
        return value

    @field_validator("evidence_access_ttl_seconds")
    @classmethod
    def validate_evidence_access_ttl(cls, value: int) -> int:
        if value < 60 or value > 3_600:
            raise ValueError("evidence_access_ttl_seconds must be between 60 and 3600")
        return value

    @field_validator("evidence_max_bytes")
    @classmethod
    def validate_evidence_max_bytes(cls, value: int) -> int:
        if value < 1_024:
            raise ValueError("evidence_max_bytes must be at least 1024 bytes")
        return value

    @field_validator("evidence_retention_days")
    @classmethod
    def validate_evidence_retention_days(cls, value: int) -> int:
        if value < 1:
            raise ValueError("evidence_retention_days must be positive")
        return value

    @field_validator("evidence_allowed_mime_types")
    @classmethod
    def normalize_evidence_mime_types(cls, value: str) -> str:
        values = [item.strip().lower() for item in value.split(",") if item.strip()]
        if not values or any("/" not in value or ";" in value for value in values):
            raise ValueError("evidence_allowed_mime_types must contain MIME types")
        return ",".join(dict.fromkeys(values))

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
            if self.roster_pseudonym_secret.get_secret_value() == _DEVELOPMENT_ROSTER_SECRET:
                raise ValueError("roster_pseudonym_secret must be changed in production")
            if self.evidence_access_secret.get_secret_value() == _DEVELOPMENT_EVIDENCE_SECRET:
                raise ValueError("evidence_access_secret must be changed in production")
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
    def allowed_cors_origins(self) -> tuple[str, ...]:
        """Return origins allowed to use the credentialed browser API."""

        return tuple(
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        )

    @property
    def google_oidc_configured(self) -> bool:
        """Whether the application can perform the authorization-code flow."""

        return bool(
            self.google_client_id
            and self.google_client_secret
            and self.google_client_secret.get_secret_value().strip()
        )

    @property
    def allowed_roster_schools(self) -> tuple[str, ...]:
        """Return configured school labels before parser normalization."""

        return tuple(item.strip() for item in self.roster_allowed_schools.split(","))

    @property
    def allowed_roster_statuses(self) -> tuple[str, ...]:
        """Return normalized status values accepted by the padrón import."""

        return tuple(item.strip().upper() for item in self.roster_allowed_statuses.split(","))

    @property
    def allowed_evidence_mime_types(self) -> tuple[str, ...]:
        """Return the MIME types accepted for private file evidence."""

        return tuple(
            item.strip().lower()
            for item in self.evidence_allowed_mime_types.split(",")
            if item.strip()
        )


@lru_cache
def get_settings() -> Settings:
    """Load settings once per process, allowing tests to clear the cache."""

    return Settings()
