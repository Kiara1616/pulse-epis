from pathlib import Path

import pytest


COMPOSE = Path(__file__).parents[2] / "compose.yaml"


def test_compose_forwards_runtime_auth_and_browser_settings() -> None:
    if not COMPOSE.exists():
        pytest.skip("compose.yaml is not copied into the isolated backend image")

    compose = COMPOSE.read_text(encoding="utf-8")

    for variable in (
        "PULSE_API_PREFIX",
        "PULSE_CORS_ALLOWED_ORIGINS",
        "PULSE_GOOGLE_CLIENT_ID",
        "PULSE_GOOGLE_CLIENT_SECRET",
        "PULSE_GOOGLE_REDIRECT_URI",
        "PULSE_GOOGLE_ALLOWED_DOMAINS",
    ):
        assert f"{variable}:" in compose
