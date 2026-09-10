"use client";

import Link from "next/link";
import { Database, Users, ShieldCheck, Activity, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";

const modules = [
  { title: "Padrón EPIS", description: "Importa estudiantes activos y concilia correos institucionales.", href: "/admin/estudiantes", icon: Users, status: "Pendiente de fuente oficial" },
  { title: "Certificaciones", description: "Supervisa registros, evidencias, duplicados y vencimientos.", href: "/validaciones", icon: ShieldCheck, status: "3 registros de demostración" },
  { title: "Pipeline ETL", description: "Controla cargas, calidad y fecha de actualización del dashboard.", href: "/", icon: Database, status: "Datos simulados" },
];

export default function AdminPage() {
  return <RoleGate allow={["ADMIN"]}>
    <div className="space-y-7">
      <div><p className="text-sm font-bold text-blue-600 uppercase tracking-wider">Control institucional</p><h2 className="text-3xl font-black text-gray-900 mt-1">Centro de administración</h2><p className="text-gray-500 mt-2">Gestiona el ciclo completo desde el padrón hasta los indicadores publicados.</p></div>
      <section className="grid md:grid-cols-3 gap-5">
        {[{label:"Estudiantes activos",value:"Pendiente",icon:Users,color:"blue"},{label:"Certificaciones por validar",value:"3",icon:ShieldCheck,color:"amber"},{label:"Calidad de datos",value:"Modo demo",icon:Activity,color:"emerald"}].map((item) => <div key={item.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><item.icon className={`text-${item.color}-500 mb-5`} /><p className="text-sm text-gray-500">{item.label}</p><p className="text-2xl font-black text-gray-900 mt-1">{item.value}</p></div>)}
      </section>
      <section className="grid lg:grid-cols-3 gap-5">{modules.map((module)=><Link key={module.title} href={module.href} className="group bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition"><module.icon className="text-blue-600 mb-4"/><h3 className="font-bold text-gray-900 flex justify-between">{module.title}<ArrowRight className="group-hover:translate-x-1 transition" size={18}/></h3><p className="text-sm text-gray-500 mt-2 min-h-10">{module.description}</p><span className="inline-flex mt-5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">{module.status}</span></Link>)}</section>
      <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"><h3 className="font-bold text-gray-900">Ruta para habilitar datos reales</h3><div className="grid md:grid-cols-4 gap-4 mt-5">{["1. Obtener padrón EPIS", "2. Configurar acceso institucional", "3. Validar evidencias", "4. Publicar indicadores"].map((step,index)=><div key={step} className="flex gap-3"><div>{index===0?<AlertTriangle className="text-amber-500" size={20}/>:<CheckCircle2 className="text-gray-300" size={20}/>}</div><p className="text-sm font-semibold text-gray-700">{step}</p></div>)}</div></section>
    </div>
  </RoleGate>;
}
