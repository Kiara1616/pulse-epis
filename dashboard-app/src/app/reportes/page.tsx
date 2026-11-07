"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  BadgeCheck,
  CalendarRange,
  ChartNoAxesCombined,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";
import { MetricCard, PageHeader, SurfaceCard } from "@/shared/ui/DashboardPrimitives";
import { apiFetch } from "@/shared/api/client";
import type { AnalyticsMetric, AnalyticsOverview, AnalyticsReport, EtlQualityPoint } from "@/shared/api/types";

type Granularity = "day" | "month" | "year";
type ReportId = "panorama" | "evolution" | "credentials" | "skills" | "students" | "quality";

const reportPaths: Record<ReportId, string> = {
  panorama: "panorama",
  evolution: "evolucion",
  credentials: "certificaciones",
  skills: "habilidades",
  students: "cohortes",
  quality: "calidad",
};

const reports: Array<{ id: ReportId; label: string; icon: typeof Award }> = [
  { id: "panorama", label: "Panorama", icon: ChartNoAxesCombined },
  { id: "evolution", label: "Evolución", icon: CalendarRange },
  { id: "credentials", label: "Certificaciones", icon: Award },
  { id: "skills", label: "Habilidades", icon: BadgeCheck },
  { id: "students", label: "Cohortes", icon: GraduationCap },
  { id: "quality", label: "Calidad", icon: ShieldCheck },
];

function bucket(date: string, granularity: Granularity) {
  if (granularity === "year") return date.slice(0, 4);
  if (granularity === "month") return date.slice(0, 7);
  return date;
}

