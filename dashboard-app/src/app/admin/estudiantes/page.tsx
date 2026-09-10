"use client";

import { useState } from "react";
import { Upload, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";

const students = [
  { key: "EPIS-0001", email: "kz****@virtual.upt.pe", cohort: "2023", semester: "7mo", status: "Activo", match: "Conciliado" },
  { key: "EPIS-0002", email: "vl****@virtual.upt.pe", cohort: "2023", semester: "7mo", status: "Activo", match: "Conciliado" },
  { key: "EPIS-0003", email: "ar****@virtual.upt.pe", cohort: "2022", semester: "9no", status: "Activo", match: "Por revisar" },
];

export default function StudentsAdminPage() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const filtered = students.filter((student) => Object.values(student).some((value) => value.toLowerCase().includes(query.toLowerCase())));
  return <RoleGate allow={["ADMIN"]}><div className="space-y-6">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4"><div><p className="text-sm font-bold text-blue-600 uppercase tracking-wider">Fuente maestra</p><h2 className="text-3xl font-black text-gray-900 mt-1">Padrón de estudiantes EPIS</h2><p className="text-gray-500 mt-2">La demostración usa datos anonimizados. En producción se cargará el padrón oficial por periodo.</p></div><button onClick={()=>setMessage("Demostración: aquí se seleccionará el CSV oficial y se mostrará una previsualización antes de confirmar.")} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold"><Upload size={18}/>Importar padrón</button></div>
    {message&&<div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-sm">{message}</div>}
    <section className="grid md:grid-cols-3 gap-4"><div className="bg-white p-5 rounded-2xl border border-gray-100"><p className="text-sm text-gray-500">Registros de muestra</p><p className="text-3xl font-black mt-1">3</p></div><div className="bg-white p-5 rounded-2xl border border-gray-100"><p className="text-sm text-gray-500">Conciliados</p><p className="text-3xl font-black mt-1 text-emerald-600">2</p></div><div className="bg-white p-5 rounded-2xl border border-gray-100"><p className="text-sm text-gray-500">Por revisar</p><p className="text-3xl font-black mt-1 text-amber-600">1</p></div></section>
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"><div className="p-5 border-b border-gray-100 flex items-center gap-3"><Search size={18} className="text-gray-400"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar por identificador, cohorte o ciclo" className="w-full outline-none text-sm"/></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-gray-500 text-left"><tr>{["Identificador","Correo protegido","Cohorte","Ciclo","Estado","Conciliación"].map(h=><th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody>{filtered.map(s=><tr key={s.key} className="border-t border-gray-100"><td className="px-5 py-4 font-bold">{s.key}</td><td className="px-5 py-4">{s.email}</td><td className="px-5 py-4">{s.cohort}</td><td className="px-5 py-4">{s.semester}</td><td className="px-5 py-4 text-emerald-700">{s.status}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1 ${s.match==="Conciliado"?"text-emerald-700":"text-amber-700"}`}>{s.match==="Conciliado"?<CheckCircle2 size={15}/>:<AlertCircle size={15}/>} {s.match}</span></td></tr>)}</tbody></table></div></section>
  </div></RoleGate>;
}
