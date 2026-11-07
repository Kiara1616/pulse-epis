"use client";

import Link from "next/link";
import { ArrowRight, Award, CalendarDays, Database, ScanSearch, UsersRound } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { PageHeader, SectionHeading } from "@/shared/ui/DashboardPrimitives";

const groups = [
  {
    title: "Datos institucionales",
    description: "Prepara y publica la información que alimenta los indicadores.",
    actions: [
      {
        title: "Padrón y periodos",
        description: "Registra periodos e importa matrículas.",
        href: "/admin/estudiantes",
        icon: UsersRound,
      },
      {
        title: "Publicar indicadores",
        description: "Genera indicadores y revisa su calidad.",
        href: "/admin/publicaciones",
        icon: Database,
      },
    ],
  },
  {
    title: "Oferta académica",
    description: "Revisa las oportunidades disponibles para estudiantes.",
    actions: [
      {
        title: "Radar de cursos",
        description: "Revisa cursos vinculados con el programa.",
        href: "/admin/radar",
        icon: ScanSearch,
      },
      {
        title: "Talleres",
        description: "Publica talleres y gestiona solicitudes.",
        href: "/talleres",
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "Catálogos",
    description: "Controla las entidades y certificaciones que declaran los estudiantes.",
    actions: [{ title: "Entidades y certificaciones", description: "Mantén emisoras, habilidades y solicitudes de alta.", href: "/admin/catalogo", icon: Award }],
  },
] as const;

function AdminContent() {
  return (
    <div className="space-y-8">
      <PageHeader title="Administración" description="Gestiona fuentes de datos y actividades académicas." />

      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <div className="mb-4"><SectionHeading title={group.title} description={group.description} /></div>
          <div className="grid gap-4 lg:grid-cols-2">
            {group.actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="surface-card group flex min-h-36 flex-col p-5 transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <action.icon aria-hidden="true" size={22} className="text-blue-700" />
                  <ArrowRight aria-hidden="true" size={18} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700" />
                </div>
                <h3 className="card-title mt-4">{action.title}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600">{action.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AdminPage() {
  return <RoleGate allow={["ADMIN"]}><AdminContent /></RoleGate>;
}
