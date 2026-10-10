"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsSource } from "@/features/analytics/AnalyticsSource";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";
import { useRole } from "@/features/access/RoleProvider";
import { StudentDirectory } from "@/features/certifications/StudentDirectory";

function StudentsContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  const options = analytics.options;
  const rows = data?.by_cohort.map((item) => ({ anio_ingreso: item.name, certificaciones: item.value })) ?? [];

  return <div className="flex w-full flex-col gap-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-wider text-blue-600">Cifras agregadas</p><h1 className="mt-1 text-3xl font-bold text-gray-900">Certificaciones por año de ingreso</h1><p className="mt-1 text-gray-500">El dashboard no muestra rankings nominales; protege la identidad y consulta hechos agregados del ETL.</p></div>{data && <ExportButton dataset={data.dataset} filters={data.filters} filename={`pulse-epis-cohortes-${data.filters.period_code}.csv`} rows={rows} metadata={["Fuente: GET /api/v1/indicators/overview", `Corte: ${data.filters.cutoff_date}`]}/>}</div>
    <AnalyticsSource dataset={analytics.dataset} local={analytics.local} onChange={analytics.setDataset}/>
    <AnalyticsFilters periods={analytics.periods} filters={analytics.filters} options={options} onChange={analytics.setFilter}/>
    <AsyncState loading={analytics.loading} error={analytics.error} empty={!data && !analytics.loading && !analytics.error} onRetry={analytics.retry}>
      {data && <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-gray-800">Certificaciones por año de ingreso</h2><p className="mb-6 mt-2 text-sm text-gray-500">Cantidad de certificaciones aprobadas por año de ingreso.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Año de ingreso</th><th className="px-4 py-3">Certificaciones</th></tr></thead><tbody>{data.by_cohort.map((item) => <tr key={item.name} className="border-b border-gray-100"><td className="px-4 py-3 font-medium text-gray-900">{item.name}</td><td className="px-4 py-3 font-bold text-emerald-600">{item.value}</td></tr>)}</tbody></table></div></section>
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-gray-800">Certificaciones por ciclo</h2><p className="mb-6 mt-2 text-sm text-gray-500">Distribución agregada por ciclo académico.</p><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.by_cycle} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal vertical={false}/><XAxis type="number" allowDecimals={false}/><YAxis dataKey="name" type="category" width={90}/><Tooltip/><Bar dataKey="value" name="Certificaciones" fill="#6366f1" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></section>
      </div>}
    </AsyncState>
  </div>;
}

export default function EstudiantesPage() {
  const { role } = useRole();
  return <RoleGate allow={["ADMIN", "VALIDATOR"]}>{role === "ADMIN" ? <StudentDirectory/> : <StudentsContent/>}</RoleGate>;
}
