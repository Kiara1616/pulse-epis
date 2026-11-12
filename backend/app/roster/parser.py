"""Pure CSV parsing and validation for the authorized EPIS padrón."""

from __future__ import annotations

import csv
import io
import re
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath

from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException

from ..core.config import Settings
from ..auth.models import STUDENT_EMAIL_DOMAIN


ROSTER_COLUMNS = ("code", "email", "school", "plan", "cycle", "status", "period")
OPTIONAL_COLUMNS = ("name",)
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
    name: str = ""


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


@dataclass(frozen=True, slots=True)
class RosterCandidateRecord:
    source_row: int
    name: str
    cycle: str
    period: str
    email: str
    code: str
    issue_code: str


class RosterFileError(ValueError):
    """Safe, user-facing error for unsupported or malformed roster files."""


def _normalized_headers(values: tuple[object, ...] | list[object]) -> list[str]:
    return [normalize_label(str(value or "")).lower() for value in values]


def _valid_header_row(values: tuple[object, ...] | list[object]) -> bool:
    headers = _normalized_headers(values)
    expected = set(ROSTER_COLUMNS)
    allowed = expected | set(OPTIONAL_COLUMNS)
    return (
        len(headers) == len(set(headers))
        and expected.issubset(headers)
        and set(headers).issubset(allowed)
    )


def prepare_roster_upload(
    content: bytes, *, filename: str, settings: Settings
) -> tuple[bytes, int]:
    """Return CSV bytes and the source row number of the first record.

    The Excel parser only reads one visible worksheet whose header matches the
    roster contract. It does not import other workbook tabs such as summaries
    or pending-reconciliation lists.
    """

    if len(content) > settings.roster_max_bytes:
        raise RosterFileError("El archivo supera el tamaño permitido.")
    extension = PurePosixPath(filename.replace("\\", "/")).suffix.casefold()
    if extension == ".csv":
        return content, 2
    if extension != ".xlsx":
        raise RosterFileError("Selecciona un archivo CSV o un libro Excel .xlsx.")

    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            members = archive.infolist()
            if len(members) > 1000:
                raise RosterFileError("El libro Excel contiene demasiados componentes.")
            expanded_bytes = sum(item.file_size for item in members)
            if expanded_bytes > 50_000_000 or any(
                item.file_size / max(item.compress_size, 1) > 1000
                for item in members
            ):
                raise RosterFileError("El libro Excel supera los límites de lectura.")
            if "[Content_Types].xml" not in archive.namelist():
                raise RosterFileError("El archivo no tiene un formato Excel .xlsx válido.")

        workbook = load_workbook(
            io.BytesIO(content), read_only=True, data_only=True, keep_links=False
        )
    except RosterFileError:
        raise
    except (OSError, ValueError, zipfile.BadZipFile, InvalidFileException) as exc:
        raise RosterFileError("No se pudo leer el libro Excel .xlsx.") from exc

    try:
        matching_sheets: list[tuple[object, int, tuple[object, ...]]] = []
        for sheet in workbook.worksheets:
            if sheet.sheet_state != "visible":
                continue
            last_header_row = min(sheet.max_row or 0, 10)
            for row_index, row in enumerate(
                sheet.iter_rows(min_row=1, max_row=last_header_row, values_only=True),
                start=1,
            ):
                values = tuple(row)
                while values and values[-1] is None:
                    values = values[:-1]
                if _valid_header_row(values):
                    matching_sheets.append((sheet, row_index, values))
        if len(matching_sheets) != 1:
            raise RosterFileError(
                "El libro debe tener una sola hoja visible con las columnas del padrón."
            )

        sheet, header_row, header_values = matching_sheets[0]
        if (sheet.max_row or header_row) - header_row > settings.roster_max_rows + 100:
            raise RosterFileError("El libro Excel supera el límite de filas permitido.")

        output = io.StringIO(newline="")
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow([str(value).strip() for value in header_values])
        nonblank_rows = 0
        for row in sheet.iter_rows(
            min_row=header_row + 1,
            max_row=sheet.max_row or header_row,
            values_only=True,
        ):
            values = list(row)
            if any(value not in (None, "") for value in values[len(header_values) :]):
                raise RosterFileError("Hay datos fuera de las columnas del padrón.")
            values = values[: len(header_values)]
            if not any(value not in (None, "") for value in values):
                writer.writerow([])
                continue
            nonblank_rows += 1
            if nonblank_rows > settings.roster_max_rows:
                raise RosterFileError("El libro Excel supera el límite de filas permitido.")
            writer.writerow([_cell_text(value) for value in values])
        if nonblank_rows == 0:
            raise RosterFileError("La hoja del padrón no contiene registros.")
        return output.getvalue().encode("utf-8"), header_row + 1
    finally:
        workbook.close()


