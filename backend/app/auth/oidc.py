"""Google OpenID Connect authorization-code client."""

from __future__ import annotations

from typing import Any, Mapping, Protocol
from urllib.parse import urlencode

import requests
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token

from ..core.config import Settings
from .models import GoogleIdentity


GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
GOOGLE_SCOPE = "openid email profile"


class OidcConfigurationError(RuntimeError):
    """The server is missing the credentials needed to start OIDC."""


class OidcProviderError(RuntimeError):
    """The authorization-code exchange failed at the provider."""


class OidcVerificationError(RuntimeError):
    """The ID token was invalid or failed a required OIDC claim check."""


class OidcClient(Protocol):
    @property
    def configured(self) -> bool:
        """Whether the client can perform an authorization-code flow."""

    def authorization_url(self, *, state: str, nonce: str) -> str:
        """Build the provider URL without requesting Gmail access."""

    def exchange_code(self, code: str) -> str:
        """Exchange a one-time authorization code for an ID token."""

    def verify_id_token(self, encoded_token: str, *, expected_nonce: str) -> GoogleIdentity:
        """Verify signature, issuer, audience, expiry, nonce and identity claims."""


class GoogleOidcClient:
    """Minimal Google OIDC client restricted to identity scopes."""

    def __init__(self, settings: Settings, *, timeout_seconds: float = 10.0) -> None:
        self._settings = settings
        self._timeout_seconds = timeout_seconds

    @property
    def configured(self) -> bool:
        return self._settings.google_oidc_configured

    def _require_configuration(self) -> tuple[str, str]:
        client_id = self._settings.google_client_id
        client_secret = self._settings.google_client_secret
        if not client_id or not client_secret or not client_secret.get_secret_value().strip():
            raise OidcConfigurationError("Google OIDC credentials are not configured")
        return client_id, client_secret.get_secret_value()

    def authorization_url(self, *, state: str, nonce: str) -> str:
        client_id, _ = self._require_configuration()
        query = urlencode(
            {
                "client_id": client_id,
                "redirect_uri": self._settings.google_redirect_uri,
                "response_type": "code",
                "scope": GOOGLE_SCOPE,
                "state": state,
                "nonce": nonce,
                "prompt": "select_account",
            }
        )
        return f"{GOOGLE_AUTHORIZATION_ENDPOINT}?{query}"

    def exchange_code(self, code: str) -> str:
        client_id, client_secret = self._require_configuration()
        try:
            response = requests.post(
                GOOGLE_TOKEN_ENDPOINT,
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": self._settings.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise OidcProviderError("Google token exchange failed") from exc
        if not isinstance(payload, Mapping) or not isinstance(payload.get("id_token"), str):
            raise OidcProviderError("Google did not return an ID token")
        return payload["id_token"]

    def verify_id_token(self, encoded_token: str, *, expected_nonce: str) -> GoogleIdentity:
        client_id, _ = self._require_configuration()
        try:
            claims: Mapping[str, Any] = id_token.verify_oauth2_token(
                encoded_token,
                GoogleAuthRequest(),
                client_id,
            )
        except (TypeError, ValueError) as exc:
            raise OidcVerificationError("Google ID token could not be verified") from exc

        if claims.get("iss") not in GOOGLE_ISSUERS:
            raise OidcVerificationError("Google ID token issuer is invalid")
        audience = claims.get("aud")
        audiences = {audience} if isinstance(audience, str) else set(audience or [])
        if client_id not in audiences:
            raise OidcVerificationError("Google ID token audience is invalid")
        if claims.get("nonce") != expected_nonce:
            raise OidcVerificationError("Google ID token nonce is invalid")

        subject = claims.get("sub")
        email = claims.get("email")
        if not isinstance(subject, str) or not subject.strip():
            raise OidcVerificationError("Google ID token has no subject")
        if not isinstance(email, str) or not email.strip():
            raise OidcVerificationError("Google ID token has no email")

        email_verified = claims.get("email_verified") is True
        if not email_verified:
            raise OidcVerificationError("Google email is not verified")
        return GoogleIdentity(
            subject=subject,
            email=email,
            email_verified=email_verified,
            nonce=claims.get("nonce") if isinstance(claims.get("nonce"), str) else None,
        )


__all__ = [
    "GOOGLE_AUTHORIZATION_ENDPOINT",
    "GOOGLE_SCOPE",
    "GoogleOidcClient",
    "OidcClient",
    "OidcConfigurationError",
    "OidcProviderError",
    "OidcVerificationError",
]
