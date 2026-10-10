"use client";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { AnalyticsSource } from "@/features/analytics/AnalyticsSource";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";
import { InteractiveProviderChart } from "../InteractiveProviderChart";
import { CertificationSummary } from "@/features/analytics/CertificationSummary";
function TechnologiesContent() {
 const analytics = useAnalytics(); const data = analytics.data;
 const options = analytics.options;
 const rows = data?.by_credential?.map((r) => ({certificacion: r.name, aprobadas: r.value})) ?? [];
 return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold text-slate-900">Certificaciones y tecnologías</h1><p className="mt-2 text-sm text-slate-500">Certificaciones aprobadas, entidades emisoras y habilidades acreditadas.</p></div>{data && <ExportButton dataset={data.dataset} filters={data.filters} filename={`certificaciones-${data.filters.period_code}.csv`} rows={rows}/>}</div>
 <AnalyticsSource dataset={analytics.dataset} local={analytics.local} onChange={analytics.setDataset}/>
 <AnalyticsFilters periods={analytics.periods} filters={analytics.filters} options={options} onChange={analytics.setFilter}/>
 <AsyncState loading={analytics.loading} error={analytics.error} empty={!data && !analytics.loading && !analytics.error} onRetry={analytics.retry}>{data && <><InteractiveProviderChart byIssuer={data.by_issuer} bySkill={data.by_skill}/><CertificationSummary items={data.by_credential ?? []}/></>}</AsyncState></div>;
}
export default function TecnologiasPage() { return <RoleGate allow={["ADMIN","VALIDATOR"]}><TechnologiesContent/></RoleGate>; }
