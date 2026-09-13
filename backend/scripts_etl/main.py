"""Command-line entry point for the production certification ETL.

The command reads the operational database and publishes a reproducible
snapshot. It deliberately has no network client and never searches Credly.
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import date
from uuid import UUID

from backend.app.core.config import get_settings
from backend.app.db.session import create_session_factory
from backend.app.etl.catalogs import normalize_issuer_name, normalize_level, normalize_skill_name
from backend.app.etl.service import EtlError, EtlService


logger = logging.getLogger(__name__)


def transform(raw_data: list[dict[str, str | None]]) -> list[dict[str, str | None]]:
    """Normalize a local, already-authorized source extract for unit tests.

    This helper is intentionally file/database agnostic. Production execution
    uses :class:`EtlService`, which extracts from the operational schema.
    """

    transformed: list[dict[str, str | None]] = []
    for row in raw_data:
        credential_name = (row.get("credential_name") or "").strip()
        student_key = (row.get("student_key") or "").strip()
        transformed.append(
            {
                "student_key": student_key,
                "issuer_name": normalize_issuer_name(row.get("issuer_name")),
                "credential_name": credential_name,
                "skill_name": normalize_skill_name(row.get("skill_name")),
                "level": normalize_level(row.get("level"), credential_name),
                "status": (row.get("status") or "").strip().upper(),
            }
        )
    return transformed


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the Pulse EPIS certification ETL")
    parser.add_argument("--period-code", required=True, help="Academic period, e.g. 2026-II")
    parser.add_argument(
        "--cutoff-date",
        type=date.fromisoformat,
        required=True,
        help="Snapshot date in ISO format (YYYY-MM-DD)",
    )
    parser.add_argument("--actor-user-id", type=UUID, default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    settings = get_settings()
    if not settings.database_url:
        raise SystemExit("PULSE_DATABASE_URL es obligatorio para ejecutar el ETL")

    logging.basicConfig(
        level=getattr(logging, settings.log_level),
        format="%(asctime)s - %(levelname)s - %(message)s",
    )
    service = EtlService(create_session_factory(settings.database_url))
    try:
        report = service.run(args.period_code, args.cutoff_date, args.actor_user_id)
    except EtlError as error:
        logger.error("ETL rechazado antes de publicar: %s", error)
        return 2

    print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    return 0 if report.status == "APPLIED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
