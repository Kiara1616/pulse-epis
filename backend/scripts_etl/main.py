"""Command-line entry point for the production certification ETL.

The command reads the operational database and publishes a reproducible
snapshot. It deliberately has no network client and never searches Credly.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select

from backend.app.core.config import get_settings
from backend.app.db.session import create_session_factory
from backend.app.db.models import AcademicPeriod, FactCertification, FactStudentPeriod
from backend.app.etl.catalogs import normalize_issuer_name, normalize_level, normalize_skill_name
from backend.app.etl.service import EtlError, EtlService


logger = logging.getLogger(__name__)
SCHEDULE_TIMEZONE = ZoneInfo("America/Lima")


def _json_value(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


def export_lake_snapshot(session_factory, report, root: str | Path) -> Path:
    """Publish pseudonymized warehouse facts and a quality manifest by partition."""

    destination = (
        Path(root)
        / f"period_code={report.period_code}"
        / f"cutoff_date={report.cutoff_date.isoformat()}"
    )
    destination.mkdir(parents=True, exist_ok=True)
    with session_factory() as session:
        period_id = session.scalar(
            select(AcademicPeriod.id).where(AcademicPeriod.code == report.period_code)
        )
        students = session.scalars(
            select(FactStudentPeriod).where(
                FactStudentPeriod.period_id == period_id,
                FactStudentPeriod.cutoff_date == report.cutoff_date,
            )
        ).all()
        certifications = session.scalars(
            select(FactCertification).where(
                FactCertification.period_id == period_id,
                FactCertification.cutoff_date == report.cutoff_date,
            )
        ).all()

    student_rows = [
        {
            "student_key": fact.student_key,
            "cutoff_date": fact.cutoff_date,
            "cohort": fact.cohort,
            "cycle": fact.cycle,
            "enrollment_status": fact.enrollment_status,
            "certification_count": fact.certification_count,
            "approved_certification_count": fact.approved_certification_count,
        }
        for fact in students
    ]
    certification_rows = [
        {
            "certification_id": fact.certification_id,
            "skill_id": fact.skill_id,
            "issuer_id": fact.issuer_id,
            "cutoff_date": fact.cutoff_date,
            "status": fact.status,
            "level": fact.level,
            "issued_on": fact.issued_on,
            "expires_on": fact.expires_on,
        }
        for fact in certifications
    ]

    def write_jsonl(filename: str, rows: list[dict]) -> None:
        content = "\n".join(
            json.dumps(row, default=_json_value, ensure_ascii=False, sort_keys=True)
            for row in rows
        )
        (destination / filename).write_text(f"{content}\n" if content else "", encoding="utf-8")

    write_jsonl("fact_student_period.jsonl", student_rows)
    write_jsonl("fact_certification.jsonl", certification_rows)
    manifest = {
        **report.to_dict(),
        "partition": str(destination),
        "student_fact_rows": len(student_rows),
        "certification_fact_rows": len(certification_rows),
        "contains_personal_identifiers": False,
        "files": ["fact_student_period.jsonl", "fact_certification.jsonl"],
    }
    (destination / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return destination


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
    parser.add_argument("--scheduled", action="store_true", help="Publish the previous local day for its open academic period")
    parser.add_argument("--period-code", help="Academic period, e.g. 2026-II")
    parser.add_argument(
        "--cutoff-date",
        type=date.fromisoformat,
        help="Snapshot date in ISO format (YYYY-MM-DD)",
    )
    parser.add_argument("--actor-user-id", type=UUID, default=None)
    return parser


def scheduled_target(session_factory, *, now: datetime | None = None) -> tuple[str, date]:
    """Select one open period for yesterday in Lima; never guess across overlaps."""

    current = now or datetime.now(SCHEDULE_TIMEZONE)
    if current.tzinfo is None:
        raise ValueError("now must include a timezone")
    cutoff = current.astimezone(SCHEDULE_TIMEZONE).date() - timedelta(days=1)
    with session_factory() as session:
        periods = session.scalars(
            select(AcademicPeriod).where(
                AcademicPeriod.status == "OPEN",
                AcademicPeriod.starts_on <= cutoff,
                AcademicPeriod.ends_on >= cutoff,
            )
        ).all()
    if len(periods) != 1:
        raise ValueError(
            f"Expected one open academic period for {cutoff}; found {len(periods)}"
        )
    return periods[0].code, cutoff


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.scheduled and (args.period_code or args.cutoff_date):
        raise SystemExit("--scheduled no admite --period-code ni --cutoff-date")
    if not args.scheduled and (not args.period_code or not args.cutoff_date):
        raise SystemExit("Indica --scheduled o ambos --period-code y --cutoff-date")
    settings = get_settings()
    if not settings.database_url:
        raise SystemExit("PULSE_DATABASE_URL es obligatorio para ejecutar el ETL")

    logging.basicConfig(
        level=getattr(logging, settings.log_level),
        format="%(asctime)s - %(levelname)s - %(message)s",
    )
    session_factory = create_session_factory(settings.database_url)
    if args.scheduled:
        try:
            period_code, cutoff_date = scheduled_target(session_factory)
        except ValueError as error:
            logger.error("ETL programado sin periodo único: %s", error)
            return 2
    else:
        period_code, cutoff_date = args.period_code, args.cutoff_date
    service = EtlService(session_factory)
    try:
        report = service.run(period_code, cutoff_date, args.actor_user_id)
    except EtlError as error:
        logger.error("ETL rechazado antes de publicar: %s", error)
        return 2

    lake_path = os.getenv("PULSE_DATA_LAKE_PATH", "").strip()
    if report.status == "APPLIED" and lake_path:
        partition = export_lake_snapshot(session_factory, report, lake_path)
        logger.info("Data Lake partition published path=%s", partition)
    print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    return 0 if report.status == "APPLIED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
