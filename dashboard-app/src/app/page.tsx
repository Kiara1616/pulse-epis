"use client";

import { CalendarDays } from "lucide-react";
import {
  IndicatorCards,
} from "@/features/admin/InstitutionalPriorities";
import { RoleGate } from "@/features/access/RoleGate";
import { useRole } from "@/features/access/RoleProvider";
import { redirect } from "next/navigation";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";
import { InteractiveProviderChart } from "./InteractiveProviderChart";
import { EnrollmentHistory } from "@/features/analytics/EnrollmentHistory";
import { CoverageChart } from "@/features/analytics/CoverageChart";
import { CertificationsChart } from "./CertificationsChart";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE").format(new Date(`${value}T00:00:00`));
}

function DashboardContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  const options = analytics.options;
  const exportRows =
    data?.evolution.map((point) => ({
      fecha_corte: point.cutoff_date,
      estudiantes_certificados: point.certified_students,
      certificaciones_aprobadas: point.approved_certifications,
    })) ?? [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            Control institucional
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Resumen ejecutivo
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Cobertura de certificaciones aprobadas y población activa del periodo seleccionado.
          </p>
        </div>
        {data && (
          <ExportButton
            dataset={data.dataset}
            filters={data.filters}
            filename={`pulse-epis-${data.filters.period_code}.csv`}
            rows={exportRows}
            metadata={[
              "Fuente: GET /api/v1/indicators/overview",
              `Periodo: ${data.filters.period_code}`,
              `Corte: ${data.filters.cutoff_date}`,
            ]}
          />
        )}
      </section>

      <AnalyticsFilters
        periods={analytics.periods}
        filters={analytics.filters}
        options={options}
        onChange={analytics.setFilter}
        variant="summary"
      />

      <AsyncState
        loading={analytics.loading}
        error={analytics.error}
        empty={!data && !analytics.loading && !analytics.error}
        onRetry={analytics.retry}
      >
        {data && (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays size={16} />
              <span>
                Periodo {data.filters.period_code} · corte{" "}
                {formatDate(data.filters.cutoff_date)}
              </span>
            </div>
            <IndicatorCards data={data} />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-950">
                    Certificaciones por corte
                  </h2>
                  <span className="text-xs text-slate-400">Serie temporal</span>
                </div>
                <div className="h-[240px]">
                  <CertificationsChart
                    data={data.evolution.map((point) => ({
                      semester: point.cutoff_date,
                      certifications: point.approved_certifications,
                    }))}
                  />
                </div>
              </section>
              <CoverageChart
                active={data.kpis.active_students}
                certified={data.kpis.certified_students}
                coverage={data.kpis.coverage_percent}
              />
            </div>

            <InteractiveProviderChart
              byIssuer={data.by_issuer}
              bySkill={data.by_skill}
            />
          </>
        )}
      </AsyncState>
      <EnrollmentHistory />
    </div>
  );
}

export default function Home() {
  const { role } = useRole();
  if (role === "STUDENT") redirect("/mi-perfil");
  return (
    <RoleGate allow={["ADMIN", "VALIDATOR"]}>
      <DashboardContent />
    </RoleGate>
  );
}
