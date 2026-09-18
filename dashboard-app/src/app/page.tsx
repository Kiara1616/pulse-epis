"use client";

import { Award, CalendarDays, Clock3, ShieldCheck, TrendingUp, UsersRound } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";
import { InteractiveProviderChart } from "./InteractiveProviderChart";
import { CertificationsChart } from "./CertificationsChart";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE").format(new Date(`${value}T00:00:00`));
}

function DashboardContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  const options = {
    issuers: data?.by_issuer ?? [],
    levels: data?.by_level ?? [],
    cohorts: data?.by_cohort ?? [],
    cycles: data?.by_cycle ?? [],
  };
  const exportRows = data?.evolution.map((point) => ({
    fecha_corte: point.cutoff_date,
    estudiantes_certificados: point.certified_students,
    certificaciones_aprobadas: point.approved_certifications,
  })) ?? [];

  return <div className="space-y-6">
    <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-semibold text-blue-600">Indicadores publicados</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Panorama de certificaciones</h1><p className="mt-2 max-w-2xl text-slate-500">Datos agregados del último snapshot ETL aprobado. No se exponen correos, códigos ni claves de estudiantes.</p></div>
      {data && (
        <ExportButton
          filename={`pulse-epis-${data.filters.period_code}.csv`}
          rows={exportRows}
          metadata={["Fuente: GET /api/v1/indicators/overview", `Periodo: ${data.filters.period_code}`, `Corte: ${data.filters.cutoff_date}`]}
        />
      )}
    </section>

    <AnalyticsFilters periods={analytics.periods} filters={analytics.filters} options={options} onChange={analytics.setFilter}/>

    <AsyncState loading={analytics.loading} error={analytics.error} empty={!data && !analytics.loading && !analytics.error} onRetry={analytics.retry}>
      {data && <>
        <div className="flex items-center gap-2 text-sm text-slate-500"><CalendarDays size={16}/><span>Periodo {data.filters.period_code} · corte {formatDate(data.filters.cutoff_date)}</span></div>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Estudiantes activos" value={data.kpis.active_students} icon={UsersRound}/>
          <KpiCard label="Estudiantes certificados" value={data.kpis.certified_students} icon={ShieldCheck}/>
          <KpiCard label="Cobertura" value={`${data.kpis.coverage_percent}%`} icon={TrendingUp}/>
          <KpiCard label="Certificaciones aprobadas" value={data.kpis.approved_certifications} icon={Award}/>
          <KpiCard label="Próximas a vencer" value={data.kpis.expiring_soon} icon={Clock3}/>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-6"><h2 className="font-bold text-slate-950">Evolución del snapshot</h2><p className="mt-1 text-sm text-slate-500">Certificaciones aprobadas por fecha de corte.</p></div>
          <div className="h-[320px]"><CertificationsChart data={data.evolution.map((point) => ({ semester: point.cutoff_date, certifications: point.approved_certifications }))}/></div>
        </section>

        <InteractiveProviderChart byIssuer={data.by_issuer} byLevel={data.by_level}/>
      </>}
    </AsyncState>
  </div>;
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof UsersRound }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon size={20}/></div><p className="mt-5 text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</p></article>;
}

export default function Home() {
  return <RoleGate allow={["ADMIN", "VALIDATOR"]}><DashboardContent/></RoleGate>;
}