function MetricBars({ items, empty = "No hay datos para los filtros elegidos." }: { items: AnalyticsMetric[]; empty?: string }) {
  const maximum = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return <p className="py-8 text-center text-sm text-slate-500">{empty}</p>;
  return <div className="space-y-3">{items.map((item) => <div key={item.name}>
    <div className="mb-1 flex justify-between gap-4 text-sm"><span className="truncate font-medium text-slate-700">{item.name}</span><span className="font-semibold text-slate-900">{item.value}</span></div>
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(3, item.value / maximum * 100)}%` }} /></div>
  </div>)}</div>;
}

function rowsForReport(report: ReportId, data: AnalyticsOverview, temporal: Array<{ name: string; value: number; certifications: number }>, quality: EtlQualityPoint[]) {
  if (report === "evolution") return temporal;
  if (report === "quality") return quality;
  if (report === "credentials") return data.by_credential ?? [];
  if (report === "skills") return data.skill_gaps.map((item) => ({ skill: item.skill, certified_students: item.certified_students, gap_students: item.gap_students, coverage_percent: item.coverage_percent }));
  if (report === "students") return data.by_cohort.map((item) => ({ cohort: item.name, certifications: item.value }));
  return [{ ...data.kpis }];
}

function ReportContent({ report, data, temporal, quality }: { report: ReportId; data: AnalyticsOverview; temporal: Array<{ name: string; value: number; certifications: number }>; quality: EtlQualityPoint[] }) {
  if (report === "panorama") return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <MetricCard label="Estudiantes activos" value={data.kpis.active_students} />
    <MetricCard label="Estudiantes certificados" value={data.kpis.certified_students} />
    <MetricCard label="Cobertura" value={`${data.kpis.coverage_percent}%`} />
    <MetricCard label="Certificaciones aprobadas" value={data.kpis.approved_certifications} />
  </div>;
  if (report === "evolution") return <SurfaceCard className="p-5"><h2 className="section-title mb-5">Evolución temporal</h2><MetricBars items={temporal} /></SurfaceCard>;
  if (report === "credentials") return <div className="grid gap-5 lg:grid-cols-2"><SurfaceCard className="p-5"><h2 className="section-title mb-5">Por certificación</h2><MetricBars items={data.by_credential ?? []} /></SurfaceCard><SurfaceCard className="p-5"><h2 className="section-title mb-5">Por proveedor</h2><MetricBars items={data.by_issuer} /></SurfaceCard></div>;
  if (report === "skills") return <div className="grid gap-5 lg:grid-cols-2"><SurfaceCard className="p-5"><h2 className="section-title mb-5">Habilidades certificadas</h2><MetricBars items={data.by_skill} /></SurfaceCard><SurfaceCard className="p-5"><h2 className="section-title mb-5">Brechas de habilidades</h2><MetricBars items={data.skill_gaps.map((item) => ({ name: item.skill, value: item.gap_students }))} /></SurfaceCard></div>;
  if (report === "students") return <div className="grid gap-5 lg:grid-cols-2"><SurfaceCard className="p-5"><h2 className="section-title mb-5">Por año de ingreso</h2><MetricBars items={data.by_cohort} /></SurfaceCard><SurfaceCard className="p-5"><h2 className="section-title mb-5">Por ciclo</h2><MetricBars items={data.by_cycle} /></SurfaceCard></div>;
  if (quality.length) return <SurfaceCard className="overflow-x-auto p-5"><h2 className="section-title mb-2">Corridas ETL y calidad de datos</h2><p className="mb-5 text-sm text-slate-500">Filas procesadas, aceptadas, rechazadas y duplicadas por fecha de corte.</p><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-3">Corte</th><th>Estado</th><th>Total</th><th>Aceptadas</th><th>Rechazadas</th><th>Duplicadas</th></tr></thead><tbody>{quality.map((run) => <tr key={`${run.cutoff_date}-${run.status}`} className="border-b border-slate-100"><td className="py-3 font-medium">{run.cutoff_date}</td><td>{run.status}</td><td>{run.total_rows}</td><td>{run.accepted_rows}</td><td>{run.rejected_rows}</td><td>{run.duplicate_rows}</td></tr>)}</tbody></table></SurfaceCard>;
  const checks = [
    { name: "Periodo y fecha de corte", value: data.filters.period_code && data.filters.cutoff_date ? 100 : 0 },
    { name: "Población activa disponible", value: data.kpis.active_students > 0 ? 100 : 0 },
    { name: "Dimensión proveedor disponible", value: data.by_issuer.length > 0 ? 100 : 0 },
    { name: "Dimensión habilidades disponible", value: data.by_skill.length > 0 ? 100 : 0 },
    { name: "Serie temporal disponible", value: data.evolution.length > 0 ? 100 : 0 },
  ];
  return <SurfaceCard className="p-5"><h2 className="section-title mb-2">Controles de calidad del conjunto publicado</h2><p className="mb-5 text-sm text-slate-500">Disponibilidad de dimensiones necesarias para construir los indicadores.</p><MetricBars items={checks} /></SurfaceCard>;
}

export function ReportsDashboard({ initialReport = "panorama" }: { initialReport?: ReportId }) {
  const analytics = useAnalytics();
  const [report] = useState<ReportId>(initialReport);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payload, setPayload] = useState<AnalyticsReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  useEffect(() => {
    if (!analytics.filters.period_code) return;
    let cancelled = false;
    const params = new URLSearchParams({ period_code: analytics.filters.period_code, granularity });
    if (analytics.filters.cutoff_date) params.set("cutoff_date", analytics.filters.cutoff_date);
    if (analytics.filters.issuer) params.set("issuer", analytics.filters.issuer);
    if (analytics.filters.cohort) params.set("cohort", analytics.filters.cohort);
    if (analytics.filters.cycle) params.set("cycle", analytics.filters.cycle);
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    if (analytics.dataset === "demo") params.set("dataset", "demo");
    void apiFetch<AnalyticsReport>(`/indicators/reports/${reportPaths[report]}?${params}`)
      .then((value) => { if (!cancelled) { setPayload(value); setReportError(null); } })
      .catch((error) => { if (!cancelled) setReportError(error instanceof Error ? error.message : "No se pudo cargar el reporte."); });
    return () => { cancelled = true; };
  }, [analytics.dataset, analytics.filters.cohort, analytics.filters.cutoff_date, analytics.filters.cycle, analytics.filters.issuer, analytics.filters.period_code, from, granularity, report, to]);
  const reportData = payload?.overview ?? analytics.data;
  const temporal = useMemo(() => {
    const grouped = new Map<string, { name: string; value: number; certifications: number }>();
    for (const point of payload?.temporal ?? analytics.data?.evolution ?? []) {
      if ((from && point.cutoff_date < from) || (to && point.cutoff_date > to)) continue;
      grouped.set(bucket(point.cutoff_date, granularity), { name: bucket(point.cutoff_date, granularity), value: point.certified_students, certifications: point.approved_certifications });
    }
    return [...grouped.values()];
  }, [analytics.data, payload, from, to, granularity]);

  return <div className="space-y-6">
    <PageHeader title="Reportes de inteligencia de negocios" description="Seis reportes institucionales con filtros por periodo, año, mes o día." />
    <SurfaceCard className="p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <label className="text-xs font-semibold text-slate-600">Periodo<select value={analytics.filters.period_code} onChange={(event) => analytics.setFilter("period_code", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{analytics.periods.map((period) => <option key={period.code}>{period.code}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Agrupar por<select value={granularity} onChange={(event) => setGranularity(event.target.value as Granularity)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="year">Año</option><option value="month">Mes</option><option value="day">Día</option></select></label>
        <label className="text-xs font-semibold text-slate-600">Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Fuente<select value={analytics.dataset} onChange={(event) => analytics.setDataset(event.target.value as "registered" | "demo")} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="registered">Publicados</option>{analytics.referenceAvailable && <option value="demo">Demostración</option>}</select></label>
        <label className="text-xs font-semibold text-slate-600">Proveedor<select value={analytics.filters.issuer} onChange={(event) => analytics.setFilter("issuer", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Todos</option>{analytics.options.issuers.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Ingreso<select value={analytics.filters.cohort} onChange={(event) => analytics.setFilter("cohort", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Todos</option>{analytics.options.cohorts.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Ciclo<select value={analytics.filters.cycle} onChange={(event) => analytics.setFilter("cycle", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Todos</option>{analytics.options.cycles.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
      </div>
    </SurfaceCard>
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Seleccionar reporte">{reports.map(({ id, label, icon: Icon }) => <Link key={id} href={`/reportes/${reportPaths[id]}`} aria-current={report === id ? "page" : undefined} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${report === id ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}><Icon size={16} />{label}</Link>)}</nav>
    <AsyncState loading={analytics.loading} error={analytics.error ?? reportError} empty={!reportData} onRetry={analytics.retry}>{reportData && <>
      <ReportContent report={report} data={reportData} temporal={temporal} quality={payload?.quality ?? []} />
      <div className="flex justify-end"><ExportButton dataset={reportData.dataset} csvFilters={reportData.filters} filename={`pulse-epis-${report}-${analytics.filters.period_code}.csv`} rows={rowsForReport(report, reportData, temporal, payload?.quality ?? [])} metadata={[`Reporte: ${report}`, `Granularidad: ${granularity}`, `Rango: ${from || "inicio"} a ${to || "corte"}`]} /></div>
    </>}</AsyncState>
  </div>;
}

export default function ReportsPage() {
  return <RoleGate allow={["ADMIN", "VALIDATOR"]}><ReportsDashboard /></RoleGate>;
}
