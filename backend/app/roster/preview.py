"""Inspect period counts without returning student data."""
import csv
import io
import re

from ..core.config import Settings
from .parser import (
    OPTIONAL_COLUMNS,
    ROSTER_COLUMNS,
    normalize_label,
    normalize_text,
    prepare_roster_upload,
)


def preview_periods(
    content: bytes, settings: Settings, filename: str = "roster.csv"
) -> list[dict]:
    try:
        prepared, _ = prepare_roster_upload(
            content, filename=filename, settings=settings
        )
        text = prepared.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Guarda el CSV con codificación UTF-8.") from exc
    reader = csv.DictReader(io.StringIO(text, newline=""), strict=True)
    headers = reader.fieldnames or []
    normalized = [normalize_label(h).lower() for h in headers]
    expected = set(ROSTER_COLUMNS)
    allowed = expected | set(OPTIONAL_COLUMNS)
    if (
        len(normalized) != len(set(normalized))
        or not expected.issubset(normalized)
        or not set(normalized).issubset(allowed)
    ):
        raise ValueError(
            "El archivo debe incluir: code, email, school, plan, cycle, status y period. "
            "La columna name es opcional. En Excel, usa una sola hoja visible con esos encabezados."
        )
    period_header = headers[normalized.index("period")]
    counts: dict[str, int] = {}
    total = 0
    try:
        for row in reader:
            if not any(row.values()):
                continue
            total += 1
            if total > settings.roster_max_rows:
                raise ValueError("El CSV supera el límite de filas permitido.")
            if None in row or any(v is None for v in row.values()):
                raise ValueError("Hay filas con un número incorrecto de columnas.")
            code = normalize_text(row[period_header]).upper()
            if not re.fullmatch(r"20\d{2}-(?:I|II)", code):
                raise ValueError("Cada fila debe indicar un periodo válido, por ejemplo 2025-II.")
            counts[code] = counts.get(code, 0) + 1
    except csv.Error as exc:
        raise ValueError("El archivo no es un CSV válido.") from exc
    if not counts:
        raise ValueError("El CSV no contiene registros.")
    return [{"code": code, "rows": counts[code]} for code in sorted(counts, reverse=True)]
