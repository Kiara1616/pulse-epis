"""Small, server-side client and normalizers for the Apify LinkedIn actors.

The actors return public profile/post data.  This module deliberately keeps the
Apify token on the API server and converts only the fields needed for a human
validation queue.  Raw actor responses are not stored in Pulse.
"""

from __future__ import annotations

import hashlib
import logging
import re
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Mapping, Sequence
from urllib.parse import quote, urlsplit

import requests

from ..core.config import Settings


logger = logging.getLogger(__name__)
APIFY_API = "https://api.apify.com/v2"
_TERMINAL_STATUSES = {"SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"}
_CREDENTIAL_TERMS = (
    "certificat",
    "certificad",
    "certificaci",
    "credential",
    "credencial",
    "badge",
    "training badge",
    "licencia",
    "license",
    "acreditad",
    "completé el curso",
    "completed the course",
    "curso completado",
    "finalicé",
    "finalizado",
    "obtuv",
    "obten",
    "obtained",
    "earned",
    "achievement",
    "logro",
    "aprobé",
    "aprobado",
    "passed",
)
_ISSUER_ALIASES = (
    ("AWS Skill Builder", ("aws skill builder", "amazon web services", "aws academy", "aws")),
    ("Cisco Networking Academy", ("cisco networking academy", "cisco")),
    ("Microsoft Learn", ("microsoft learn", "microsoft")),
    ("Google Cloud Skills Boost", ("google cloud", "skills boost", "google")),
    ("Oracle University", ("oracle university", "oracle")),
    ("DataCamp", ("datacamp", "data camp")),
    ("Credly", ("credly",)),
    ("Coursera", ("coursera",)),
    ("edX", ("edx",)),
)
_SKILL_TERMS = (
    "python", "sql", "aws", "azure", "google cloud", "data engineering",
    "data pipelines", "etl", "pyspark", "airflow", "docker", "kubernetes",
    "linux", "cybersecurity", "machine learning", "pandas", "java",
)


class ApifyIntegrationError(RuntimeError):
    """A safe, user-facing error from the Apify API or an actor run."""


@dataclass(frozen=True, slots=True)
class ApifyRunResult:
    items: tuple[dict[str, Any], ...]
    run_id: str


@dataclass(frozen=True, slots=True)
class LinkedInCandidate:
    """Normalized candidate ready to enter Pulse as PENDING."""

    credential_name: str
    issuer_name: str
    issuer_url: str | None
    issued_on: date
    expires_on: date | None
    source_url: str
    external_id: str
    source_kind: str
    source_external_id: str
    skills: tuple[str, ...]


def normalize_linkedin_url(value: str | None) -> str | None:
    """Accept only a public LinkedIn profile URL and return a canonical form."""

    if value is None:
        return None
    raw = " ".join(str(value).strip().split())
    if not raw:
        return None
    parsed = urlsplit(raw)
    host = (parsed.hostname or "").casefold()
    if (
        parsed.scheme.casefold() not in {"http", "https"}
        or host not in {"linkedin.com", "www.linkedin.com"}
        or parsed.username is not None
        or parsed.password is not None
        or not parsed.path.casefold().startswith("/in/")
        or len(raw) > 2048
    ):
        raise ValueError("La URL debe apuntar a un perfil público de LinkedIn (/in/).")
    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) != 2 or segments[0].casefold() != "in" or not segments[1]:
        raise ValueError("La URL debe apuntar a un perfil público de LinkedIn (/in/).")
    return f"https://www.linkedin.com/in/{segments[1]}"


