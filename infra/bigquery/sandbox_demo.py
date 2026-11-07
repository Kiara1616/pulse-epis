"""Load synthetic Pulse EPIS facts into BigQuery Sandbox (no billing account).

Usage: python infra/bigquery/sandbox_demo.py PROJECT_ID
Only synthetic records are generated; no roster or student email is uploaded.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


DATASET = "pulse_epis_demo"
PERIOD = "2026-II"
ROWS_STUDENTS = [
    {"student_key": "demo-a", "period_code": PERIOD, "cutoff_date": "2026-11-01", "cohort": "2023", "cycle": "VII", "enrollment_status": "ACTIVE", "certification_count": 1, "approved_certification_count": 1},
    {"student_key": "demo-b", "period_code": PERIOD, "cutoff_date": "2026-11-01", "cohort": "2024", "cycle": "V", "enrollment_status": "ACTIVE", "certification_count": 0, "approved_certification_count": 0},
    {"student_key": "demo-a", "period_code": PERIOD, "cutoff_date": "2026-11-02", "cohort": "2023", "cycle": "VII", "enrollment_status": "ACTIVE", "certification_count": 1, "approved_certification_count": 1},
    {"student_key": "demo-b", "period_code": PERIOD, "cutoff_date": "2026-11-02", "cohort": "2024", "cycle": "V", "enrollment_status": "ACTIVE", "certification_count": 1, "approved_certification_count": 0},
]
ROWS_CERTIFICATIONS = [
    {"certification_id": "demo-cert-1", "skill_id": "demo-skill-sql", "student_key": "demo-a", "period_code": PERIOD, "cutoff_date": "2026-11-01", "issuer": "Demo", "status": "APPROVED", "level": "Fundamentos"},
    {"certification_id": "demo-cert-1", "skill_id": "demo-skill-sql", "student_key": "demo-a", "period_code": PERIOD, "cutoff_date": "2026-11-02", "issuer": "Demo", "status": "APPROVED", "level": "Fundamentos"},
    {"certification_id": "demo-cert-2", "skill_id": "demo-skill-cloud", "student_key": "demo-b", "period_code": PERIOD, "cutoff_date": "2026-11-02", "issuer": "Demo", "status": "PENDING", "level": "Fundamentos"},
]


def run(*args: str) -> str:
    executable = shutil.which(args[0])
    if executable is None:
        raise RuntimeError(f"No se encontró {args[0]} en PATH")
    result = subprocess.run((executable, *args[1:]), capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result.stdout.strip()


def main(project: str) -> None:
    if not project or not project.replace("-", "").isalnum():
        raise ValueError("Project ID inválido")
    dataset = f"{project}:{DATASET}"
    with tempfile.TemporaryDirectory() as directory:
        for table, rows in (("fact_student_period", ROWS_STUDENTS), ("fact_certification", ROWS_CERTIFICATIONS)):
            path = Path(directory) / f"{table}.jsonl"
            path.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
            run("bq", f"--project_id={project}", "load", "--replace", "--autodetect", "--source_format=NEWLINE_DELIMITED_JSON", f"{dataset}.{table}", str(path))
    sql = (
        "SELECT cutoff_date, COUNTIF(enrollment_status = 'ACTIVE') AS active_students, "
        "COUNTIF(enrollment_status = 'ACTIVE' AND approved_certification_count > 0) "
        "AS certified_students FROM pulse_epis_demo.fact_student_period "
        "GROUP BY cutoff_date ORDER BY cutoff_date"
    )
    print(run("bq", f"--project_id={project}", "query", "--use_legacy_sql=false", sql))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: python infra/bigquery/sandbox_demo.py PROJECT_ID")
    main(sys.argv[1])
