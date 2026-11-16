from datetime import date

import pytest

from backend.app.core.config import Settings
from backend.app.integrations.apify import (
    normalize_linkedin_url,
    normalize_profile_certifications,
    normalize_publication_candidates,
)


def test_linkedin_url_is_canonical_and_rejects_non_profile_urls():
    assert normalize_linkedin_url(" https://linkedin.com/in/kiara-zapana/?trk=public ") == (
        "https://www.linkedin.com/in/kiara-zapana"
    )
    with pytest.raises(ValueError):
        normalize_linkedin_url("https://www.linkedin.com/company/epis")


def test_profile_certifications_are_normalized_for_validation():
    candidates = normalize_profile_certifications(
        {
            "certifications": [
                {
                    "name": "AWS Academy Graduate - Data Engineering",
                    "authority": "Amazon Web Services",
                    "issueDate": {"year": 2026, "month": 10},
                    "expirationDate": {"year": 2025, "month": 1},
                    "credentialId": "AWS-001",
                    "credentialUrl": "https://www.credly.com/badges/aws-001",
                    "skills": ["AWS", "Data Engineering"],
                }
            ]
        },
        profile_url="https://www.linkedin.com/in/kiara-zapana",
        today=date(2026, 11, 15),
    )

    assert len(candidates) == 1
    candidate = candidates[0]
    assert candidate.issuer_name == "Amazon Web Services"
    assert candidate.issued_on == date(2026, 10, 1)
    assert candidate.expires_on is None
    assert candidate.source_kind == "LINKEDIN_PROFILE"
    assert candidate.source_url == "https://www.credly.com/badges/aws-001"
    assert "AWS" in candidate.skills


def test_publications_only_create_candidates_for_credential_announcements():
    candidates = normalize_publication_candidates(
        [
            {
                "id": "activity-1",
                "text": "I completed my AWS certification in Data Engineering.",
                "url": "https://www.linkedin.com/posts/activity-1",
                "postedAt": "2026-10-20T12:00:00Z",
            },
            {
                "id": "activity-2",
                "text": "Compartiendo una foto del evento de la escuela.",
                "url": "https://www.linkedin.com/posts/activity-2",
            },
        ],
        profile_url="https://www.linkedin.com/in/kiara-zapana",
        today=date(2026, 11, 15),
    )

    assert len(candidates) == 1
    assert candidates[0].source_kind == "LINKEDIN_PUBLICATION"
    assert candidates[0].credential_name.startswith("Publicación de LinkedIn:")
    assert candidates[0].issuer_name == "AWS Skill Builder"


def test_apify_is_disabled_without_explicit_token():
    settings = Settings(environment="test", auth_session_secret="test")
    assert settings.apify_configured is False
    enabled_without_token = Settings(
        environment="test",
        auth_session_secret="test",
        apify_enabled=True,
    )
    assert enabled_without_token.apify_configured is False
