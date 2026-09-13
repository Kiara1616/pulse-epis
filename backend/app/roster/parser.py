"""Pure CSV parsing and validation for the authorized EPIS padrón."""

from __future__ import annotations

import csv
import io
import re
import unicodedata
from dataclasses import dataclass

from ..core.config import Settings


ROSTER_COLUMNS = ("code", "email", "school", "plan", "cycle", "status", "period")
_CODE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$")
_EMAIL_PATTERN = re.compile(r"^[^@\s]{1,254}@[^@\s]{1,253}$")
_STATUS_ALIASES = {
    "ACTIVO": "ACTIVE",
    "ACTIVE": "ACTIVE",
    "INACTIVO": "INACTIVE",
    "INACTIVE": "INACTIVE",
    "GRADUADO": "GRADUATED",
    "EGRESADO": "GRADUATED",
    "GRADUATED": "GRADUATED",
}


@dataclass(frozen=True, slots=True)
class RosterRecord:
    """Validated data that is safe for the persistence layer to consume."""

    code: str
    email: str
    school: str
    plan: str
    cycle: str
    status: str
    period: str
    row_number: int


@dataclass(frozen=True, slots=True)
class RosterRejection:
    """A rejection deliberately containing no raw CSV value or PII."""

    row_number: int
    field_name: str
    reason_code: str
    message: str


@dataclass(frozen=True, slots=True)
class ParsedRoster:
    records: tuple[RosterRecord, ...]
    rejections: tuple[RosterRejection, ...]
    total_rows: int


def normalize_label(value: str) -> str:
    """Normalize labels for comparisons without retaining their original form."""

    decomposed = unicodedata.normalize("NFKD", value)
    without_marks = "".join(
        character for character in decomposed if not unicodedata.combining(character)
    )
    return " ".join(without_marks.strip().split()).upper()


def normalize_text(value: str) -> str:
    """Collapse whitespace while preserving the human-readable field value."""

    return " ".join(value.strip().split())


def _rejection(row_number: int, field_name: str, reason_code: str, message: str) -> RosterRejection:
    return RosterRejection(row_number, field_name, reason_code, message)


def _file_rejection(reason_code: str, message: str) -> ParsedRoster:
    return ParsedRoster(
        records=(),
        rejections=(_rejection(0, "__file__", reason_code, message),),
        total_rows=0,
    )


def _canonical_school(value: str, settings: Settings) -> str | None:
    normalized = normalize_label(value)
    configured = {
        normalize_label(school): normalize_text(school)
        for school in settings.allowed_roster_schools
    }
    return configured.get(normalized)


def _canonical_status(value: str, settings: Settings) -> str | None:
    normalized = _STATUS_ALIASES.get(normalize_label(value), normalize_label(value))
    return normalized if normalized in settings.allowed_roster_statuses else None


