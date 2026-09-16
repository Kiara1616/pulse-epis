"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";

function TechnologiesContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  const options = { issuers: data?.by_issuer ?? [], levels: data?.by_level ?? [], cohorts: data?.by_cohort ?? [], cycles: data?.by_cycle ?? [] };
  const exportRows = data?.by_issuer.map((item) => ({ proveedor: item.name, certificaciones: item.value })) ?? [];

  return <div className="flex w-full flex-col gap-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-wider text-blue-600">Indicadores por proveedor</p><h1 className="mt-1 text-3xl font-bold text-gray-900">Proveedores y niveles</h1><p className="mt-1 font-medium text-gray-500">Distribución calculada desde el snapshot ETL publicado.</p></div>{data && <ExportButton filename={`pulse-epis-proveedores-${data.filters.period_code}.csv`} rows={exportRows} metadata={["Fuente: GET /api/v1/indicators/overview", `Corte: ${data.filters.cutoff_date}`]}/>}</div>
    <AnalyticsFilters periods={analytics.periods} filters={analytics.filters} options={options} onChange={analytics.setFilter}/>
    <AsyncState loading={analytics.loading} error={analytics.error} empty={!data && !analytics.loading && !analytics.error} onRetry={analytics.retry}>
      {data && <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Participación por proveedor" description="Certificaciones aprobadas agrupadas por entidad emisora."><div className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.by_issuer} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} label>{data.by_issuer.map((entry, index) => <Cell key={entry.name} fill={["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"][index % 5]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></ChartCard>
        <ChartCard title="Niveles de certificación" description="Cantidad aprobada por nivel de complejidad."><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.by_level}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Bar dataKey="value" name="Certificaciones" fill="#2563eb" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></ChartCard>
      </div>}
    </AsyncState>
  </div>;
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-gray-900">{title}</h2><p className="mb-6 mt-2 text-sm font-medium text-gray-500">{description}</p>{children}</section>;
}

export default function TecnologiasPage() {
  return <RoleGate allow={["ADMIN", "VALIDATOR"]}><TechnologiesContent/></RoleGate>;
}
