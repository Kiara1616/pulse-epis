"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";
import { PageHeader } from "@/shared/ui/DashboardPrimitives";

function GapsContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  const options = analytics.options;
  const rows = data?.skill_gaps.map((item) => ({ habilidad: item.skill, estudiantes_certificados: item.certified_students, brecha_estimada: item.gap_students, cobertura: `${item.coverage_percent}%` })) ?? [];

  return <div className="flex w-full flex-col gap-6">
    <PageHeader title="Brechas de habilidades" description="Cobertura de certificaciones aprobadas por habilidad entre estudiantes activos." />
    <AnalyticsFilters periods={analytics.periods} filters={analytics.filters} options={options} onChange={analytics.setFilter} source={{ dataset: analytics.dataset, available: analytics.referenceAvailable, onChange: analytics.setDataset }}/>
    <AsyncState loading={analytics.loading} error={analytics.error} empty={!data && !analytics.loading && !analytics.error} onRetry={analytics.retry}>
      {data && <section className="surface-card min-w-0 p-5 sm:p-6"><h2 className="section-title">Estudiantes certificados y brecha estimada</h2><p className="mb-6 mt-2 text-sm text-slate-600">La brecha indica ausencia de evidencia aprobada; no mide conocimientos ni demanda laboral.</p><div className="h-[420px] min-w-0 overflow-x-auto"><div className="h-full min-w-[560px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.skill_gaps} margin={{ bottom: 45 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="skill" angle={-25} textAnchor="end" height={70}/><YAxis allowDecimals={false}/><Tooltip/><Bar isAnimationActive={false} dataKey="certified_students" name="Certificados" fill="#2563eb" radius={[4,4,0,0]}/><Bar isAnimationActive={false} dataKey="gap_students" name="Brecha estimada" fill="#f59e0b" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div><div className="mt-5 flex justify-end border-t border-slate-100 pt-4"><ExportButton dataset={data.dataset} csvFilters={data.filters} filename={`pulse-epis-brechas-${data.filters.period_code}.csv`} rows={rows}/></div></section>}
    </AsyncState>
  </div>;
}

export default function BrechasPage() {
  return <RoleGate allow={["ADMIN"]}><GapsContent/></RoleGate>;
}
