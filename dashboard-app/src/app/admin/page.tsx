"use client";
import Link from "next/link";
import { ArrowRight, Database, ShieldCheck, Users } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { AnalyticsSource } from "@/features/analytics/AnalyticsSource";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import {
  IndicatorCards,
  InstitutionalPriorities,
} from "@/features/admin/InstitutionalPriorities";
import { DataQuality } from "@/features/admin/DataQuality";
const modules = [
  {
    title: "Padrón EPIS",
    description:
      "Registra periodos, importa matrículas y revisa la conciliación.",
    href: "/admin/estudiantes",
    icon: Users,
    status: "Fuente académica",
  },
  {
    title: "Certificaciones",
    description:
      "Consulta credenciales, emisores y habilidades asociadas; la validación corresponde al validador.",
    href: "/tecnologias",
    icon: ShieldCheck,
    status: "Detalle disponible",
  },
  {
    title: "Publicar indicadores",
    description:
      "Genera cortes tras importar el padrón y revisa resultados del proceso.",
    href: "/admin/publicaciones",
    icon: Database,
    status: "Indicadores agregados",
  },
  {
    title: "Radar de cursos",
    description:
      "Consulta cursos relacionados con las habilidades de mayor interés.",
    href: "/admin/radar",
    icon: ShieldCheck,
    status: "Catálogo de cursos",
  },
];
function AdminContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-blue-600">
          Control institucional
        </p>
        <h1 className="mt-1 text-3xl font-black text-gray-900">
          Centro de administración
        </h1>
        <p className="mt-2 text-gray-500">
          Revisa la cobertura, identifica prioridades del corte y consulta la
          calidad antes de actualizar los indicadores.
        </p>
      </header>
      <AnalyticsSource
        dataset={analytics.dataset}
        available={analytics.referenceAvailable}
        onChange={analytics.setDataset}
      />
      <AnalyticsFilters
        periods={analytics.periods}
        filters={analytics.filters}
        options={analytics.options}
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
            <IndicatorCards data={data} />
            <InstitutionalPriorities data={data} />
            <DataQuality
              period={data.filters.period_code}
              cutoff={data.filters.cutoff_date}
              dataset={data.dataset}
            />
          </>
        )}
      </AsyncState>
      <section
        aria-label="Gestión administrativa"
        className="grid gap-5 lg:grid-cols-3"
      >
        {modules.map((module) => (
          <Link
            key={module.title}
            href={module.href}
            className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
          >
            <module.icon className="mb-4 text-blue-600" />
            <h2 className="flex justify-between font-bold text-gray-900">
              {module.title}
              <ArrowRight
                className="transition group-hover:translate-x-1"
                size={18}
              />
            </h2>
            <p className="mt-2 min-h-10 text-sm text-gray-500">
              {module.description}
            </p>
            <span className="mt-5 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              {module.status}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
export default function AdminPage() {
  return (
    <RoleGate allow={["ADMIN"]}>
      <AdminContent />
    </RoleGate>
  );
}
