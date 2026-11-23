"use client";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { ExportButton } from "@/shared/ui/ExportButton";
import { InteractiveProviderChart } from "../InteractiveProviderChart";
import { CertificationSummary } from "@/features/analytics/CertificationSummary";
import { PageHeader } from "@/shared/ui/DashboardPrimitives";
function TechnologiesContent() {
 const analytics = useAnalytics(); const data = analytics.data;
 const options = analytics.options;
 const rows = data?.by_credential?.map((r) => ({certificacion: r.name, aprobadas: r.value})) ?? [];
 return <div className="space-y-5"><PageHeader title="Certificaciones y tecnologías" description="Certificaciones aprobadas por entidad emisora y habilidad." />
 <AnalyticsFilters periods={analytics.periods} filters={analytics.filters} options={options} onChange={analytics.setFilter} source={{ dataset: analytics.dataset, available: analytics.referenceAvailable, onChange: analytics.setDataset }}/>
 <AsyncState loading={analytics.loading} error={analytics.error} empty={!data && !analytics.loading && !analytics.error} onRetry={analytics.retry}>{data && <><InteractiveProviderChart byIssuer={data.by_issuer} bySkill={data.by_skill}/><CertificationSummary items={data.by_credential ?? []}/><div className="flex justify-end"><ExportButton dataset={data.dataset} csvFilters={data.filters} filename={`certificaciones-${data.filters.period_code}.csv`} rows={rows}/></div></>}</AsyncState></div>;
}
export default function TecnologiasPage() { return <RoleGate allow={["ADMIN","VALIDATOR"]}><TechnologiesContent/></RoleGate>; }
