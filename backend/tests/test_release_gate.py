import json
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]


def validate(tmp_path, changes, strict=True):
    evidence = json.loads((ROOT / 'pilot/acceptance.json').read_text())
    evidence.update(changes)
    file = tmp_path / 'acceptance.json'
    file.write_text(json.dumps(evidence))
    return subprocess.run([sys.executable, str(ROOT / 'scripts/validate_release.py'), '--evidence', str(file), *(['--strict'] if strict else [])], capture_output=True, text=True)


def test_pending_pilot_can_pass_ci_but_cannot_be_published(tmp_path):
    assert validate(tmp_path, {}, strict=False).returncode == 0
    result = validate(tmp_path, {})
    assert result.returncode != 0
    assert 'pending' in result.stderr


@pytest.mark.parametrize('value', [float('nan'), float('inf'), 101, True, -1])
def test_release_rejects_invalid_percentages(tmp_path, value):
    assert validate(tmp_path, {'reconciliation_percent': value}, strict=False).returncode != 0


def test_release_rejects_duplicate_roles(tmp_path):
    assert validate(tmp_path, {'roles_demonstrated': ['ADMIN', 'VALIDATOR', 'STUDENT', 'STUDENT']}, strict=False).returncode != 0


def test_release_requires_operational_proof_even_with_a_real_url(tmp_path):
    result = validate(tmp_path, {'acceptance_status': 'accepted', 'public_url': 'https://pulse-epis.onrender.com', 'evidence_notes': 'Executed synthetic pilot'})
    assert result.returncode != 0
    assert 'public_deployment_verified' in result.stderr
