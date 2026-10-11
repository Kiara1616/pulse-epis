"use client";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  Users,
  BookOpen,
  ScanSearch,
  Cpu,
  LayoutDashboard,
} from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
const modules = [
  {
    title: "Resumen",
    description:
      "Consulta cobertura, vencimientos y evolución por periodo y fecha de corte.",
    action: "Revisar situación institucional",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Tecnologías",
    description:
      "Explora credenciales, emisores y habilidades asociadas para identificar áreas de formación.",
    action: "Analizar la formación registrada",
    href: "/tecnologias",
    icon: Cpu,
  },
  {
    title: "Estudiantes",
    description:
      "Busca estudiantes y consulta su matrícula, trayectoria y credenciales con acceso autorizado.",
    action: "Consultar una trayectoria",
    href: "/estudiantes",
    icon: Users,
  },
  {
    title: "Brechas",
    description:
      "Identifica habilidades con menor cobertura de certificaciones en la población del corte.",
    action: "Identificar prioridades formativas",
    href: "/brechas",
    icon: ScanSearch,
  },
  {
    title: "Padrón EPIS",
    description:
      "Registra periodos, revisa archivos CSV e importa matrículas con reporte e historial.",
    action: "Actualizar la población académica",
    href: "/admin/estudiantes",
    icon: Users,
  },
  {
    title: "Radar formativo",
    description:
      "Registra y corrige borradores, revisa fuentes y compara cursos por contenido y costo grupal opcional.",
    action: "Planificar oportunidades",
    href: "/admin/oportunidades",
    icon: BookOpen,
  },
  {
    title: "Publicar indicadores",
    description:
      "Genera el corte del periodo tras importar el padrón y consulta los resultados de calidad.",
    action: "Actualizar el tablero",
    href: "/admin/publicaciones",
    icon: Database,
  },
];
export default function AdminPage() {
  return (
    <RoleGate allow={["ADMIN"]}>
      <div className="space-y-7">
        <header>
          <p className="text-sm font-bold uppercase tracking-wider text-blue-600">
            Control institucional
          </p>
          <h1 className="mt-1 text-3xl font-black text-gray-900">
            Centro de administración
          </h1>
          <p className="mt-2 text-gray-500">
            Actualiza los datos, revisa la cobertura y organiza la formación
            complementaria de EPIS.
          </p>
        </header>
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
          <h2 className="font-bold text-blue-950">¿Qué necesitas hacer?</h2>
          <div className="mt-4 grid gap-3 text-sm text-blue-900 md:grid-cols-3">
            <Link
              href="/admin/estudiantes"
              className="rounded-xl bg-white p-4 font-semibold hover:shadow-sm"
            >
              Actualizar matrículas → Padrón
            </Link>
            <Link
              href="/admin/publicaciones"
              className="rounded-xl bg-white p-4 font-semibold hover:shadow-sm"
            >
              Actualizar cifras → Publicar indicadores
            </Link>
            <Link
              href="/admin/oportunidades"
              className="rounded-xl bg-white p-4 font-semibold hover:shadow-sm"
            >
              Elegir formación → Radar formativo
            </Link>
          </div>
        </section>
        <section
          aria-label="Módulos administrativos"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {modules.map((module) => (
            <Link
              key={module.title}
              href={module.href}
              className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <module.icon className="mb-4 text-blue-600" />
              <h2 className="flex justify-between font-bold text-gray-900">
                {module.title}
                <ArrowRight
                  className="shrink-0 transition group-hover:translate-x-1"
                  size={18}
                />
              </h2>
              <p className="mt-2 text-sm text-gray-500">{module.description}</p>
              <span className="mt-auto pt-5 text-sm font-semibold text-blue-700">
                {module.action}
              </span>
            </Link>
          ))}
        </section>
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-gray-900">
            Responsabilidades de la escuela
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            El administrador mantiene el padrón, publica cortes y revisa
            oportunidades formativas. Las decisiones sobre evidencias de
            certificaciones corresponden al validador. Las cifras se consultan
            con su fuente, periodo y corte; los datos de demostración se
            distinguen de los registros institucionales.
          </p>
          <p className="mt-3 text-sm text-gray-600">
            La publicación de una oportunidad incorpora el curso al catálogo
            administrativo. Su distribución a estudiantes y la recolección
            automática de fuentes siguen pendientes.
          </p>
        </section>
      </div>
    </RoleGate>
  );
}
