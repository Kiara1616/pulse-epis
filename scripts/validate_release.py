"""Validate the evidence contract required before publishing a pilot release."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "pilot" / "acceptance.json"


def main() -> None:
    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    required = {"reconciliation_percent", "approved_credential_accounting_percent", "kpis_contrasted", "roles_demonstrated", "public_url", "limitations"}
    missing = sorted(required - evidence.keys())
    if missing:
        raise SystemExit(f"Missing pilot evidence fields: {', '.join(missing)}")
    if evidence["reconciliation_percent"] < 95:
        raise SystemExit("Pilot reconciliation is below the 95% acceptance threshold")
    if evidence["approved_credential_accounting_percent"] < 100:
        raise SystemExit("Approved credential accounting is below 100%")
    if not evidence["kpis_contrasted"] or len(evidence["roles_demonstrated"]) != 3:
        raise SystemExit("Pilot KPI contrast or three-role demonstration is incomplete")
    if not evidence["public_url"].startswith("https://"):
        raise SystemExit("Pilot public_url must use HTTPS")
    if not evidence["limitations"]:
        raise SystemExit("Pilot limitations must be documented")
    print("Pilot release evidence meets the acceptance thresholds.")


if __name__ == "__main__":
    main()
