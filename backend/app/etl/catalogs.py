"""Small, versioned catalog normalizers used by the analytical pipeline."""

from __future__ import annotations

import re


_WHITESPACE = re.compile(r"\s+")

_ISSUER_ALIASES = {
    "amazon web services": "AWS",
    "amazon web services training and certification": "AWS",
    "aws": "AWS",
    "cisco": "Cisco",
    "cisco networking academy": "Cisco",
    "microsoft": "Microsoft",
    "microsoft learn": "Microsoft",
}

_LEVEL_ALIASES = {
    "fundamental": "Fundamentals",
    "fundamentals": "Fundamentals",
    "beginner": "Fundamentals",
    "associate": "Associate",
    "professional": "Professional",
    "expert": "Professional",
    "advanced": "Professional",
}


def normalize_text(value: str | None) -> str:
    """Trim and collapse whitespace without changing the source semantics."""

    return _WHITESPACE.sub(" ", value or "").strip()


def normalize_issuer_name(value: str | None) -> str:
    """Return the canonical dashboard label for an issuer."""

    normalized = normalize_text(value)
    return _ISSUER_ALIASES.get(normalized.casefold(), normalized)


def normalize_level(value: str | None, credential_name: str | None = None) -> str:
    """Normalize catalog values and infer a level only from the credential name."""

    normalized = normalize_text(value)
    if normalized:
        direct = _LEVEL_ALIASES.get(normalized.casefold())
        if direct:
            return direct

    name = normalize_text(credential_name).casefold()
    if "fundamental" in name or "practitioner" in name:
        return "Fundamentals"
    if "associate" in name:
        return "Associate"
    if any(token in name for token in ("professional", "expert", "advanced")):
        return "Professional"
    return "Other"


def normalize_skill_name(value: str | None) -> str:
    """Normalize a skill label while preserving the catalog's human-readable case."""

    return normalize_text(value)
