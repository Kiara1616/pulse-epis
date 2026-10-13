"use client";

import { CalendarDays } from "lucide-react";
import {
  IndicatorCards,
  InstitutionalPriorities,
} from "@/features/admin/InstitutionalPriorities";
import { DataQuality } from "@/features/admin/DataQuality";
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
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Panorama de certificaciones
          </h1>
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

      <AnalyticsSource
        dataset={analytics.dataset}
        available={analytics.referenceAvailable}
        onChange={analytics.setDataset}
      />
      <AnalyticsFilters
        periods={analytics.periods}
        filters={analytics.filters}
        options={options}
        onChange={analytics.setFilter}
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
            {role === "ADMIN" && (
              <>
                <InstitutionalPriorities data={data} />
                <DataQuality
                  period={data.filters.period_code}
                  cutoff={data.filters.cutoff_date}
                  dataset={data.dataset}
                />
              </>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-6">
                  <h2 className="font-bold text-slate-950">
                    Evolución dentro del periodo
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Certificaciones aprobadas por fecha de corte.
                  </p>
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
            <CertificationSummary items={data.by_credential ?? []} />
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
