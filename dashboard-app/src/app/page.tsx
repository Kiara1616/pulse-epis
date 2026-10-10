"use client";

import { Award, CalendarDays, Clock3, ShieldCheck, TrendingUp, UsersRound } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { useRole } from "@/features/access/RoleProvider";
import { redirect } from "next/navigation";
import { AnalyticsSource } from "@/features/analytics/AnalyticsSource";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";
import { InteractiveProviderChart } from "./InteractiveProviderChart";
import { EnrollmentHistory } from "@/features/analytics/EnrollmentHistory";
import { CertificationSummary } from "@/features/analytics/CertificationSummary";
import { CoverageChart } from "@/features/analytics/CoverageChart";
import { CertificationsChart } from "./CertificationsChart";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE").format(new Date(`${value}T00:00:00`));
}

function DashboardContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  const options = analytics.options;
  const exportRows = data?.evolution.map((point) => ({
    fecha_corte: point.cutoff_date,
    estudiantes_certificados: point.certified_students,
    certificaciones_aprobadas: point.approved_certifications,
  })) ?? [];

  return <div className="space-y-6">
    <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><h1 className="text-3xl font-bold tracking-tight text-slate-950">Panorama de certificaciones</h1></div>
      {data && (
        <ExportButton dataset={data.dataset} filters={data.filters}
          filename={`pulse-epis-${data.filters.period_code}.csv`}
          rows={exportRows}
          metadata={["Fuente: GET /api/v1/indicators/overview", `Periodo: ${data.filters.period_code}`, `Corte: ${data.filters.cutoff_date}`]}
        />
      )}
    </section>

    <AnalyticsSource dataset={analytics.dataset} local={analytics.local} onChange={analytics.setDataset}/>
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

        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6"><h2 className="font-bold text-slate-950">Evolución dentro del periodo</h2><p className="mt-1 text-sm text-slate-500">Certificaciones aprobadas por fecha de corte.</p></div>
          <div className="h-[240px]"><CertificationsChart data={data.evolution.map((point) => ({ semester: point.cutoff_date, certifications: point.approved_certifications }))}/></div>
        </section><CoverageChart active={data.kpis.active_students} certified={data.kpis.certified_students} coverage={data.kpis.coverage_percent}/></div>

        <InteractiveProviderChart byIssuer={data.by_issuer} bySkill={data.by_skill}/>
        <CertificationSummary items={data.by_credential ?? []}/>
      </>}
    </AsyncState>
    <EnrollmentHistory/>
  </div>;
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof UsersRound }) {
  const tone = "bg-slate-100 text-slate-600";
  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`grid h-10 w-10 place-items-center rounded-lg ${tone}`}><Icon size={20}/></div><p className="mt-5 text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</p></article>;
}

export default function Home() {
  const { role } = useRole();
  if (role === "STUDENT") redirect("/mi-perfil");
  return <RoleGate allow={["ADMIN", "VALIDATOR"]}><DashboardContent/></RoleGate>;
}
