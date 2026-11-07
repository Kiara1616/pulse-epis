"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsSource } from "@/features/analytics/AnalyticsSource";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";
import { useRole } from "@/features/access/RoleProvider";
import { StudentDirectory } from "@/features/certifications/StudentDirectory";
import { ReferenceStudentDirectory } from "@/features/certifications/ReferenceStudentDirectory";
import { PageHeader, SectionHeading, SurfaceCard } from "@/shared/ui/DashboardPrimitives";

function AdminStudentsContent() {
  const analytics = useAnalytics();
  return <div className="space-y-6">
    <AnalyticsSource dataset={analytics.dataset} available={analytics.referenceAvailable} onChange={analytics.setDataset}/>
    {analytics.dataset === "demo" ? <ReferenceStudentDirectory/> : <StudentDirectory/>}
  </div>;
}

function StudentsContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  const options = analytics.options;
  const rows = data?.by_cohort
    .map((item) => ({ anio_ingreso: item.name, certificaciones: item.value }))
    .sort((left, right) => Number(left.anio_ingreso) - Number(right.anio_ingreso)) ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader title="Certificaciones por cohorte" description="Certificaciones aprobadas por año de ingreso y ciclo académico." />
      <AnalyticsFilters periods={analytics.periods} filters={analytics.filters} options={options} onChange={analytics.setFilter} source={{ dataset: analytics.dataset, available: analytics.referenceAvailable, onChange: analytics.setDataset }} />
      <AsyncState loading={analytics.loading} error={analytics.error} empty={!data && !analytics.loading && !analytics.error} onRetry={analytics.retry}>
        {data && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SurfaceCard className="min-w-0 p-5">
              <SectionHeading title="Certificaciones por año" />
              {rows.length ? (
                <div className="mt-4 overflow-x-auto">
                  <div className="h-72 min-w-[420px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rows} margin={{ top: 18, right: 12, bottom: 4, left: 4 }} barSize={36}>
                        <CartesianGrid stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="anio_ingreso" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#475569" }} />
                        <YAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                        <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
                        <Bar isAnimationActive={false} dataKey="certificaciones" name="Certificaciones aprobadas" fill="#2563eb" radius={[5, 5, 0, 0]}>
                          <LabelList dataKey="certificaciones" position="top" fill="#334155" fontSize={11} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-slate-500">No hay cohortes para esta fecha.</p>
              )}
              <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                <ExportButton dataset={data.dataset} csvFilters={data.filters} filename={`pulse-epis-cohortes-${data.filters.period_code}.csv`} rows={rows} />
              </div>
            </SurfaceCard>

            <SurfaceCard className="min-w-0 p-5">
              <SectionHeading title="Certificaciones por ciclo" />
              {data.by_cycle.length ? (
                <div className="mt-4 h-72 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.by_cycle} layout="vertical" margin={{ top: 8, right: 32, bottom: 4, left: 4 }}>
                      <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#475569" }} />
                      <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
                      <Bar isAnimationActive={false} dataKey="value" name="Certificaciones aprobadas" fill="#2563eb" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="value" position="right" fill="#334155" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-slate-500">No hay ciclos para esta fecha.</p>
              )}
            </SurfaceCard>
          </div>
        )}
      </AsyncState>
      {analytics.dataset === "demo" && <ReferenceStudentDirectory />}
    </div>
  );
}

export default function EstudiantesPage() {
  const { role } = useRole();
  return <RoleGate allow={["ADMIN", "VALIDATOR"]}>{role === "ADMIN" ? <AdminStudentsContent/> : <StudentsContent/>}</RoleGate>;
}
