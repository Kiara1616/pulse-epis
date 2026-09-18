"use client";

import Link from "next/link";
import { ArrowRight, Database, ShieldCheck, Users } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";

const modules = [
  { title: "Padrón EPIS", description: "Importa estudiantes activos y revisa la conciliación por periodo.", href: "/admin/estudiantes", icon: Users, status: "API conectada" },
  { title: "Certificaciones", description: "El equipo validador supervisa registros, evidencias, duplicados y vencimientos.", href: null, icon: ShieldCheck, status: "Gestionado por validadores" },
  { title: "Pipeline ETL", description: "Consulta indicadores provenientes de snapshots publicados.", href: "/", icon: Database, status: "Indicadores agregados" },
];

export default function AdminPage() {
  return <RoleGate allow={["ADMIN"]}><div className="space-y-7">
    <div><p className="text-sm font-bold uppercase tracking-wider text-blue-600">Control institucional</p><h1 className="mt-1 text-3xl font-black text-gray-900">Centro de administración</h1><p className="mt-2 text-gray-500">Gestiona las fuentes de datos y navega hacia los módulos protegidos por permisos de la API.</p></div>
    <section className="grid gap-5 lg:grid-cols-3">{modules.map((module) => {
      const Icon = module.icon;
      const card = <><Icon className="mb-4 text-blue-600"/><h2 className="flex justify-between font-bold text-gray-900">{module.title}{module.href && <ArrowRight className="transition group-hover:translate-x-1" size={18}/>}</h2><p className="mt-2 min-h-10 text-sm text-gray-500">{module.description}</p><span className="mt-5 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{module.status}</span></>;
      return module.href ? <Link key={module.title} href={module.href} className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md">{card}</Link> : <article key={module.title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">{card}</article>;
    })}</section>
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6"><h2 className="font-bold text-blue-950">Flujo de datos conectado</h2><ol className="mt-4 grid gap-3 text-sm font-semibold text-blue-900 md:grid-cols-4"><li>1. Importar padrón autorizado</li><li>2. Registrar certificaciones</li><li>3. Validar evidencias</li><li>4. Publicar indicadores</li></ol></section>
  </div></RoleGate>;
}
