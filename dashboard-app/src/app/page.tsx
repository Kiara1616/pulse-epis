"use client";

import { useState } from "react";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
import {
  IndicatorCards,
  InstitutionalPriorities,
} from "@/features/admin/InstitutionalPriorities";
import { DataQuality } from "@/features/admin/DataQuality";
import { RoleGate } from "@/features/access/RoleGate";
import { useRole } from "@/features/access/RoleProvider";
import { redirect } from "next/navigation";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";
import { InteractiveProviderChart } from "./InteractiveProviderChart";
import { EnrollmentHistory } from "@/features/analytics/EnrollmentHistory";
import { CertificationSummary } from "@/features/analytics/CertificationSummary";
import { CoverageChart } from "@/features/analytics/CoverageChart";
import { CertificationsChart } from "./CertificationsChart";
import { PageHeader, SectionHeading, SurfaceCard } from "@/shared/ui/DashboardPrimitives";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE").format(new Date(`${value}T00:00:00`));
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`)).replace(".", "");
}

function DashboardContent() {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { role } = useRole();
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
      <PageHeader title="Panorama de certificaciones" description="Cobertura, vigencia y evolución de las certificaciones del periodo." />

      <div className="md:hidden">
        <button
          type="button"
          aria-expanded={mobileFiltersOpen}
          aria-controls="mobile-analytics-filters"
          onClick={() => setMobileFiltersOpen((open) => !open)}
          className="surface-card flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><SlidersHorizontal size={17} className="text-blue-600" />Ajustar filtros</span>
          <span className="text-right text-xs text-slate-500">{analytics.dataset === "demo" ? "Demostración · no oficial" : "Datos publicados"}</span>
        </button>
        {mobileFiltersOpen && <div id="mobile-analytics-filters" className="mt-3"><AnalyticsFilters
          periods={analytics.periods}
          filters={analytics.filters}
          options={options}
          onChange={analytics.setFilter}
          source={{ dataset: analytics.dataset, available: analytics.referenceAvailable, onChange: analytics.setDataset }}
        /></div>}
      </div>
      <div className="hidden md:block"><AnalyticsFilters
        periods={analytics.periods}
        filters={analytics.filters}
        options={options}
        onChange={analytics.setFilter}
        source={{ dataset: analytics.dataset, available: analytics.referenceAvailable, onChange: analytics.setDataset }}
      /></div>

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
                Periodo {data.filters.period_code} · datos del{" "}
                {formatDate(data.filters.cutoff_date)}
              </span>
            </div>
            <IndicatorCards data={data} />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
              <SurfaceCard className="min-w-0 p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <SectionHeading title="Evolución dentro del periodo" />
                  <div className="w-full sm:flex sm:items-end sm:justify-between sm:gap-4">
                    <p className="text-sm text-slate-500">
                      Estudiantes distintos con certificación y total de certificaciones aprobadas por fecha.
                    </p>
                    {data.evolution.length > 0 && (
                      <p className="shrink-0 text-xs font-medium text-slate-500">
                        {formatChartDate(data.evolution[0].cutoff_date)} – {formatChartDate(data.evolution[data.evolution.length - 1].cutoff_date)}{" "}
                        {new Date(
                          `${data.evolution[data.evolution.length - 1].cutoff_date}T00:00:00`,
                        ).getFullYear()} · {data.evolution.length} fechas
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-[300px]">
                  <CertificationsChart
                    data={data.evolution.map((point) => ({
                      semester: point.cutoff_date,
                      certifiedStudents: point.certified_students,
                      approvedCertifications: point.approved_certifications,
                    }))}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {data.evolution.length < 2
                    ? "Solo hay una fecha registrada. La evolución aparecerá cuando se publiquen más datos del periodo."
                    : "Un estudiante puede tener más de una certificación; por eso las dos series pueden diferir."}
                </p>
              </SurfaceCard>
              <CoverageChart
                active={data.kpis.active_students}
                certified={data.kpis.certified_students}
                coverage={data.kpis.coverage_percent}
              />
            </div>

            {role === "ADMIN" && (
              <div className={data.dataset === "demo" ? "grid gap-5" : "grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.85fr)]"}>
                <InstitutionalPriorities data={data} />
                <DataQuality
                  period={data.filters.period_code}
                  cutoff={data.filters.cutoff_date}
                  dataset={data.dataset}
                />
              </div>
            )}

            <InteractiveProviderChart
              byIssuer={data.by_issuer}
              bySkill={data.by_skill}
            />
            <CertificationSummary items={data.by_credential ?? []} />
            <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5" aria-label="Descargar informe del resumen">
              <div>
                <h2 className="section-title">Descargar informe del resumen</h2>
                <p className="mt-1 text-sm text-slate-600">Incluye el periodo, la fecha y los filtros seleccionados.</p>
              </div>
              <ExportButton
                dataset={data.dataset}
                filters={data.filters}
                filename={`pulse-epis-${data.filters.period_code}.csv`}
                rows={exportRows}
                metadata={[
                  "Fuente: GET /api/v1/indicators/overview",
                  `Periodo: ${data.filters.period_code}`,
                  `Fecha de los datos: ${data.filters.cutoff_date}`,
                ]}
              />
            </section>
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
