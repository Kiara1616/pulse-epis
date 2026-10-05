"""Validate the evidence contract required before publishing a pilot release."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "pilot" / "acceptance.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', type=Path, default=EVIDENCE)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="reject placeholders that are acceptable in the development fixture",
    )
    args = parser.parse_args()

    evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
    required = {"reconciliation_percent", "approved_credential_accounting_percent", "kpis_contrasted", "roles_demonstrated", "public_url", "limitations"}
    missing = sorted(required - evidence.keys())
    if missing:
        raise SystemExit(f"Missing pilot evidence fields: {', '.join(missing)}")
    for field in ('reconciliation_percent', 'approved_credential_accounting_percent'):
        value = evidence[field]
        if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 100:
            raise SystemExit(f'{field} must be a finite percentage between 0 and 100')
    if evidence["reconciliation_percent"] < 95:
        raise SystemExit("Pilot reconciliation is below the 95% acceptance threshold")
    if evidence["approved_credential_accounting_percent"] < 100:
        raise SystemExit("Approved credential accounting is below 100%")
    if evidence["kpis_contrasted"] is not True or len(evidence["roles_demonstrated"]) != 3 or set(evidence["roles_demonstrated"]) != {"ADMIN", "VALIDATOR", "STUDENT"}:
        raise SystemExit("Pilot KPI contrast or three-role demonstration is incomplete")
    public_url = evidence["public_url"]
    if public_url is not None and not isinstance(public_url, str):
        raise SystemExit('Pilot public_url must be a URL string or null while pending')
    parsed_url = urlparse(public_url or '')
    if not evidence["limitations"]:
        raise SystemExit("Pilot limitations must be documented")
    if args.strict:
        if evidence.get('acceptance_status') != 'accepted':
            raise SystemExit('Pilot acceptance is pending; do not publish v1.0.0')
        if parsed_url.scheme != 'https' or not parsed_url.hostname or parsed_url.username or parsed_url.password:
            raise SystemExit('Accepted pilot public_url must use HTTPS without credentials')
        hostname = parsed_url.hostname or ""
        if hostname == 'localhost' or any(hostname == suffix or hostname.endswith('.' + suffix) for suffix in ('example.org', 'example.com', 'example.net', 'test', 'invalid')):
            raise SystemExit("Pilot public_url must be replaced with the real public domain before publishing")
        notes = str(evidence.get("evidence_notes", "")).casefold()
        if "completar" in notes or "reemplazar" in notes:
            raise SystemExit("Pilot evidence_notes still describes pending release work")
        for field in ('public_deployment_verified', 'google_oidc_verified', 'backup_restore_verified', 'rollback_verified', 'document_ci_verified'):
            if evidence.get(field) is not True:
                raise SystemExit(f'Release proof is missing: {field}')
        for field in ('ci_run_url', 'deployment_run_url', 'acceptance_record_url'):
            link = urlparse(evidence.get(field, ''))
            if link.scheme != 'https' or not link.hostname or link.hostname.endswith('.example.org'):
                raise SystemExit(f'Release evidence requires a real HTTPS link: {field}')
    print('Pilot evidence contract is valid.' if not args.strict else 'Pilot release evidence meets the acceptance thresholds.')


if __name__ == "__main__":
    main()
