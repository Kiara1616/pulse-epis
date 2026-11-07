from datetime import date

from backend.app.analytics.reports import aggregate_evolution
from backend.app.analytics.schemas import EvolutionPoint


def point(value: str, students: int) -> EvolutionPoint:
    return EvolutionPoint(
        cutoff_date=date.fromisoformat(value),
        certified_students=students,
        approved_certifications=students + 2,
    )


def test_monthly_report_uses_last_snapshot_instead_of_summing() -> None:
    result = aggregate_evolution(
        [point("2026-01-05", 2), point("2026-01-31", 5), point("2026-02-10", 7)],
        date_from=None,
        date_to=None,
        granularity="month",
    )
    assert [(item.cutoff_date.isoformat(), item.certified_students) for item in result] == [
        ("2026-01-31", 5),
        ("2026-02-10", 7),
    ]


def test_yearly_report_applies_inclusive_date_range() -> None:
    result = aggregate_evolution(
        [point("2025-12-31", 2), point("2026-01-01", 3), point("2026-10-01", 9)],
        date_from=date(2026, 1, 1),
        date_to=date(2026, 6, 30),
        granularity="year",
    )
    assert len(result) == 1
    assert result[0].cutoff_date == date(2026, 1, 1)