def parse_roster_csv(content: bytes, *, period_code: str, settings: Settings) -> ParsedRoster:
    """Parse a UTF-8 CSV and return valid rows plus non-sensitive rejection reasons."""

    if len(content) > settings.roster_max_bytes:
        return _file_rejection(
            "FILE_TOO_LARGE",
            "The CSV exceeds the configured size limit.",
        )
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return _file_rejection(
            "INVALID_ENCODING",
            "The CSV must be encoded as UTF-8.",
        )

    reader = csv.DictReader(io.StringIO(text, newline=""))
    raw_headers = reader.fieldnames
    if not raw_headers:
        return _file_rejection(
            "MISSING_HEADERS",
            "The CSV must include the documented header row.",
        )
    normalized_headers = [normalize_label(header or "").lower() for header in raw_headers]
    expected_headers = set(ROSTER_COLUMNS)
    if (
        len(normalized_headers) != len(set(normalized_headers))
        or set(normalized_headers) != expected_headers
    ):
        return _file_rejection(
            "INVALID_HEADERS",
            "The CSV headers do not match the documented template.",
        )
    header_map = dict(zip(normalized_headers, raw_headers, strict=True))

    records: list[RosterRecord] = []
    rejections: list[RosterRejection] = []
    seen_codes: set[str] = set()
    seen_emails: set[str] = set()
    total_rows = 0
    expected_period = normalize_text(period_code).casefold()
    allowed_domains = set(settings.allowed_google_email_domains)

    for row_number, raw_row in enumerate(reader, start=2):
        row = {
            field: normalize_text(str(raw_row.get(header_map[field]) or ""))
            for field in ROSTER_COLUMNS
        }
        if not any(row.values()):
            continue
        total_rows += 1
        if total_rows > settings.roster_max_rows:
            rejections.append(
                _rejection(
                    row_number,
                    "__file__",
                    "ROW_LIMIT_EXCEEDED",
                    "The CSV exceeds the configured row limit.",
                )
            )
            break

        if None in raw_row:
            rejections.append(
                _rejection(
                    row_number,
                    "__row__",
                    "INVALID_ROW",
                    "Each data row must contain exactly the documented columns.",
                )
            )
            continue

        row_rejections: list[RosterRejection] = []
        code = row["code"].casefold()
        if not code:
            row_rejections.append(
                _rejection(row_number, "code", "REQUIRED_FIELD", "Student code is required.")
            )
        elif not _CODE_PATTERN.fullmatch(row["code"]):
            row_rejections.append(
                _rejection(row_number, "code", "INVALID_CODE", "Student code format is invalid.")
            )
        elif code in seen_codes:
            row_rejections.append(
                _rejection(row_number, "code", "DUPLICATE_CODE", "Student code is duplicated in the file.")
            )

        email = row["email"].casefold()
        if not email:
            row_rejections.append(
                _rejection(row_number, "email", "REQUIRED_FIELD", "Institutional email is required.")
            )
        elif not _EMAIL_PATTERN.fullmatch(email) or len(email) > 320:
            row_rejections.append(
                _rejection(row_number, "email", "INVALID_EMAIL", "Email format is invalid.")
            )
        elif email.rsplit("@", 1)[-1] not in allowed_domains:
            row_rejections.append(
                _rejection(
                    row_number,
                    "email",
                    "EMAIL_DOMAIN_NOT_ALLOWED",
                    "Email domain is not configured for the institution.",
                )
            )
        elif email in seen_emails:
            row_rejections.append(
                _rejection(row_number, "email", "DUPLICATE_EMAIL", "Email is duplicated in the file.")
            )

        school = _canonical_school(row["school"], settings)
        if not school:
            row_rejections.append(
                _rejection(
                    row_number,
                    "school",
                    "INVALID_SCHOOL",
                    "School is not authorized for this import.",
                )
            )

        plan = row["plan"]
        if not plan or len(plan) > 120:
            row_rejections.append(
                _rejection(row_number, "plan", "INVALID_PLAN", "Study plan is invalid.")
            )

        cycle = row["cycle"]
        if not cycle or len(cycle) > 32:
            row_rejections.append(
                _rejection(row_number, "cycle", "INVALID_CYCLE", "Academic cycle is invalid.")
            )

        status = _canonical_status(row["status"], settings)
        if not status:
            row_rejections.append(
                _rejection(row_number, "status", "INVALID_STATUS", "Student status is not allowed.")
            )

        if not row["period"] or row["period"].casefold() != expected_period:
            row_rejections.append(
                _rejection(
                    row_number,
                    "period",
                    "PERIOD_MISMATCH",
                    "Row period does not match the import period.",
                )
            )

        if row_rejections:
            rejections.extend(row_rejections)
            continue

        seen_codes.add(code)
        seen_emails.add(email)
        records.append(
            RosterRecord(
                code=code,
                email=email,
                school=school,
                plan=plan,
                cycle=cycle,
                status=status,
                period=row["period"],
                row_number=row_number,
            )
        )

    if total_rows == 0 and not rejections:
        rejections.append(
            _rejection(0, "__file__", "NO_DATA_ROWS", "The CSV does not contain data rows.")
        )
    return ParsedRoster(tuple(records), tuple(rejections), total_rows)
