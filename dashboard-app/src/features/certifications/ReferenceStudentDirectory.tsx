"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/shared/api/client";

type TraceEvent = { role: "STUDENT" | "VALIDATOR" | "ADMIN"; action: string; date: string; reference?: string };
type ReferenceCertification = {
  id: string;
  issuer: string;
  credential_name: string;
  issued_on: string;
  expires_on: string | null;
  status: string;
  skills: { name: string; level: string | null }[];
  traceability: { source: "EXAMPLE"; student: TraceEvent; validator: TraceEvent; administrator: TraceEvent };
};
type ReferenceStudent = {
  id: string;
  code: string;
  display_name: string;
  email: string | null;
  cycle: string | null;
  cohort: string | null;
  status: string;
  certifications: ReferenceCertification[];
};
type ReferenceDirectory = {
  dataset: "demo";
  reference_label: string;
  period_code: string | null;
  cutoff_date: string | null;
  total: number;
  items: ReferenceStudent[];
};
type AnalyticsPeriod = { code: string; latest_cutoff_date: string | null };

const PAGE_SIZE = 25;

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function ReferenceStudentDirectory() {
  const [periods, setPeriods] = useState<AnalyticsPeriod[]>([]);
  const [period, setPeriod] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<ReferenceDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [periodsRevision, setPeriodsRevision] = useState(-1);

  useEffect(() => {
    let active = true;
    apiFetch<AnalyticsPeriod[]>("/indicators/periods?dataset=demo")
      .then((items) => {
        if (!active) return;
        setPeriods(items);
        if (!items.length) {
          setPeriodsRevision(-1);
          setData(null);
          setError("No hay periodos disponibles para consultar.");
          setLoading(false);
          return;
        }
        setPeriod((current) => items.some((item) => item.code === current) ? current : items.at(-1)?.code || "");
        setPeriodsRevision(revision);
      })
      .catch((loadError) => {
        if (!active) return;
        setPeriodsRevision(-1);
        setData(null);
        setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los periodos.");
        setLoading(false);
      });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    if (!period || periodsRevision !== revision) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ period_code: period, q: query, offset: String(offset), limit: String(PAGE_SIZE) });
      apiFetch<ReferenceDirectory>(`/indicators/reference/students?${params}`)
        .then((result) => { if (active) setData(result); })
        .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los estudiantes."); })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [period, query, offset, revision, periodsRevision]);

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">Datos de referencia · no oficiales</p><h1 className="mt-2 text-3xl font-semibold text-slate-900">Estudiantes y certificaciones</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Los registros sirven para visualizar la plataforma. Las credenciales y fechas son ejemplos y no representan validaciones institucionales registradas.</p></div>
      <button onClick={() => { setLoading(true); setData(null); setError(""); setPeriodsRevision(-1); setRevision((value) => value + 1); }} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Actualizar</button>
    </header>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end gap-4 border-b border-slate-200 p-5">
        <label className="text-sm font-medium text-slate-700">Periodo<select value={period} onChange={(event) => { setPeriod(event.target.value); setOffset(0); }} className="mt-1 block rounded-md border border-slate-300 px-3 py-2">{periods.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select></label>
        <label className="min-w-60 flex-1 text-sm font-medium text-slate-700">Buscar estudiante<input type="search" placeholder="Nombre, código o correo" value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"/></label>
        <div className="text-sm text-slate-500">Corte: {dateLabel(data?.cutoff_date ?? periods.find((item) => item.code === period)?.latest_cutoff_date ?? null)}</div>
      </div>

      {error ? <p role="alert" className="p-5 text-sm text-rose-700">{error}</p> : loading ? <p role="status" className="p-5 text-sm text-slate-500">Cargando registros…</p> : <>
        <div className="space-y-4 p-5">
          {data?.items.map((student) => <article key={student.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-semibold text-slate-900">{student.display_name}</h2><p className="mt-1 text-sm text-slate-500">{student.code}{student.email ? ` · ${student.email}` : ""}</p></div>
              <div className="text-right text-sm text-slate-500">Ciclo {student.cycle ?? "—"} · ingreso {student.cohort ?? "—"}<div className="mt-1 font-medium text-emerald-700">Activo · {student.certifications.length} certificaciones</div></div>
            </div>
            {student.certifications.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {student.certifications.map((certificate) => <details key={certificate.id} className="rounded-md bg-slate-50 p-3">
                <summary className="cursor-pointer list-none"><span className="text-xs font-semibold text-emerald-700">Aprobada · referencia no oficial</span><p className="mt-1 font-semibold text-slate-900">{certificate.credential_name}</p><p className="mt-1 text-sm text-slate-600">{certificate.issuer} · emitida {dateLabel(certificate.issued_on)}</p></summary>
                <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
                  <div><p className="font-semibold text-slate-700">Habilidades</p><p className="mt-1">{certificate.skills.map((skill) => `${skill.name}${skill.level ? ` · ${skill.level}` : ""}`).join(", ")}</p></div>
                  <div className="grid gap-2 sm:grid-cols-3">{([certificate.traceability.student, certificate.traceability.validator, certificate.traceability.administrator] as TraceEvent[]).map((event) => <div key={`${event.role}-${event.date}`} className="rounded border border-slate-200 bg-white p-2"><p className="font-semibold">{event.role === "STUDENT" ? "Estudiante" : event.role === "VALIDATOR" ? "Validador" : "Administrador"}</p><p className="mt-1 text-amber-700">Evento de ejemplo</p><p className="mt-1">{event.action}</p><p className="mt-1">{dateLabel(event.date)}</p></div>)}</div>
                </div>
              </details>)}
            </div> : <p className="mt-4 text-sm text-slate-500">Sin certificaciones aprobadas en este corte.</p>}
          </article>)}
          {!data?.items.length && <p className="py-8 text-center text-sm text-slate-500">No hay estudiantes para este periodo o búsqueda.</p>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm text-slate-600"><span>{data?.total ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, data.total)} de ${data.total} estudiantes` : "0 estudiantes"}</span><div className="flex gap-3"><button disabled={!offset} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} className="disabled:opacity-40">Anterior</button><button disabled={offset + PAGE_SIZE >= (data?.total ?? 0)} onClick={() => setOffset((value) => value + PAGE_SIZE)} className="disabled:opacity-40">Siguiente</button></div></div>
      </>}
    </section>
  </div>;
}
