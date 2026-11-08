"use client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { apiFetch } from "@/shared/api/client";
import { PageHeader } from "@/shared/ui/DashboardPrimitives";

type StudentCertification = {
  id: string;
  issuer: string;
  credential_name: string;
  issued_on: string;
  expires_on: string | null;
  status: string;
};
type Student = {id: string; code: string | null; name: string | null; email: string | null; cycle: string | null; cohort: string | null; status: string; plan: string | null; certifications: StudentCertification[]};
type Directory = {period_code: string | null; total: number; items: Student[]};

const certificationClasses: Record<string, string> = {
  APPROVED: "border-blue-200 bg-blue-100 text-blue-900",
  PENDING: "border-slate-200 bg-slate-100 text-slate-700",
  UNDER_REVIEW: "border-blue-200 bg-blue-50 text-blue-700",
  OBSERVED: "border-sky-200 bg-sky-50 text-sky-800",
  RESUBMITTED: "border-blue-200 bg-blue-50 text-blue-800",
  REJECTED: "border-slate-200 bg-slate-100 text-slate-700",
  EXPIRED: "border-slate-200 bg-slate-100 text-slate-600",
};

export function StudentDirectory() {
  const [data, setData] = useState<Directory | null>(null);
  const [periods, setPeriods] = useState<{code: string}[]>([]);
  const [period, setPeriod] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  useEffect(() => { let active = true; apiFetch<{code: string}[]>("/padron/periods").then((p) => { if (active) setPeriods(p); }).catch((e) => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      const params = new URLSearchParams({q: query, offset: String(offset), limit: "25"});
      if (period) params.set("period_code", period);
      apiFetch<Directory>(`/padron/students?${params}`).then((d) => { if (active) setData(d); })
        .catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [period, query, offset, revision]);
  return <div className="space-y-5">
    <PageHeader title="Estudiantes" description="Registros del padrón académico importado." action={<Link href="/admin/estudiantes" className="text-sm font-semibold text-blue-700">Importar padrón</Link>} />
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-end gap-4 border-b border-slate-200 p-5">
        <label className="text-sm font-medium text-slate-700">Periodo<select value={period} onChange={(e) => {setPeriod(e.target.value); setOffset(0); setExpandedStudentId(null);}} className="mt-1 block rounded-md border border-slate-300 px-3 py-2"><option value="">Último con estudiantes{data?.period_code && !period ? ` · ${data.period_code}` : ""}</option>{periods.map((p) => <option key={p.code}>{p.code}</option>)}</select></label>
        <label className="min-w-60 flex-1 text-sm font-medium text-slate-700">Buscar estudiante<input type="search" placeholder="Nombre, código o correo institucional" value={query} onChange={(e) => {setQuery(e.target.value);setOffset(0);setExpandedStudentId(null);}} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"/></label>
        <button onClick={() => setRevision((r) => r + 1)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Actualizar</button>
      </div>
      {error ? <p role="alert" className="p-5 text-sm text-rose-700">{error}</p> : loading ? <p role="status" className="p-5 text-sm text-slate-500">Cargando estudiantes…</p> : <>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600"><tr>{["Estudiante", "Correo institucional", "Ciclo", "Año de ingreso", "Plan", "Estado", "Certificaciones"].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{data?.items.map((s) => { const expanded = expandedStudentId === s.id; const detailId = `student-certifications-${s.id}`; return <Fragment key={s.id}><tr className={`border-b border-slate-100 align-top transition ${expanded ? "bg-blue-50/50" : "hover:bg-slate-50"}`}><td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900"><button type="button" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedStudentId(expanded ? null : s.id)} className="inline-flex items-center gap-2 rounded text-left text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><span>{s.name ?? s.code ?? "No registrado"}{s.name && <small className="block font-normal text-slate-500">{s.code ?? "Sin código"}</small>}</span><ChevronDown aria-hidden="true" size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} /></button></td><td className="px-5 py-3 text-slate-600">{s.email ?? "—"}</td><td className="px-5 py-3">{s.cycle ?? "—"}</td><td className="px-5 py-3">{s.cohort ?? "—"}</td><td className="px-5 py-3">{s.plan ?? "—"}</td><td className="px-5 py-3">{({ACTIVE: "Activo", INACTIVE: "Inactivo", GRADUATED: "Egresado"} as Record<string,string>)[s.status] ?? s.status}</td><td className="px-5 py-3"><button type="button" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedStudentId(expanded ? null : s.id)} className="font-medium text-blue-700 hover:underline">{s.certifications.length} {s.certifications.length === 1 ? "certificación" : "certificaciones"}</button></td></tr>{expanded && <tr id={detailId} className="border-b border-slate-200 bg-slate-50/70"><td colSpan={7} className="px-5 py-4"><div className="flex flex-wrap gap-2">{s.certifications.length ? s.certifications.map((certification) => <span key={certification.id} title={`${certification.credential_name} · ${certification.issued_on}`} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${certificationClasses[certification.status] ?? "border-slate-200 bg-white text-slate-600"}`}>{certification.issuer}: {certification.credential_name}</span>) : <span className="text-sm text-slate-500">Sin certificaciones registradas.</span>}</div></td></tr>}</Fragment>; })}</tbody></table></div>
        {!data?.items.length && <p className="p-8 text-center text-sm text-slate-500">No hay estudiantes para este periodo o búsqueda.</p>}
        <div className="flex items-center justify-between gap-3 p-4 text-sm text-slate-600"><span>{data?.total ? `${offset + 1}–${Math.min(offset + 25, data.total)} de ${data.total} estudiantes` : "0 estudiantes"}</span><div className="flex gap-3"><button disabled={!offset} onClick={() => setOffset((o) => Math.max(0,o-25))} className="disabled:opacity-40">Anterior</button><button disabled={offset + 25 >= (data?.total ?? 0)} onClick={() => setOffset((o) => o+25)} className="disabled:opacity-40">Siguiente</button></div></div>
      </>}
    </section>
  </div>;
}
