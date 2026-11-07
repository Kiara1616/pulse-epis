"""Prepare a local, non-versioned roster candidate from the confirmed workbook."""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

from openpyxl import load_workbook


EMAIL_CODE = re.compile(r"^[a-z]{2}(\d{8,10})@virtual\.upt\.pe$", re.IGNORECASE)
ROMAN = ("I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X")
FIELDS = ("code", "email", "school", "plan", "cycle", "status", "period", "name")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path(".data/roster-preparation"))
    parser.add_argument("--plan", help="Confirmed study plan, e.g. 'Plan 2020'")
    args = parser.parse_args()

    sheet = load_workbook(args.workbook, read_only=True, data_only=True)["Nombres publicados"]
    rows = list(sheet.values)
    if tuple(rows[0]) != ("Periodo publicado", "Ciclo publicado", "Nombre del estudiante", "Correo de Aula Virtual"):
        raise ValueError("Unexpected workbook columns")

    candidates = []
    review = []
    for excel_row, (period, cycle, name, email) in enumerate(rows[1:], start=2):
        email = str(email or "").strip().lower()
        if not email:
            review.append({"excel_row": excel_row, "reason": "MISSING_EMAIL_AND_CODE"})
            continue
        match = EMAIL_CODE.fullmatch(email)
        if not match:
            review.append({"excel_row": excel_row, "reason": "CODE_NOT_DERIVABLE_FROM_EMAIL"})
            continue
        if str(period) != "2026-II" or not isinstance(cycle, int) or not 1 <= cycle <= 10:
            review.append({"excel_row": excel_row, "reason": "INVALID_PERIOD_OR_CYCLE"})
            continue
        if not str(name or "").strip():
            review.append({"excel_row": excel_row, "reason": "MISSING_NAME"})
            continue
        candidates.append({
            "code": match.group(1), "email": email, "school": "EPIS",
            "plan": args.plan or "", "cycle": ROMAN[cycle - 1],
            "status": "ACTIVE", "period": "2026-II",
            "name": str(name).strip(),
        })
        if len(match.group(1)) != 10:
            review.append({"excel_row": excel_row, "reason": "ATYPICAL_EIGHT_DIGIT_CODE_CONFIRM_WITH_REGISTRY"})

    codes = Counter(row["code"] for row in candidates)
    emails = Counter(row["email"] for row in candidates)
    if any(n > 1 for n in codes.values()) or any(n > 1 for n in emails.values()):
        raise ValueError("Duplicate code or email in candidate batch")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    candidate_path = args.output_dir / "padron_2026-II_candidatos.csv"
    with candidate_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(candidates)

    report = {
        "period": "2026-II", "total_source_rows": len(rows) - 1,
        "candidate_rows": len(candidates), "missing_email_rows": sum(not r[3] for r in rows[1:]),
        "plan_confirmed": bool(args.plan), "import_ready": bool(args.plan) and not any(
            item["reason"] == "ATYPICAL_EIGHT_DIGIT_CODE_CONFIRM_WITH_REGISTRY" for item in review
        ),
        "review": review,
        "note": "A candidate CSV is not an authorized institutional roster. Confirm codes and plan before import.",
    }
    report_path = args.output_dir / "prevalidacion_2026-II.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "review"}, ensure_ascii=False))
    print(f"candidate_csv={candidate_path}")
    print(f"report={report_path}")


if __name__ == "__main__":
    main()
