import sys
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts_etl"
sys.path.insert(0, str(SCRIPTS_DIR))

from main import transform


def test_transform_normalizes_vendor_level_and_cohort():
    rows = [
        {
            "issuer_name": "Amazon Web Services Training and Certification",
            "badge_name": "AWS Certified Cloud Practitioner",
            "student_email": "kz2023077087@virtual.upt.pe",
        },
        {
            "issuer_name": "Cisco",
            "badge_name": "Cisco Certified Network Associate",
            "student_email": "kz2022011044@virtual.upt.pe",
        },
    ]

    result = transform(rows)

    assert result == [
        {
            "vendor": "AWS",
            "level": "Fundamentals",
            "entry_year": "2023",
            "badge": "AWS Certified Cloud Practitioner",
        },
        {
            "vendor": "Cisco",
            "level": "Associate",
            "entry_year": "2022",
            "badge": "Cisco Certified Network Associate",
        },
    ]


def test_transform_uses_safe_fallbacks_for_unknown_values():
    rows = [
        {
            "issuer_name": "Unknown issuer",
            "badge_name": "Special credential",
            "student_email": "unknown@example.com",
        }
    ]

    result = transform(rows)

    assert result == [
        {
            "vendor": "Otros",
            "level": "Other",
            "entry_year": "Unknown",
            "badge": "Special credential",
        }
    ]
