"""Reproducible aggregate indicators built from published ETL snapshots."""

from __future__ import annotations

from collections import Counter
from datetime import date, timedelta
from typing import Protocol

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from ..db.models import (
    AcademicPeriod,
    Certification,
    FactCertification,
    FactStudentPeriod,
    Issuer,
    Skill,
    Student,
)
from .schemas import (
    AnalyticsFilters,
    AnalyticsKpis,
    AnalyticsOverview,
    AnalyticsPeriod,
    EvolutionPoint,
    MetricDefinition,
    MetricValue,
    SkillGap,
)


class AnalyticsError(RuntimeError):
    pass


class AnalyticsPeriodNotFound(AnalyticsError):
    pass


class AnalyticsSnapshotNotFound(AnalyticsError):
    pass


class AnalyticsUnavailable(AnalyticsError):
    pass


class AnalyticsServiceProtocol(Protocol):
    def periods(self) -> tuple[AnalyticsPeriod, ...]: ...

    def overview(self, **filters: object) -> AnalyticsOverview: ...

    def dictionary(self) -> tuple[MetricDefinition, ...]: ...


def _series(counter: Counter[str]) -> list[MetricValue]:
    return [
        MetricValue(name=name, value=value)
        for name, value in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


class AnalyticsService:
    def __init__(self, session_factory: sessionmaker[Session]):
        self._session_factory = session_factory

    def periods(self) -> tuple[AnalyticsPeriod, ...]:
        """Return academic periods with at least one published snapshot."""

        latest_cutoffs = (
            select(
                FactStudentPeriod.period_id.label("period_id"),
                func.max(FactStudentPeriod.cutoff_date).label("latest_cutoff_date"),
            )
            .group_by(FactStudentPeriod.period_id)
            .subquery()
        )
        with self._session_factory() as session:
            rows = session.execute(
                select(AcademicPeriod, latest_cutoffs.c.latest_cutoff_date)
                .join(latest_cutoffs, latest_cutoffs.c.period_id == AcademicPeriod.id)
                .order_by(AcademicPeriod.starts_on.desc(), AcademicPeriod.code.desc())
            ).all()
        return tuple(
            AnalyticsPeriod(
                code=period.code,
                starts_on=period.starts_on,
                ends_on=period.ends_on,
                latest_cutoff_date=latest_cutoff_date,
            )
            for period, latest_cutoff_date in rows
        )

    def overview(
        self,
        *,
        period_code: str,
        cutoff_date: date | None = None,
        cohort: str | None = None,
        cycle: str | None = None,
        issuer: str | None = None,
        level: str | None = None,
    ) -> AnalyticsOverview:
        with self._session_factory() as session:
            period = session.scalar(
                select(AcademicPeriod).where(AcademicPeriod.code == period_code.strip())
            )
            if period is None:
                raise AnalyticsPeriodNotFound(period_code)

            selected_cutoff = cutoff_date or session.scalar(
                select(func.max(FactStudentPeriod.cutoff_date)).where(
                    FactStudentPeriod.period_id == period.id
                )
            )
            if selected_cutoff is None:
                raise AnalyticsSnapshotNotFound(period_code)

            snapshot_exists = session.scalar(
                select(func.count()).select_from(FactStudentPeriod).where(
                    FactStudentPeriod.period_id == period.id,
                    FactStudentPeriod.cutoff_date == selected_cutoff,
                )
            )
            if not snapshot_exists:
                raise AnalyticsSnapshotNotFound(
                    f"No snapshot exists for {period.code} at {selected_cutoff}"
                )

            student_statement = select(FactStudentPeriod).where(
                FactStudentPeriod.period_id == period.id,
                FactStudentPeriod.cutoff_date == selected_cutoff,
                FactStudentPeriod.enrollment_status == "ACTIVE",
            )
            if cohort:
                student_statement = student_statement.where(FactStudentPeriod.cohort == cohort)
            if cycle:
                student_statement = student_statement.where(FactStudentPeriod.cycle == cycle)
            student_facts = tuple(session.scalars(student_statement).all())
            eligible_keys = {fact.student_key for fact in student_facts}

            certification_statement = (
                select(FactCertification, Certification, Student, Issuer, Skill)
                .join(Certification, Certification.id == FactCertification.certification_id)
                .join(Student, Student.id == Certification.student_id)
                .join(Issuer, Issuer.id == FactCertification.issuer_id)
                .join(Skill, Skill.id == FactCertification.skill_id)
                .where(
                    FactCertification.period_id == period.id,
                    FactCertification.cutoff_date == selected_cutoff,
                    FactCertification.status == "APPROVED",
                )
            )
            if issuer:
                certification_statement = certification_statement.where(Issuer.name == issuer)
            if level:
                certification_statement = certification_statement.where(FactCertification.level == level)
            rows = [
                row
                for row in session.execute(certification_statement).all()
                if row.Student.student_key in eligible_keys
            ]

            certification_ids = {row.FactCertification.certification_id for row in rows}
            certified_keys = {row.Student.student_key for row in rows}
            active_students = len(eligible_keys)
            certified_students = len(certified_keys)
            coverage = round(certified_students * 100 / active_students, 2) if active_students else 0.0
            expiring_limit = selected_cutoff + timedelta(days=90)
            expiring_soon = len(
                {
                    row.FactCertification.certification_id
                    for row in rows
                    if row.FactCertification.expires_on is not None
                    and selected_cutoff <= row.FactCertification.expires_on <= expiring_limit
                }
            )
            cohort_by_key = {fact.student_key: fact.cohort or "Sin cohorte" for fact in student_facts}
            cycle_by_key = {fact.student_key: fact.cycle or "Sin ciclo" for fact in student_facts}
            issuer_certifications: dict[str, set[object]] = {}
            level_certifications: dict[str, set[object]] = {}
            cohort_certifications: dict[str, set[object]] = {}
            cycle_certifications: dict[str, set[object]] = {}
            students_by_skill: dict[str, set[str]] = {}
            for row in rows:
                certification_id = row.FactCertification.certification_id
                issuer_certifications.setdefault(row.Issuer.name, set()).add(certification_id)
                level_certifications.setdefault(
                    row.FactCertification.level or "Sin nivel", set()
                ).add(certification_id)
                cohort_certifications.setdefault(
                    cohort_by_key[row.Student.student_key], set()
                ).add(certification_id)
                cycle_certifications.setdefault(
                    cycle_by_key[row.Student.student_key], set()
                ).add(certification_id)
                students_by_skill.setdefault(row.Skill.name, set()).add(row.Student.student_key)
            skill_gaps = [
                SkillGap(
                    skill=skill_name,
                    certified_students=len(keys),
                    gap_students=max(active_students - len(keys), 0),
                    coverage_percent=round(len(keys) * 100 / active_students, 2) if active_students else 0.0,
                )
                for skill_name, keys in sorted(students_by_skill.items())
            ]

            historical_students = session.scalars(
                select(FactStudentPeriod).where(
                    FactStudentPeriod.period_id == period.id,
                    FactStudentPeriod.enrollment_status == "ACTIVE",
                )
            ).all()
            eligible_by_cutoff: dict[date, set[str]] = {}
            for fact in historical_students:
                if cohort and fact.cohort != cohort:
                    continue
                if cycle and fact.cycle != cycle:
                    continue
                eligible_by_cutoff.setdefault(fact.cutoff_date, set()).add(fact.student_key)
            history_statement = (
                select(FactCertification, Certification, Student, Issuer)
                .join(Certification, Certification.id == FactCertification.certification_id)
                .join(Student, Student.id == Certification.student_id)
                .join(Issuer, Issuer.id == FactCertification.issuer_id)
                .where(FactCertification.period_id == period.id, FactCertification.status == "APPROVED")
            )
            if issuer:
                history_statement = history_statement.where(Issuer.name == issuer)
            if level:
                history_statement = history_statement.where(FactCertification.level == level)
            history_certifications: dict[date, set[object]] = {}
            history_students: dict[date, set[str]] = {}
            for fact, _, student, _ in session.execute(history_statement):
                if student.student_key not in eligible_by_cutoff.get(fact.cutoff_date, set()):
                    continue
                history_certifications.setdefault(fact.cutoff_date, set()).add(fact.certification_id)
                history_students.setdefault(fact.cutoff_date, set()).add(student.student_key)
            evolution = [
                EvolutionPoint(
                    cutoff_date=item_cutoff,
                    certified_students=len(history_students.get(item_cutoff, set())),
                    approved_certifications=len(history_certifications.get(item_cutoff, set())),
                )
                for item_cutoff in sorted(eligible_by_cutoff)
                if item_cutoff <= selected_cutoff
            ]

            return AnalyticsOverview(
                filters=AnalyticsFilters(
                    period_code=period.code,
                    cutoff_date=selected_cutoff,
                    cohort=cohort,
                    cycle=cycle,
                    issuer=issuer,
                    level=level,
                ),
                kpis=AnalyticsKpis(
                    active_students=active_students,
                    certified_students=certified_students,
                    coverage_percent=coverage,
                    approved_certifications=len(certification_ids),
                    expiring_soon=expiring_soon,
                ),
                by_issuer=_series(Counter({key: len(value) for key, value in issuer_certifications.items()})),
                by_level=_series(Counter({key: len(value) for key, value in level_certifications.items()})),
                by_cohort=_series(Counter({key: len(value) for key, value in cohort_certifications.items()})),
                by_cycle=_series(Counter({key: len(value) for key, value in cycle_certifications.items()})),
                by_skill=_series(Counter(row.Skill.name for row in rows)),
                evolution=evolution,
                skill_gaps=skill_gaps,
            )

    @staticmethod
    def dictionary() -> tuple[MetricDefinition, ...]:
        source = "fact_student_period + fact_certification (snapshot ETL por fecha de corte)"
        return (
            MetricDefinition(id="active_students", name="Estudiantes activos", formula="COUNT DISTINCT student_key con enrollment_status=ACTIVE", source=source, notes="Denominador de cobertura; aplica periodo, corte, cohorte y ciclo."),
            MetricDefinition(id="certified_students", name="Estudiantes certificados", formula="COUNT DISTINCT student_key con al menos una certificación APPROVED", source=source, notes="Aplica todos los filtros solicitados."),
            MetricDefinition(id="coverage_percent", name="Cobertura", formula="certified_students / active_students * 100", source=source, notes="Devuelve 0 cuando no existen estudiantes activos."),
            MetricDefinition(id="approved_certifications", name="Certificaciones aprobadas", formula="COUNT DISTINCT certification_id con status=APPROVED", source=source, notes="Una certificación con varias habilidades se contabiliza una sola vez."),
            MetricDefinition(id="expiring_soon", name="Próximas a vencer", formula="COUNT DISTINCT certification_id con expiración entre el corte y los siguientes 90 días", source=source, notes="Solo considera certificaciones APPROVED."),
        )


class UnavailableAnalyticsService:
    def periods(self) -> tuple[AnalyticsPeriod, ...]:
        raise AnalyticsUnavailable("analytics database is unavailable")

    def overview(self, **filters: object) -> AnalyticsOverview:
        raise AnalyticsUnavailable("analytics database is unavailable")

    def dictionary(self) -> tuple[MetricDefinition, ...]:
        return AnalyticsService.dictionary()


__all__ = [
    "AnalyticsPeriodNotFound",
    "AnalyticsService",
    "AnalyticsServiceProtocol",
    "AnalyticsSnapshotNotFound",
    "AnalyticsUnavailable",
    "UnavailableAnalyticsService",
]