def _cell_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def parse_roster_candidate_upload(
    content: bytes,
    *,
    filename: str,
    period_code: str,
    settings: Settings,
) -> tuple[RosterCandidateRecord, ...]:
    """Read incomplete rows from a dedicated pending-reconciliation worksheet."""

    if len(content) > settings.roster_max_bytes:
        raise RosterFileError("El archivo supera el tamaño permitido.")
    extension = PurePosixPath(filename.replace("\\", "/")).suffix.casefold()
    if extension == ".xlsx":
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                members = archive.infolist()
                expanded_bytes = sum(item.file_size for item in members)
                if (
                    len(members) > 1000
                    or expanded_bytes > 50_000_000
                    or any(item.file_size / max(item.compress_size, 1) > 1000 for item in members)
                    or "[Content_Types].xml" not in archive.namelist()
                ):
                    raise RosterFileError("El libro Excel supera los límites de lectura.")
            workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True, keep_links=False)
        except RosterFileError:
            raise
        except (OSError, ValueError, zipfile.BadZipFile, InvalidFileException) as exc:
            raise RosterFileError("No se pudo leer el libro Excel .xlsx.") from exc

        try:
            matching: list[tuple[object, int, tuple[object, ...], dict[str, int]]] = []
            for sheet in workbook.worksheets:
                if sheet.sheet_state != "visible":
                    continue
                for header_row, row in enumerate(
                    sheet.iter_rows(min_row=1, max_row=min(sheet.max_row or 0, 10), values_only=True),
                    start=1,
                ):
                    headers = tuple(row)
                    while headers and headers[-1] is None:
                        headers = headers[:-1]
                    normalized = _normalized_headers(headers)
                    positions = {name: index for index, name in enumerate(normalized)}
                    if {"name", "period", "cycle"}.issubset(positions) and (
                        "issue_code" in positions or "source_row" in positions
                    ):
                        matching.append((sheet, header_row, headers, positions))
            if len(matching) != 1:
                raise RosterFileError(
                    "El libro debe tener una sola hoja visible de pendientes con nombre, periodo y ciclo."
                )
            sheet, header_row, headers, positions = matching[0]
            if (sheet.max_row or header_row) - header_row > settings.roster_max_rows + 100:
                raise RosterFileError("El libro Excel supera el límite de filas permitido.")
            records: list[RosterCandidateRecord] = []
            for excel_row, values in enumerate(
                sheet.iter_rows(min_row=header_row + 1, max_row=sheet.max_row or header_row, values_only=True),
                start=header_row + 1,
            ):
                if not any(value not in (None, "") for value in values):
                    continue
                if len(records) >= settings.roster_max_rows:
                    raise RosterFileError("El libro Excel supera el límite de filas permitido.")
                value = lambda key: _cell_text(values[positions[key]]) if key in positions and positions[key] < len(values) else ""
                row_period = normalize_text(value("period")).upper()
                if row_period != normalize_text(period_code).upper():
                    continue
                name = normalize_text(value("name"))
                if not name:
                    continue
                email = normalize_text(value("email"))
                code = normalize_text(value("proposed_code") or value("code"))
                issue = normalize_text(value("issue_code")).upper()
                if email and code and not issue:
                    continue
                try:
                    source_row = int(value("source_row")) if value("source_row") else excel_row
                except ValueError:
                    source_row = excel_row
                records.append(
                    RosterCandidateRecord(
                        source_row=source_row,
                        name=name[:200],
                        cycle=normalize_text(value("cycle"))[:32],
                        period=row_period,
                        email=email[:320],
                        code=code[:64],
                        issue_code=issue[:64] or "MISSING_ROSTER_FIELDS",
                    )
                )
            if not records:
                raise RosterFileError("La hoja no contiene pendientes para el periodo seleccionado.")
            return tuple(records)
        finally:
            workbook.close()

    if extension == ".csv":
        try:
            text = content.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text, newline=""), strict=True)
        except (UnicodeDecodeError, csv.Error) as exc:
            raise RosterFileError("El CSV debe estar codificado en UTF-8 y tener un encabezado válido.") from exc
        headers = reader.fieldnames or []
        normalized = _normalized_headers(headers)
        if not {"name", "period", "cycle"}.issubset(normalized):
            raise RosterFileError("El CSV de pendientes requiere las columnas name, period y cycle.")
        header_map = dict(zip(normalized, headers, strict=True))
        records = []
        for row_number, row in enumerate(reader, start=2):
            if row_number > settings.roster_max_rows + 1:
                raise RosterFileError("El CSV supera el límite de filas permitido.")
            if normalize_text(str(row.get(header_map["period"]) or "")).upper() != normalize_text(period_code).upper():
                continue
            name = normalize_text(str(row.get(header_map["name"]) or ""))
            if not name:
                continue
            email = normalize_text(str(row.get(header_map.get("email", "")) or ""))
            code_header = header_map.get("proposed_code", header_map.get("code", ""))
            code = normalize_text(str(row.get(code_header) or ""))
            issue_header = header_map.get("issue_code", "")
            issue = normalize_text(str(row.get(issue_header) or "")).upper()
            if email and code and not issue:
                continue
            records.append(
                RosterCandidateRecord(
                    source_row=row_number,
                    name=name[:200],
                    cycle=normalize_text(str(row.get(header_map["cycle"]) or ""))[:32],
                    period=normalize_text(period_code).upper(),
                    email=email[:320],
                    code=code[:64],
                    issue_code=issue[:64] or "MISSING_ROSTER_FIELDS",
                )
            )
        if not records:
            raise RosterFileError("El CSV no contiene pendientes para el periodo seleccionado.")
        return tuple(records)
    raise RosterFileError("Selecciona un Excel .xlsx o CSV de pendientes.")


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


