"use client";

import { CalendarDays, Filter } from "lucide-react";
import type { AnalyticsFilters as AnalyticsFilterValues, AnalyticsMetric, AnalyticsPeriod } from "@/shared/api/types";

type AnalyticsFiltersProps = {
  periods: AnalyticsPeriod[];
  filters: AnalyticsFilterValues;
  options: {
    issuers: AnalyticsMetric[];
    levels: AnalyticsMetric[];
    cohorts: AnalyticsMetric[];
    cycles: AnalyticsMetric[];
  };
  onChange: <K extends keyof AnalyticsFilterValues>(key: K, value: AnalyticsFilterValues[K]) => void;
};

function optionsFor(items: AnalyticsMetric[]) {
  return items.map((item) => item.name);
}

export function AnalyticsFilters({ periods, filters, options, onChange }: AnalyticsFiltersProps) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Filtros de indicadores">
    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Filter size={16} className="text-blue-600"/>Filtros del snapshot</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className="text-xs font-bold text-slate-600">Periodo<select value={filters.period_code} onChange={(event) => onChange("period_code", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="">Selecciona...</option>{periods.map((period) => <option key={period.code} value={period.code}>{period.code}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600">Fecha de corte<div className="relative mt-1"><CalendarDays size={15} className="pointer-events-none absolute right-3 top-2.5 text-slate-400"/><input type="date" value={filters.cutoff_date} onChange={(event) => onChange("cutoff_date", event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></div></label>
      <SelectFilter label="Proveedor" value={filters.issuer} values={optionsFor(options.issuers)} onChange={(value) => onChange("issuer", value)}/>
      <SelectFilter label="Nivel" value={filters.level} values={optionsFor(options.levels)} onChange={(value) => onChange("level", value)}/>
      <SelectFilter label="Cohorte" value={filters.cohort} values={optionsFor(options.cohorts)} onChange={(value) => onChange("cohort", value)}/>
      <SelectFilter label="Ciclo" value={filters.cycle} values={optionsFor(options.cycles)} onChange={(value) => onChange("cycle", value)}/>
    </div>
  </section>;
}

function SelectFilter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold text-slate-600">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="">Todos</option>{values.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>;
}