class ApifyClient:
    """Minimal REST client using the actor run and dataset APIs."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _token(self) -> str:
        if not self._settings.apify_configured:
            raise ApifyIntegrationError("La integración de Apify no está configurada.")
        assert self._settings.apify_api_token is not None
        return self._settings.apify_api_token.get_secret_value().strip()

    @staticmethod
    def _actor_path(actor_id: str) -> str:
        return quote(actor_id.strip(), safe="~")

    @staticmethod
    def _payload(response: requests.Response) -> Mapping[str, Any]:
        try:
            payload = response.json()
        except ValueError as exc:
            raise ApifyIntegrationError("Apify devolvió una respuesta no válida.") from exc
        if not isinstance(payload, Mapping):
            raise ApifyIntegrationError("Apify devolvió un formato inesperado.")
        return payload

    def run_actor(self, actor_id: str, actor_input: Mapping[str, Any]) -> ApifyRunResult:
        token = self._token()
        endpoint = f"{APIFY_API}/acts/{self._actor_path(actor_id)}/runs"
        try:
            response = requests.post(
                endpoint,
                params={
                    "token": token,
                    "waitForFinish": str(self._settings.apify_run_timeout_seconds),
                },
                json=dict(actor_input),
                timeout=self._settings.apify_run_timeout_seconds + 15,
            )
            response.raise_for_status()
            payload = self._payload(response)
        except requests.RequestException as exc:
            logger.warning("Apify actor could not be started actor=%s", actor_id)
            raise ApifyIntegrationError("No se pudo iniciar la consulta en Apify.") from exc

        data = payload.get("data", payload)
        if not isinstance(data, Mapping):
            raise ApifyIntegrationError("Apify no devolvió los datos de ejecución.")
        run_id = str(data.get("id") or "")
        if not run_id:
            raise ApifyIntegrationError("Apify no devolvió el identificador de ejecución.")
        status = str(data.get("status") or "").upper()
        deadline = time.monotonic() + self._settings.apify_run_timeout_seconds
        while status not in _TERMINAL_STATUSES and time.monotonic() < deadline:
            time.sleep(1)
            try:
                status_response = requests.get(
                    f"{APIFY_API}/actor-runs/{quote(run_id, safe='')}",
                    params={"token": token},
                    timeout=15,
                )
                status_response.raise_for_status()
                status_payload = self._payload(status_response)
            except requests.RequestException as exc:
                raise ApifyIntegrationError("No se pudo consultar el estado de Apify.") from exc
            data = status_payload.get("data", status_payload)
            if not isinstance(data, Mapping):
                raise ApifyIntegrationError("Apify devolvió un estado inesperado.")
            status = str(data.get("status") or "").upper()

        if status != "SUCCEEDED":
            if status not in _TERMINAL_STATUSES:
                raise ApifyIntegrationError("La consulta de LinkedIn sigue procesándose; inténtalo nuevamente.")
            raise ApifyIntegrationError(f"La consulta de LinkedIn terminó con estado {status or 'desconocido'}.")

        dataset_id = str(data.get("defaultDatasetId") or "")
        if not dataset_id:
            raise ApifyIntegrationError("Apify no devolvió un conjunto de resultados.")
        try:
            dataset_response = requests.get(
                f"{APIFY_API}/datasets/{quote(dataset_id, safe='')}/items",
                params={"token": token, "clean": "1", "format": "json", "limit": "1000"},
                timeout=30,
            )
            dataset_response.raise_for_status()
            dataset_payload = dataset_response.json()
        except (requests.RequestException, ValueError) as exc:
            raise ApifyIntegrationError("No se pudieron leer los resultados de Apify.") from exc
        items = dataset_payload.get("items") if isinstance(dataset_payload, Mapping) else dataset_payload
        if not isinstance(items, Sequence) or isinstance(items, (str, bytes)):
            raise ApifyIntegrationError("Apify devolvió resultados con formato inesperado.")
        return ApifyRunResult(
            items=tuple(item for item in items if isinstance(item, dict)),
            run_id=run_id,
        )


def _first(item: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        value = item.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def _as_items(value: Any) -> list[Mapping[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, Mapping)]
    if isinstance(value, Mapping):
        return [value]
    return []


def _clean(value: Any, maximum: int = 200) -> str:
    return " ".join(str(value or "").strip().split())[:maximum]



_MONTH_ALIASES = {
    "jan": 1, "january": 1, "ene": 1, "enero": 1,
    "feb": 2, "february": 2, "febrero": 2,
    "mar": 3, "march": 3, "marzo": 3,
    "apr": 4, "april": 4, "abr": 4, "abril": 4,
    "may": 5, "mayo": 5,
    "jun": 6, "june": 6, "junio": 6,
    "jul": 7, "july": 7, "julio": 7,
    "aug": 8, "august": 8, "ago": 8, "agosto": 8,
    "sep": 9, "sept": 9, "september": 9,
    "set": 9, "septiembre": 9, "setiembre": 9,
    "oct": 10, "october": 10, "octubre": 10,
    "nov": 11, "november": 11, "noviembre": 11,
    "dec": 12, "december": 12, "dic": 12, "diciembre": 12,
}

def _parse_date(value: Any, fallback: date) -> date:
    if isinstance(value, Mapping):
        direct = _first(value, "date", "text", "iso", "value")
        if direct not in (None, "", [], {}):
            value = direct
        else:
            year = _first(value, "year", "yyyy")
            if year is not None:
                try:
                    value = f"{int(year):04d}-{int(_first(value, 'month', 'mm') or 1):02d}-{int(_first(value, 'day', 'dd') or 1):02d}"
                except (TypeError, ValueError):
                    return fallback
            else:
                value = None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value / 1000 if value > 10_000_000_000 else value, tz=timezone.utc).date()
        except (OverflowError, OSError, ValueError):
            return fallback
    text = _clean(value, 40)
    if not text:
        return fallback
    month_names = "|".join(sorted(_MONTH_ALIASES, key=len, reverse=True))
    named_month = re.search(
        rf"\b(?:(?P<month>{month_names})[\s,./-]+(?P<year>20\d{{2}})|(?P<year2>20\d{{2}})[\s,./-]+(?P<month2>{month_names}))\b",
        text,
        flags=re.IGNORECASE,
    )
    if named_month:
        month_name = (named_month.group("month") or named_month.group("month2")).casefold()
        year = int(named_month.group("year") or named_month.group("year2"))
        try:
            return date(year, _MONTH_ALIASES[month_name], 1)
        except (KeyError, ValueError):
            return fallback
    match = re.search(r"(20\d{2})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?", text)
    if match:
        year = int(match.group(1))
        month = int(match.group(2) or 1)
        day = int(match.group(3) or 1)
        try:
            return date(year, month, day)
        except ValueError:
            return fallback
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return fallback


def _url(value: Any) -> str | None:
    text = _clean(value, 2048)
    if not text:
        return None
    parsed = urlsplit(text)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        return None
    return text


def _same_url(left: str | None, right: str | None) -> bool:
    """Compare links without query strings or a trailing slash."""

    left_url = _url(left)
    right_url = _url(right)
    if left_url is None or right_url is None:
        return False
    left_parts = urlsplit(left_url)
    right_parts = urlsplit(right_url)
    return (
        left_parts.scheme.casefold(),
        (left_parts.hostname or "").casefold(),
        left_parts.path.rstrip("/").casefold(),
    ) == (
        right_parts.scheme.casefold(),
        (right_parts.hostname or "").casefold(),
        right_parts.path.rstrip("/").casefold(),
    )


def _nested_mappings(item: Mapping[str, Any], *keys: str) -> tuple[Mapping[str, Any], ...]:
    """Return the item plus common nested credential objects used by actors."""

    nested: list[Mapping[str, Any]] = [item]
    for key in keys:
        value = item.get(key)
        if isinstance(value, Mapping):
            nested.append(value)
    return tuple(nested)


def _specific_source_url(item: Mapping[str, Any], *, profile_url: str) -> str:
    """Prefer a credential/post permalink over the actor's generic profile URL."""

    containers = _nested_mappings(
        item,
        "credential",
        "certificate",
        "certification",
        "badge",
        "license",
        "details",
    )
    # These fields identify the credential itself.  They must be checked before
    # generic ``url`` fields because some actors expose the profile URL there.
    direct_keys = (
        "credentialUrl",
        "credentialURL",
        "credential_url",
        "verificationUrl",
        "verificationURL",
        "verification_url",
        "certificateUrl",
        "certificateURL",
        "certificate_url",
        "badgeUrl",
        "badgeURL",
        "badge_url",
        "licenseUrl",
        "licenseURL",
        "license_url",
        "verificationLink",
        "verification_link",
        "permalink",
        "permalinkUrl",
        "permalink_url",
        "shareUrl",
        "share_url",
    )
    for key in direct_keys:
        for container in containers:
            candidate = _url(container.get(key))
            if candidate is not None and not _same_url(candidate, profile_url):
                return candidate

    # ``url`` is useful for actors that return the direct badge/post URL, but a
    # profile URL is only a reference and must not replace a specific link.
    generic_keys = (
        "url",
        "linkedinUrl",
        "linkedinURL",
        "linkedin_url",
        "activityUrl",
        "activityURL",
        "activity_url",
        "postUrl",
        "postURL",
        "post_url",
        "link",
        "href",
    )
    for key in generic_keys:
        for container in containers:
            candidate = _url(container.get(key))
            if candidate is not None and not _same_url(candidate, profile_url):
                return candidate
    return profile_url


