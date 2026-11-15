"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

const COLORS = [
  "#2563eb",
  "#4f83e8",
  "#6b9cf0",
  "#7aaaf3",
  "#31578f",
  "#8eb9f5",
  "#5278ae",
  "#a8c5f8",
  "#9bb8ec",
  "#c4d7f8",
];

function bucket(date: string, granularity: Granularity) {
  if (granularity === "year") return date.slice(0, 4);
  if (granularity === "month") return date.slice(0, 7);
  return date;
}

function MetricBars({ items, empty = "No hay datos para los filtros elegidos." }: { items: AnalyticsMetric[]; empty?: string }) {
  const maximum = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return <p className="py-8 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.name}>
          <div className="mb-1 flex justify-between gap-4 text-sm">
            <span className="truncate font-medium text-slate-700">{item.name}</span>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${Math.max(3, (item.value / maximum) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function rowsForReport(
  report: ReportId,
  data: AnalyticsOverview,
  temporal: Array<{ name: string; value: number; certifications: number }>,
  quality: EtlQualityPoint[],
) {
  if (report === "evolution") return temporal;
  if (report === "quality") return quality;
  if (report === "credentials") return data.by_credential ?? [];
  if (report === "skills") {
    return data.skill_gaps.map((item) => ({
      skill: item.skill,
      certified_students: item.certified_students,
      gap_students: item.gap_students,
      coverage_percent: item.coverage_percent,
    }));
  }
  if (report === "students") {
    return data.by_cohort.map((item) => ({ cohort: item.name, certifications: item.value }));
  }
  return [{ ...data.kpis }];
}

function ReportContent({
  report,
  data,
  temporal,
  quality,
}: {
  report: ReportId;
  data: AnalyticsOverview;
  temporal: Array<{ name: string; value: number; certifications: number }>;
  quality: EtlQualityPoint[];
}) {
  if (report === "panorama") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Estudiantes activos"
            value={data.kpis.active_students}
            description="Población matriculada en el periodo institucional"
          />
          <MetricCard
            label="Estudiantes certificados"
            value={data.kpis.certified_students}
            description="Con al menos 1 credencial tecnológica aprobada"
          />
          <MetricCard
            label="Tasa de cobertura"
            value={`${data.kpis.coverage_percent}%`}
            description="Porcentaje de la población acreditada formalmente"
          />
          <MetricCard
            label="Certificaciones aprobadas"
            value={data.kpis.approved_certifications}
            description="Total de credenciales oficiales validadas"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <SurfaceCard className="flex flex-col justify-between p-5">
            <div>
              <h2 className="section-title">Distribución de certificación</h2>
              <p className="mt-1 text-xs text-slate-500">Población acreditada frente a población pendiente</p>
            </div>
            <div className="my-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Certificados", value: data.kpis.certified_students },
                      {
                        name: "Sin certificar",
                        value: Math.max(0, data.kpis.active_students - data.kpis.certified_students),
                      },
                    ]}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    <Cell fill="#2563eb" />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="border-t border-slate-100 pt-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{data.kpis.coverage_percent}%</p>
              <p className="text-xs text-slate-500">Cobertura institucional alcanzada</p>
            </div>
          </SurfaceCard>

          <SurfaceCard className="flex flex-col justify-between p-5">
            <div>
              <h2 className="section-title">Entidades emisoras líderes</h2>
              <p className="mt-1 text-xs text-slate-500">Distribución de certificaciones por proveedor</p>
            </div>
            {data.by_issuer.length ? (
              <div className="my-2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.by_issuer.slice(0, 5)}
                    layout="vertical"
                    margin={{ left: 10, right: 30, top: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: "#475569" }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Aprobadas" radius={[0, 4, 4, 0]}>
                      {data.by_issuer.slice(0, 5).map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-20 text-center text-sm text-slate-500">Sin datos de emisores.</p>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>Proveedor líder</span>
              <span className="font-semibold text-slate-800">{data.by_issuer[0]?.name ?? "—"}</span>
            </div>
          </SurfaceCard>

          <SurfaceCard className="flex flex-col justify-between p-5">
            <div>
              <h2 className="section-title">Habilidades más acreditadas</h2>
              <p className="mt-1 text-xs text-slate-500">Competencias técnicas dominantes en el alumnado</p>
            </div>
            {data.by_skill.length ? (
              <div className="my-2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.by_skill.slice(0, 5)}
                    layout="vertical"
                    margin={{ left: 10, right: 30, top: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#475569" }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Acreditados" fill="#0d9488" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-20 text-center text-sm text-slate-500">Sin datos de habilidades.</p>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>Competencia principal</span>
              <span className="font-semibold text-slate-800">{data.by_skill[0]?.name ?? "—"}</span>
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (report === "evolution") {
    return (
      <div className="space-y-6">
        <SurfaceCard className="p-5">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="section-title">Evolución de certificaciones en el tiempo</h2>
              <p className="mt-1 text-xs text-slate-500">
                Progreso acumulado de estudiantes certificados y credenciales aprobadas
              </p>
            </div>
            <div className="flex gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-blue-600" /> Estudiantes certificados
              </span>
                <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-blue-300" /> Certificaciones aprobadas
              </span>
            </div>
          </div>

          {temporal.length ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={temporal} margin={{ left: 10, right: 30, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorCerts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Estudiantes certificados"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorStudents)"
                  />
                  <Area
                    type="monotone"
                    dataKey="certifications"
                    name="Certificaciones aprobadas"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCerts)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-20 text-center text-sm text-slate-500">
              No hay datos temporales para el rango seleccionado.
            </p>
          )}
        </SurfaceCard>

        {temporal.length > 0 && (
          <SurfaceCard className="overflow-x-auto p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Detalle por fecha de corte</h3>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Periodo / Corte</th>
                  <th className="py-2">Estudiantes certificados</th>
                  <th className="py-2">Certificaciones aprobadas</th>
                  <th className="py-2">Promedio credenciales / alumno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {temporal.map((row) => (
                  <tr key={row.name} className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-medium text-slate-900">{row.name}</td>
                    <td className="py-2.5 font-semibold text-blue-600">{row.value}</td>
                    <td className="py-2.5 font-semibold text-blue-700">{row.certifications}</td>
                    <td className="py-2.5 text-slate-600">
                      {row.value > 0 ? (row.certifications / row.value).toFixed(2) : "0.00"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SurfaceCard>
        )}
      </div>
    );
  }

  if (report === "credentials") {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard className="p-5">
            <h2 className="section-title mb-1">Por entidad emisora</h2>
            <p className="mb-4 text-xs text-slate-500">Total de certificaciones aprobadas por proveedor oficial</p>
            {data.by_issuer.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.by_issuer}
                    layout="vertical"
                    margin={{ left: 15, right: 30, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#475569" }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Certificaciones" radius={[0, 4, 4, 0]}>
                      {data.by_issuer.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-20 text-center text-sm text-slate-500">Sin certificaciones para los filtros.</p>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <h2 className="section-title mb-1">Por credencial específica</h2>
            <p className="mb-4 text-xs text-slate-500">Títulos y exámenes acreditados</p>
            {(data.by_credential ?? []).length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.by_credential ?? []}
                    layout="vertical"
                    margin={{ left: 15, right: 30, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: "#475569" }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Aprobadas" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-20 text-center text-sm text-slate-500">Sin detalle de credenciales.</p>
            )}
          </SurfaceCard>
        </div>

        {(data.by_credential ?? []).length > 0 && (
          <SurfaceCard className="overflow-x-auto p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Matriz consolidada de credenciales</h3>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Credencial</th>
                  <th className="py-2">Total aprobadas</th>
                  <th className="py-2">Porcentaje del total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.by_credential ?? []).map((cred) => {
                  const total = data.kpis.approved_certifications || 1;
                  const pct = ((cred.value / total) * 100).toFixed(1);
                  return (
                    <tr key={cred.name} className="hover:bg-slate-50/50">
                      <td className="py-2.5 font-medium text-slate-900">{cred.name}</td>
                      <td className="py-2.5 font-bold text-indigo-600">{cred.value}</td>
                      <td className="py-2.5 text-slate-600">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SurfaceCard>
        )}
      </div>
    );
  }

  if (report === "skills") {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard className="p-5">
            <h2 className="section-title mb-1">Competencias y brechas de habilidades</h2>
            <p className="mb-4 text-xs text-slate-500">Alumnos certificados frente a estudiantes con brecha</p>
            {data.skill_gaps.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.skill_gaps}
                    layout="vertical"
                    margin={{ left: 15, right: 30, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="skill" width={110} tick={{ fontSize: 11, fill: "#475569" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="certified_students" name="Certificados" fill="#10b981" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="gap_students" name="Brecha pendiente" fill="#f87171" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-20 text-center text-sm text-slate-500">Sin datos de habilidades.</p>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <h2 className="section-title mb-1">Tasa de cobertura por habilidad</h2>
            <p className="mb-4 text-xs text-slate-500">Porcentaje de estudiantes con la habilidad validada</p>
            {data.skill_gaps.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.skill_gaps}
                    layout="vertical"
                    margin={{ left: 15, right: 30, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="skill" width={110} tick={{ fontSize: 11, fill: "#475569" }} />
                    <Tooltip />
                    <Bar dataKey="coverage_percent" name="% Cobertura" fill="#0284c7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-20 text-center text-sm text-slate-500">Sin datos de cobertura.</p>
            )}
          </SurfaceCard>
        </div>

        {data.skill_gaps.length > 0 && (
          <SurfaceCard className="overflow-x-auto p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Matriz de brechas y prioridades curriculares</h3>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Habilidad tecnológica</th>
                  <th className="py-2">Alumnos certificados</th>
                  <th className="py-2">Brecha de alumnos</th>
                  <th className="py-2">Cobertura</th>
                  <th className="py-2">Prioridad institucional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.skill_gaps.map((item) => (
                  <tr key={item.skill} className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-medium text-slate-900">{item.skill}</td>
                    <td className="py-2.5 font-semibold text-blue-700">{item.certified_students}</td>
                    <td className="py-2.5 font-semibold text-slate-600">{item.gap_students}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${Math.min(100, item.coverage_percent)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{item.coverage_percent}%</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.gap_students > 100
                            ? "border border-blue-200 bg-blue-50 text-blue-700"
                            : "border border-blue-200 bg-blue-50 text-blue-700"
                        }`}
                      >
                        {item.gap_students > 100 ? "Alta prioridad" : "Estándar"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SurfaceCard>
        )}
      </div>
    );
  }

  if (report === "students") {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard className="p-5">
            <h2 className="section-title mb-1">Por año de ingreso (Cohortes)</h2>
            <p className="mb-4 text-xs text-slate-500">Certificaciones obtenidas por cohorte de ingreso</p>
            {data.by_cohort.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.by_cohort} margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Certificaciones" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {data.by_cohort.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-20 text-center text-sm text-slate-500">Sin datos de cohortes.</p>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <h2 className="section-title mb-1">Por ciclo académico</h2>
            <p className="mb-4 text-xs text-slate-500">Distribución agregada de certificaciones de I a X</p>
            {data.by_cycle.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.by_cycle} margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Certificaciones" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-20 text-center text-sm text-slate-500">Sin datos de ciclo.</p>
            )}
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (quality.length) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Corridas auditadas"
            value={quality.length}
            description="Procesos ETL completados con trazabilidad institucional"
          />
          <MetricCard
            label="Tasa de aceptación promedio"
            value={
              quality.length
                ? `${(
                    (quality.reduce(
                      (acc, q) => acc + (q.total_rows ? q.accepted_rows / q.total_rows : 1),
                      0,
                    ) /
                      quality.length) *
                    100
                  ).toFixed(1)}%`
                : "100%"
            }
            description="Porcentaje de registros validados sin rechazo de esquema"
          />
          <MetricCard
            label="Consistencia dimensional"
            value="100%"
            description="Población, periodo, corte y claves pseudonimizadas verificadas"
          />
        </div>

        <SurfaceCard className="overflow-x-auto p-5">
          <h2 className="section-title mb-1">Corridas ETL y calidad de datos</h2>
          <p className="mb-4 text-xs text-slate-500">
            Trazabilidad de filas procesadas, aceptadas, rechazadas y duplicadas por fecha de corte.
          </p>
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3">Fecha de corte</th>
                <th>Estado</th>
                <th>Total filas</th>
                <th>Aceptadas</th>
                <th>Rechazadas</th>
                <th>Duplicadas</th>
                <th>Tasa de éxito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quality.map((run) => {
                const rate =
                  run.total_rows > 0 ? ((run.accepted_rows / run.total_rows) * 100).toFixed(1) : "100.0";
                return (
                  <tr key={`${run.cutoff_date}-${run.status}`} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-900">{run.cutoff_date}</td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          run.status === "APPLIED" || run.status === "SUCCESS"
                            ? "border border-blue-200 bg-blue-50 text-blue-700"
                            : "border border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="font-medium text-slate-700">{run.total_rows}</td>
                    <td className="font-semibold text-blue-700">{run.accepted_rows}</td>
                    <td className={`font-semibold ${run.rejected_rows > 0 ? "text-slate-700" : "text-slate-400"}`}>
                      {run.rejected_rows}
                    </td>
                    <td className={`font-semibold ${run.duplicate_rows > 0 ? "text-blue-700" : "text-slate-400"}`}>
                      {run.duplicate_rows}
                    </td>
                    <td>
                      <span className="font-semibold text-blue-600">{rate}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SurfaceCard>
      </div>
    );
  }

  const checks = [
    { name: "Periodo y fecha de corte", value: data.filters.period_code && data.filters.cutoff_date ? 100 : 0 },
    { name: "Población activa disponible", value: data.kpis.active_students > 0 ? 100 : 0 },
    { name: "Dimensión proveedor disponible", value: data.by_issuer.length > 0 ? 100 : 0 },
    { name: "Dimensión habilidades disponible", value: data.by_skill.length > 0 ? 100 : 0 },
    { name: "Serie temporal disponible", value: data.evolution.length > 0 ? 100 : 0 },
  ];
  return (
    <SurfaceCard className="p-5">
      <h2 className="section-title mb-2">Controles de calidad del conjunto publicado</h2>
      <p className="mb-5 text-sm text-slate-500">Disponibilidad de dimensiones necesarias para construir los indicadores.</p>
      <MetricBars items={checks} />
    </SurfaceCard>
  );
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
    void apiFetch<AnalyticsReport>(`/indicators/reports/${reportPaths[report]}?${params}`)
      .then((value) => {
        if (!cancelled) {
          setPayload(value);
          setReportError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setReportError(error instanceof Error ? error.message : "No se pudo cargar el reporte.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    analytics.dataset,
    analytics.filters.cohort,
    analytics.filters.cutoff_date,
    analytics.filters.cycle,
    analytics.filters.issuer,
    analytics.filters.period_code,
    from,
    granularity,
    report,
    to,
  ]);

  const reportData = payload?.overview ?? analytics.data;
  const temporal = useMemo(() => {
    const grouped = new Map<string, { name: string; value: number; certifications: number }>();
    for (const point of payload?.temporal ?? analytics.data?.evolution ?? []) {
      if ((from && point.cutoff_date < from) || (to && point.cutoff_date > to)) continue;
      grouped.set(bucket(point.cutoff_date, granularity), {
        name: bucket(point.cutoff_date, granularity),
        value: point.certified_students,
        certifications: point.approved_certifications,
      });
    }
    return [...grouped.values()];
  }, [analytics.data, payload, from, to, granularity]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes de inteligencia de negocios"
        description="Seis reportes analíticos institucionales con filtros interactivos por periodo, año, mes o día."
      />
      <SurfaceCard className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <label className="text-xs font-semibold text-slate-600">
            Periodo
            <select
              value={analytics.filters.period_code}
              onChange={(event) => analytics.setFilter("period_code", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {analytics.periods.map((period) => (
                <option key={period.code}>{period.code}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Agrupar por
            <select
              value={granularity}
              onChange={(event) => setGranularity(event.target.value as Granularity)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="year">Año</option>
              <option value="month">Mes</option>
              <option value="day">Día</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Desde
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Proveedor
            <select
              value={analytics.filters.issuer}
              onChange={(event) => analytics.setFilter("issuer", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {analytics.options.issuers.map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Ingreso
            <select
              value={analytics.filters.cohort}
              onChange={(event) => analytics.setFilter("cohort", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {analytics.options.cohorts.map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Ciclo
            <select
              value={analytics.filters.cycle}
              onChange={(event) => analytics.setFilter("cycle", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {analytics.options.cycles.map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
        </div>
      </SurfaceCard>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Seleccionar reporte">
        {reports.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`/reportes/${reportPaths[id]}`}
            aria-current={report === id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              report === id
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <AsyncState
        loading={analytics.loading}
        error={analytics.error ?? reportError}
        empty={!reportData}
        onRetry={analytics.retry}
      >
        {reportData && (
          <>
            <ReportContent
              report={report}
              data={reportData}
              temporal={temporal}
              quality={payload?.quality ?? []}
            />
            <div className="flex justify-end">
              <ExportButton
                dataset={reportData.dataset}
                csvFilters={reportData.filters}
                csvOnly
                filename={`pulse-epis-${report}-${analytics.filters.period_code}.csv`}
                rows={rowsForReport(report, reportData, temporal, payload?.quality ?? [])}
                metadata={[
                  `Reporte: ${report}`,
                  `Granularidad: ${granularity}`,
                  `Rango: ${from || "inicio"} a ${to || "corte"}`,
                ]}
              />
            </div>
          </>
        )}
      </AsyncState>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RoleGate allow={["ADMIN", "VALIDATOR"]}>
      <ReportsDashboard />
    </RoleGate>
  );
}
