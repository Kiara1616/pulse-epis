"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Link from "next/link";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsSource } from "@/features/analytics/AnalyticsSource";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";

function GapsContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  const options = analytics.options;
  const rows = data?.skill_gaps.map((item) => ({ habilidad: item.skill, estudiantes_certificados: item.certified_students, brecha_estimada: item.gap_students, cobertura: `${item.coverage_percent}%` })) ?? [];

  return <div className="flex w-full flex-col gap-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-wider text-blue-600">Cobertura por habilidad</p><h1 className="mt-1 text-3xl font-bold text-gray-900">Brechas de habilidades</h1><p className="mt-1 text-gray-500">Compara estudiantes activos con quienes tienen certificaciones aprobadas asociadas a cada habilidad, para orientar la formación complementaria.</p></div>{data && <ExportButton dataset={data.dataset} filters={data.filters} filename={`pulse-epis-brechas-${data.filters.period_code}.csv`} rows={rows} metadata={["Fuente: GET /api/v1/indicators/overview", `Corte: ${data.filters.cutoff_date}`]}/>}</div>
    <AnalyticsSource dataset={analytics.dataset} local={analytics.local} onChange={analytics.setDataset}/>
    <AnalyticsFilters periods={analytics.periods} filters={analytics.filters} options={options} onChange={analytics.setFilter}/>
    <AsyncState loading={analytics.loading} error={analytics.error} empty={!data && !analytics.loading && !analytics.error} onRetry={analytics.retry}>
      {data && <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-gray-800">Cobertura de certificaciones por habilidad</h2><p className="mb-6 mt-2 text-sm text-gray-500">Una cobertura baja indica falta de evidencia registrada, no ausencia de conocimientos. Revisa la formación y los requisitos antes de proponer un curso.</p><div className="h-[420px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.skill_gaps} margin={{ bottom: 45 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="skill" angle={-25} textAnchor="end" height={70}/><YAxis allowDecimals={false}/><Tooltip/><Bar isAnimationActive={false} dataKey="certified_students" name="Certificados" fill="#2563eb" radius={[4,4,0,0]}/><Bar isAnimationActive={false} dataKey="gap_students" name="Sin certificación registrada" fill="#f59e0b" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></section>}
    </AsyncState>
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><h2 className="font-bold text-blue-950">De la cobertura a la planificación</h2><p className="mt-2 text-sm text-blue-900">Identifica temas prioritarios y compáralos con los contenidos de oportunidades formativas. Estos indicadores no miden demanda laboral.</p><Link href="/admin/oportunidades" className="mt-3 inline-block text-sm font-bold text-blue-700">Revisar cursos en el radar →</Link></section>
  </div>;
}

export default function BrechasPage() {
  return <RoleGate allow={["ADMIN"]}><GapsContent/></RoleGate>;
}