def parse_roster_csv(
    content: bytes,
    *,
    period_code: str,
    settings: Settings,
    selected_period_only: bool = False,
    first_data_row: int = 2,
) -> ParsedRoster:
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
    normalized_headers = _normalized_headers(raw_headers)
    expected_headers = set(ROSTER_COLUMNS)
    if (
        len(normalized_headers) != len(set(normalized_headers))
        or not expected_headers.issubset(normalized_headers)
        or not set(normalized_headers).issubset(expected_headers | set(OPTIONAL_COLUMNS))
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
    source_rows = 0
    expected_period = normalize_text(period_code).casefold()
    allowed_domains = {STUDENT_EMAIL_DOMAIN}

    for row_number, raw_row in enumerate(reader, start=first_data_row):
        row = {
            field: normalize_text(str(raw_row.get(header_map[field]) or ""))
            for field in ROSTER_COLUMNS
        }
        name = normalize_text(str(raw_row.get(header_map["name"]) or "")) if "name" in header_map else ""
        if not any(row.values()):
            continue
        source_rows += 1
        if source_rows > settings.roster_max_rows:
            rejections.append(
                _rejection(
                    row_number,
                    "__file__",
                    "ROW_LIMIT_EXCEEDED",
                    "The CSV exceeds the configured row limit.",
                )
            )
            break

        if selected_period_only and row["period"].casefold() != expected_period:
            continue
        total_rows += 1

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
        if len(name) > 200:
            row_rejections.append(_rejection(row_number, "name", "INVALID_NAME", "Student name exceeds 200 characters."))
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
                name=name,
            )
        )

    if total_rows == 0 and not rejections:
        rejections.append(
            _rejection(0, "__file__", "NO_DATA_ROWS", "The CSV does not contain data rows.")
        )
    return ParsedRoster(tuple(records), tuple(rejections), total_rows)
