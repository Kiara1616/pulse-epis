"""Time-aware report assembly shared by the six BI reports."""

from __future__ import annotations

from datetime import date
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from ..db.models import AcademicPeriod, EtlRun
from .schemas import (
    AnalyticsOverview,
    AnalyticsReport,
    EtlQualityPoint,
    EvolutionPoint,
    ReportMetadata,
)

Granularity = Literal["day", "month", "year"]


def _bucket(value: date, granularity: Granularity) -> tuple[int, ...]:
    if granularity == "year":
        return (value.year,)
    if granularity == "month":
        return (value.year, value.month)
    return (value.year, value.month, value.day)


def aggregate_evolution(
    points: list[EvolutionPoint],
    *,
    date_from: date | None,
    date_to: date | None,
    granularity: Granularity,
) -> list[EvolutionPoint]:
    """Use the last valid snapshot in each bucket; never sum snapshot metrics."""

    selected: dict[tuple[int, ...], EvolutionPoint] = {}
    for point in sorted(points, key=lambda item: item.cutoff_date):
        if date_from and point.cutoff_date < date_from:
            continue
        if date_to and point.cutoff_date > date_to:
            continue
        selected[_bucket(point.cutoff_date, granularity)] = point
    return list(selected.values())


def quality_points(
    session_factory: sessionmaker[Session] | None,
    *,
    period_code: str,
    date_from: date | None,
    date_to: date | None,
) -> list[EtlQualityPoint]:
    if session_factory is None:
        return []
    with session_factory() as session:
        statement = (
            select(EtlRun)
            .join(AcademicPeriod, AcademicPeriod.id == EtlRun.period_id)
            .where(AcademicPeriod.code == period_code)
            .order_by(EtlRun.cutoff_date, EtlRun.created_at)
        )
        if date_from:
            statement = statement.where(EtlRun.cutoff_date >= date_from)
        if date_to:
            statement = statement.where(EtlRun.cutoff_date <= date_to)
        runs = session.scalars(statement).all()
    return [
        EtlQualityPoint(
            cutoff_date=run.cutoff_date,
            status=run.status,
            total_rows=run.total_rows,
            accepted_rows=run.accepted_rows,
            rejected_rows=run.rejected_rows,
            duplicate_rows=run.duplicate_rows,
        )
        for run in runs
    ]


def assemble_report(
    report: str,
    overview: AnalyticsOverview,
    *,
    granularity: Granularity,
    date_from: date | None,
    date_to: date | None,
    quality: list[EtlQualityPoint] | None = None,
) -> AnalyticsReport:
    return AnalyticsReport(
        metadata=ReportMetadata(
            report=report,
            granularity=granularity,
            date_from=date_from,
            date_to=date_to,
            generated_from="último snapshot válido por intervalo",
        ),
        overview=overview,
        temporal=aggregate_evolution(
            overview.evolution,
            date_from=date_from,
            date_to=date_to,
            granularity=granularity,
        ),
        quality=quality or [],
    )


__all__ = ["Granularity", "aggregate_evolution", "assemble_report", "quality_points"]
