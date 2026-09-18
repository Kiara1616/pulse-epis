"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";

function GapsContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  const options = { issuers: data?.by_issuer ?? [], levels: data?.by_level ?? [], cohorts: data?.by_cohort ?? [], cycles: data?.by_cycle ?? [] };
  const rows = data?.skill_gaps.map((item) => ({ habilidad: item.skill, estudiantes_certificados: item.certified_students, brecha_estimada: item.gap_students, cobertura: `${item.coverage_percent}%` })) ?? [];

  return <div className="flex w-full flex-col gap-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-wider text-blue-600">Cobertura por habilidad</p><h1 className="mt-1 text-3xl font-bold text-gray-900">Brechas de habilidades</h1><p className="mt-1 text-gray-500">La brecha se estima contra estudiantes activos del snapshot, sin inventar una demanda externa no disponible en la API.</p></div>{data && <ExportButton filename={`pulse-epis-brechas-${data.filters.period_code}.csv`} rows={rows} metadata={["Fuente: GET /api/v1/indicators/overview", `Corte: ${data.filters.cutoff_date}`]}/>}</div>
    <AnalyticsFilters periods={analytics.periods} filters={analytics.filters} options={options} onChange={analytics.setFilter}/>
    <AsyncState loading={analytics.loading} error={analytics.error} empty={!data && !analytics.loading && !analytics.error} onRetry={analytics.retry}>
      {data && <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-gray-800">Estudiantes certificados y brecha estimada</h2><p className="mb-6 mt-2 text-sm text-gray-500">Una brecha alta indica que pocos estudiantes activos cuentan con certificación en esa habilidad.</p><div className="h-[420px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.skill_gaps} margin={{ bottom: 45 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="skill" angle={-25} textAnchor="end" height={70}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="certified_students" name="Certificados" fill="#2563eb" radius={[4,4,0,0]}/><Bar dataKey="gap_students" name="Brecha estimada" fill="#f59e0b" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></section>}
    </AsyncState>
  </div>;
}

export default function BrechasPage() {
  return <RoleGate allow={["ADMIN"]}><GapsContent/></RoleGate>;
}
