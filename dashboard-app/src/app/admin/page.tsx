"use client";
import Link from "next/link";
import { ArrowRight, CalendarDays, Database, ShieldCheck, Users } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { AsyncState } from "@/shared/ui/AsyncState";
import { IndicatorCards } from "@/features/admin/InstitutionalPriorities";
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
  {
    title: "Talleres y eventos",
    description:
      "Convierte oportunidades y cursos en talleres académicos por ciclo.",
    href: "/talleres",
    icon: CalendarDays,
    status: "Actividades académicas",
  },
];
function AdminContent() {
  const analytics = useAnalytics();
  const data = analytics.data;
  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow">
          Control institucional
        </p>
        <h1 className="page-title mt-1">
          Centro de administración
        </h1>
        <p className="mt-2 text-gray-500">
          Administra las fuentes, publicaciones y oportunidades académicas.
        </p>
      </header>
      <AnalyticsFilters
        periods={analytics.periods}
        filters={analytics.filters}
        options={analytics.options}
        onChange={analytics.setFilter}
        variant="summary"
      />
      <AsyncState
        loading={analytics.loading}
        error={analytics.error}
        empty={!data && !analytics.loading && !analytics.error}
        onRetry={analytics.retry}
      >
        {data && <IndicatorCards data={data} />}
      </AsyncState>
      <section
        aria-label="Gestión administrativa"
        className="grid gap-5 lg:grid-cols-3"
      >
        {modules.map((module) => (
          <Link
            key={module.title}
            href={module.href}
            className="surface-card group p-6 transition hover:border-blue-200 hover:shadow-md"
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
            <span className="mt-5 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
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
