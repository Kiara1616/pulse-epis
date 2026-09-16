"""Public, aggregate-only analytics response contracts."""

from datetime import date

from pydantic import BaseModel, Field


class MetricValue(BaseModel):
    name: str
    value: int = Field(ge=0)


class AnalyticsFilters(BaseModel):
    period_code: str
    cutoff_date: date
    cohort: str | None = None
    cycle: str | None = None
    issuer: str | None = None
    level: str | None = None


class AnalyticsPeriod(BaseModel):
    code: str
    starts_on: date
    ends_on: date
    latest_cutoff_date: date


class AnalyticsKpis(BaseModel):
    active_students: int = Field(ge=0)
    certified_students: int = Field(ge=0)
    coverage_percent: float = Field(ge=0, le=100)
    approved_certifications: int = Field(ge=0)
    expiring_soon: int = Field(ge=0)


class EvolutionPoint(BaseModel):
    cutoff_date: date
    certified_students: int = Field(ge=0)
    approved_certifications: int = Field(ge=0)


class SkillGap(BaseModel):
    skill: str
    certified_students: int = Field(ge=0)
    gap_students: int = Field(ge=0)
    coverage_percent: float = Field(ge=0, le=100)


class AnalyticsOverview(BaseModel):
    filters: AnalyticsFilters
    kpis: AnalyticsKpis
    by_issuer: list[MetricValue]
    by_level: list[MetricValue]
    by_cohort: list[MetricValue]
    by_cycle: list[MetricValue]
    by_skill: list[MetricValue]
    evolution: list[EvolutionPoint]
    skill_gaps: list[SkillGap]


class MetricDefinition(BaseModel):
    id: str
    name: str
    formula: str
    source: str
    notes: str


__all__ = [
    "AnalyticsFilters",
    "AnalyticsKpis",
    "AnalyticsOverview",
    "AnalyticsPeriod",
    "EvolutionPoint",
    "MetricDefinition",
    "MetricValue",
    "SkillGap",
]
