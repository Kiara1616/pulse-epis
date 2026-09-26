"""Validate the evidence contract required before publishing a pilot release."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "pilot" / "acceptance.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="reject placeholders that are acceptable in the development fixture",
    )
    args = parser.parse_args()

    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    required = {"reconciliation_percent", "approved_credential_accounting_percent", "kpis_contrasted", "roles_demonstrated", "public_url", "limitations"}
    missing = sorted(required - evidence.keys())
    if missing:
        raise SystemExit(f"Missing pilot evidence fields: {', '.join(missing)}")
    if evidence["reconciliation_percent"] < 95:
        raise SystemExit("Pilot reconciliation is below the 95% acceptance threshold")
    if evidence["approved_credential_accounting_percent"] < 100:
        raise SystemExit("Approved credential accounting is below 100%")
    if not evidence["kpis_contrasted"] or set(evidence["roles_demonstrated"]) != {"ADMIN", "VALIDATOR", "STUDENT"}:
        raise SystemExit("Pilot KPI contrast or three-role demonstration is incomplete")
    parsed_url = urlparse(evidence["public_url"])
    if parsed_url.scheme != "https" or not parsed_url.netloc:
        raise SystemExit("Pilot public_url must use HTTPS")
    if not evidence["limitations"]:
        raise SystemExit("Pilot limitations must be documented")
    if args.strict:
        hostname = parsed_url.hostname or ""
        if hostname == "example.org" or hostname.endswith(".example.org"):
            raise SystemExit("Pilot public_url must be replaced with the real public domain before publishing")
        notes = str(evidence.get("evidence_notes", "")).casefold()
        if "completar" in notes or "reemplazar" in notes:
            raise SystemExit("Pilot evidence_notes still describes pending release work")
    print("Pilot release evidence meets the acceptance thresholds.")


if __name__ == "__main__":
    main()