def _fingerprint(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:40]


def _issuer_from_text(text: str, default: str) -> str:
    lowered = text.casefold()
    for issuer, aliases in _ISSUER_ALIASES:
        if any(alias in lowered for alias in aliases):
            return issuer
    return default


def _skills_from_text(text: str, explicit: Any = None) -> tuple[str, ...]:
    found: list[str] = []
    for item in _as_items(explicit):
        candidate = _clean(_first(item, "name", "skill", "title") if isinstance(item, Mapping) else item, 150)
        if candidate:
            found.append(candidate)
    if isinstance(explicit, list):
        found.extend(_clean(item, 150) for item in explicit if isinstance(item, str))
    lowered = text.casefold()
    for term in _SKILL_TERMS:
        if term in lowered:
            found.append(term.title() if term != "sql" else "SQL")
    return tuple(dict.fromkeys(item for item in found if item))[:20]


def normalize_profile_certifications(
    profile: Mapping[str, Any],
    *,
    profile_url: str,
    today: date | None = None,
) -> tuple[LinkedInCandidate, ...]:
    """Map the profile actor's certifications/licenses to review candidates."""

    today = today or date.today()
    raw = _first(profile, "certifications", "licensesAndCertifications", "licenses_and_certifications")
    if raw is None and isinstance(profile.get("profile"), Mapping):
        raw = _first(profile["profile"], "certifications", "licensesAndCertifications")
    candidates: list[LinkedInCandidate] = []
    for item in _as_items(raw):
        name = _clean(_first(item, "name", "title", "credentialName", "certificateName"))
        if not name:
            continue
        issuer = _clean(
            _first(
                item,
                # HarvestAPI's current actor schema uses issuedBy.
                "issuedBy",
                "authority",
                "issuer",
                "organization",
                "organizationName",
            ),
            150,
        ) or "Por confirmar"
        source_url = _specific_source_url(item, profile_url=profile_url)
        external = _clean(_first(item, "licenseNumber", "credentialId", "id"), 200)
        # Keep the identity stable when a later sync enriches the same profile
        # record with a direct Credly/issuer verification URL.
        external = f"linkedin-profile:{_fingerprint(profile_url, external or name)}"
        full_text = " ".join((_clean(name), _clean(issuer), _clean(_first(item, "description", "skills"))))
        issued_on = _parse_date(
            _first(item, "issuedAt", "issueDate", "issuedOn", "date"),
            today,
        )
        expires_on = (
            _parse_date(_first(item, "expirationDate", "expiresOn"), today)
            if _first(item, "expirationDate", "expiresOn")
            else None
        )
        # Some public profiles expose only a year or an invalid expiration.
        # Never send an impossible interval to the certification domain.
        if expires_on is not None and expires_on < issued_on:
            expires_on = None
        candidates.append(
            LinkedInCandidate(
                credential_name=name,
                issuer_name=issuer,
                issuer_url=_url(
                    _first(
                        item,
                        # HarvestAPI exposes the issuer's LinkedIn page here.
                        "issuedByLink",
                        "authorityUrl",
                        "issuerUrl",
                        "website",
                    )
                ),
                issued_on=issued_on,
                expires_on=expires_on,
                source_url=source_url,
                external_id=external,
                source_kind="LINKEDIN_PROFILE",
                source_external_id=external,
                skills=_skills_from_text(full_text, _first(item, "skills", "skill")),
            )
        )
    return tuple(candidates)


