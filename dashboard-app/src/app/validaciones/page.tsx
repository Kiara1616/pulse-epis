"use client";

import { useState } from "react";
import { Check, Eye, X, Clock3, ExternalLink } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";

type Status = "Pendiente" | "Validada" | "Observada";
const initial = [
  { id: 1, student: "EPIS-0001", certification: "AWS Certified Cloud Practitioner", issuer: "AWS", issued: "15/05/2024", evidence: "URL pública", status: "Pendiente" as Status },
  { id: 2, student: "EPIS-0002", certification: "Microsoft Azure Fundamentals", issuer: "Microsoft", issued: "20/08/2024", evidence: "PDF", status: "Pendiente" as Status },
  { id: 3, student: "EPIS-0003", certification: "Cisco CCNA", issuer: "Cisco", issued: "10/11/2023", evidence: "ID de credencial", status: "Pendiente" as Status },
];

export default function ValidationsPage() {
  const [records, setRecords] = useState(initial);
  const update = (id: number, status: Status) => setRecords((rows)=>rows.map((row)=>row.id===id?{...row,status}:row));
  return <RoleGate allow={["ADMIN","VALIDATOR"]}><div className="space-y-6">
    <div><p className="text-sm font-bold text-blue-600 uppercase tracking-wider">Control de evidencia</p><h2 className="text-3xl font-black text-gray-900 mt-1">Bandeja de validaciones</h2><p className="text-gray-500 mt-2">Revisa titular, emisor, vigencia y duplicados antes de incluir una certificación en los indicadores.</p></div>
    <section className="grid md:grid-cols-3 gap-4">{(["Pendiente","Validada","Observada"] as Status[]).map(status=><div key={status} className="bg-white border border-gray-100 rounded-2xl p-5"><p className="text-sm text-gray-500">{status}s</p><p className="text-3xl font-black mt-1">{records.filter(r=>r.status===status).length}</p></div>)}</section>
    <section className="space-y-4">{records.map(record=><article key={record.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center gap-5"><div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Clock3/></div><div className="flex-1"><div className="flex items-center gap-2"><h3 className="font-bold text-gray-900">{record.certification}</h3><span className={`text-xs px-2 py-1 rounded-full font-bold ${record.status==="Validada"?"bg-emerald-50 text-emerald-700":record.status==="Observada"?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700"}`}>{record.status}</span></div><p className="text-sm text-gray-500 mt-1">{record.student} · {record.issuer} · Emitida {record.issued} · {record.evidence}</p></div><div className="flex flex-wrap gap-2"><button className="p-2.5 border border-gray-200 rounded-lg text-gray-600" title="Ver evidencia"><ExternalLink size={17}/></button><button onClick={()=>update(record.id,"Validada")} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold"><Check size={16}/>Validar</button><button onClick={()=>update(record.id,"Observada")} className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-bold"><Eye size={16}/>Observar</button><button onClick={()=>update(record.id,"Observada")} className="p-2.5 bg-rose-50 text-rose-700 rounded-lg" title="Rechazar"><X size={17}/></button></div></article>)}</section>
  </div></RoleGate>;
}