def normalize_publication_candidates(
    posts: Sequence[Mapping[str, Any]],
    *,
    profile_url: str,
    today: date | None = None,
) -> tuple[LinkedInCandidate, ...]:
    """Keep only posts that plausibly announce a credential for review."""

    today = today or date.today()
    result: list[LinkedInCandidate] = []
    seen: set[str] = set()
    for post in posts:
        content = _clean(_first(post, "content", "text", "commentary"), 2000)
        if not content or not any(term in content.casefold() for term in _CREDENTIAL_TERMS):
            continue
        source_url = _specific_source_url(post, profile_url=profile_url)
        if source_url is None or _same_url(source_url, profile_url):
            continue
        external = _clean(_first(post, "id", "activityId"), 200)
        external = f"linkedin-post:{_fingerprint(profile_url, external or source_url)}"
        if external in seen:
            continue
        seen.add(external)
        first_line = next((line.strip() for line in content.splitlines() if line.strip()), content)
        title = _clean(first_line, 180)
        if len(content) > len(title):
            title = title.rstrip(" .") + "…"
        issuer = _issuer_from_text(content, "Por confirmar")
        result.append(
            LinkedInCandidate(
                credential_name=f"Publicación de LinkedIn: {title}",
                issuer_name=issuer,
                issuer_url=None,
                issued_on=_parse_date(_first(post, "postedAt", "date", "publishedAt"), today),
                expires_on=None,
                source_url=source_url,
                external_id=external,
                source_kind="LINKEDIN_PUBLICATION",
                source_external_id=external,
                skills=_skills_from_text(content),
            )
        )
    return tuple(result)


__all__ = [
    "ApifyClient",
    "ApifyIntegrationError",
    "ApifyRunResult",
    "LinkedInCandidate",
    "normalize_linkedin_url",
    "normalize_profile_certifications",
    "normalize_publication_candidates",
]
