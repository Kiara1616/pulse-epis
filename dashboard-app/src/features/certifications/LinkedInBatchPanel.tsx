"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/shared/api/client";

type BatchStudent = {
  id: string;
  code: string | null;
  name: string | null;
  email: string | null;
  cycle: string | null;
  linkedin_url: string | null;
  linkedin_sync_status: "NEVER" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";
  linkedin_last_sync_at: string | null;
  linkedin_sync_error: string | null;
  pending_candidates: number;
  selectable: boolean;
};

type BatchResponse = {
  period_code: string | null;
  total: number;
  items: BatchStudent[];
};

type BatchRunResponse = {
  requested: number;
  processed: number;
  skipped: number;
  failed: number;
  message: string;
};

type Period = { code: string; starts_on: string; ends_on: string };

const MAX_BATCH = 5;

function syncLabel(student: BatchStudent) {
  if (!student.linkedin_url) return "Sin enlace";
  if (student.linkedin_sync_status === "SUCCEEDED") return "Sincronizado";
  if (student.linkedin_sync_status === "RUNNING") return "En proceso";
  if (student.linkedin_sync_status === "PARTIAL") return "Parcial";
  if (student.linkedin_sync_status === "FAILED") return "Reintentar";
  return "Nunca sincronizado";
}
function syncClasses(student: BatchStudent) {
  if (!student.linkedin_url) return "bg-slate-100 text-slate-600";
  if (student.linkedin_sync_status === "SUCCEEDED") return "bg-blue-50 text-blue-800";
  if (student.linkedin_sync_status === "FAILED") return "bg-rose-50 text-rose-700";
  if (student.linkedin_sync_status === "RUNNING") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function dateLabel(value: string | null) {
  if (!value) return "Sin sincronización";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin sincronización"
    : new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function LinkedInBatchPanel() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [period, setPeriod] = useState("");
  const [cycle, setCycle] = useState("");
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<BatchResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  // Inspect profile certifications and public posts by default; staff can opt out.
  const [includePublications, setIncludePublications] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100", sync_status: status });
      if (period) params.set("period_code", period);
      if (cycle) params.set("cycle", cycle);
      if (query.trim()) params.set("q", query.trim());
      const result = await apiFetch<BatchResponse>(`/certifications/linkedin/batch/students?${params}`);
      setData(result);
      setSelected((current) => new Set([...current].filter((id) => result.items.some((item) => item.id === id && item.selectable && (status === "SUCCEEDED" || item.linkedin_sync_status !== "SUCCEEDED")))));
      if (!period && result.period_code) setPeriod(result.period_code);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el estado de LinkedIn.");
    } finally {
      setLoading(false);
    }
  }, [cycle, period, query, status]);

  useEffect(() => {
    let active = true;
    apiFetch<Period[]>("/indicators/periods")
      .then((items) => {
        if (!active) return;
        setPeriods(items);
      })
      .catch(() => {
        // The batch endpoint still resolves the latest period if analytics
        // periods are not published yet.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStudents(), 180);
    return () => window.clearTimeout(timer);
  }, [loadStudents]);

  const cycles = useMemo(
    () => [...new Set((data?.items ?? []).map((item) => item.cycle).filter((item): item is string => Boolean(item)))].sort(),
    [data?.items],
  );
  // A successful profile is displayed for traceability, but it is not part of
  // the default "Todos" selection.  Staff can deliberately choose the
  // "Sincronizado" filter when a scheduled refresh is needed.
  const canSelect = useCallback((student: BatchStudent) => {
    if (!student.selectable) return false;
    return status === "SUCCEEDED" || student.linkedin_sync_status !== "SUCCEEDED";
  }, [status]);
  const visibleSelectable = useMemo(
    () => (data?.items ?? []).filter((item) => canSelect(item)),
    [canSelect, data?.items],
  );
  const allVisibleSelected = visibleSelectable.length > 0 && visibleSelectable.every((item) => selected.has(item.id));

  function toggleStudent(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_BATCH) next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleSelectable.forEach((item) => next.delete(item.id));
      } else {
        visibleSelectable.slice(0, MAX_BATCH).forEach((item) => next.add(item.id));
      }
      return next;
    });
  }

  async function runBatch() {
    if (selected.size === 0) return;
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const result = await apiFetch<BatchRunResponse>("/certifications/linkedin/batch/sync", {
        method: "POST",
        body: JSON.stringify({
          student_ids: [...selected],
          force: status === "SUCCEEDED",
          include_publications: includePublications,
        }),
      });
      setMessage(`${result.message} Procesados: ${result.processed}; omitidos: ${result.skipped}; con error: ${result.failed}.`);
      setSelected(new Set());
      await loadStudents();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "No se pudo ejecutar el lote.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Extracción controlada</p>
          <h2 className="card-title mt-1">Sincronizar LinkedIn</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Selecciona estudiantes con enlace válido. Pulse no vuelve a consultar un perfil recién sincronizado y conserva el historial de candidatos.
          </p>
        </div>
        <button type="button" onClick={() => void loadStudents()} disabled={loading || running} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualizar estado
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[180px_150px_190px_1fr]">
        <label className="text-sm font-medium text-slate-700">Periodo de sincronización<select value={period} onChange={(event) => { setPeriod(event.target.value); setCycle(""); }} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="">Último disponible</option>{periods.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Ciclo<select value={cycle} onChange={(event) => setCycle(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="">Todos</option>{cycles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Estado<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="ALL">Todos</option><option value="NO_URL">Sin enlace</option><option value="NEVER">Nunca sincronizado</option><option value="SUCCEEDED">Sincronizado</option><option value="PARTIAL">Parcial</option><option value="FAILED">Con error</option></select></label>
        <label className="text-sm font-medium text-slate-700">Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, código o correo" className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2" /></label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-slate-700">
        <span><strong>{selected.size}</strong> seleccionados · máximo {MAX_BATCH} por lote</span>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includePublications} onChange={(event) => setIncludePublications(event.target.checked)} className="h-4 w-4 accent-blue-600" /> Buscar también publicaciones</label>
        <button type="button" disabled={!selected.size || running} onClick={() => void runBatch()} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{running ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Procesando…</span> : status === "SUCCEEDED" ? "Actualizar seleccionados" : "Sincronizar seleccionados"}</button>
      </div>

      {message && <p role="status" className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
      {error && <p role="alert" className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} />{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        {loading ? <p className="p-6 text-center text-sm text-slate-500">Cargando estudiantes…</p> : !data?.items.length ? <p className="p-6 text-center text-sm text-slate-500">No hay estudiantes con estos filtros.</p> : <table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Seleccionar estudiantes visibles" checked={allVisibleSelected} onChange={toggleVisible} className="h-4 w-4 accent-blue-600" /></th><th className="px-4 py-3">Estudiante</th><th className="px-4 py-3">Ciclo</th><th className="px-4 py-3">LinkedIn</th><th className="px-4 py-3">Última consulta</th><th className="px-4 py-3">Pendientes</th></tr></thead><tbody>{data.items.map((student) => <tr key={student.id} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3"><input type="checkbox" aria-label={`Seleccionar ${student.name ?? student.code ?? "estudiante"}`} disabled={!canSelect(student) || (!selected.has(student.id) && selected.size >= MAX_BATCH)} checked={selected.has(student.id)} onChange={() => toggleStudent(student.id)} className="h-4 w-4 accent-blue-600" /></td><td className="px-4 py-3"><p className="font-semibold text-slate-900">{student.name ?? "Sin nombre"}</p><p className="text-xs text-slate-500">{student.code ?? student.email ?? "Sin código"}</p></td><td className="px-4 py-3 text-slate-700">{student.cycle ?? "—"}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${syncClasses(student)}`}>{student.linkedin_sync_status === "SUCCEEDED" && <CheckCircle2 size={13} />}{syncLabel(student)}</span>{student.linkedin_url && <a href={student.linkedin_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">Abrir perfil <ExternalLink size={12} /></a>}</td><td className="px-4 py-3 text-xs text-slate-500">{dateLabel(student.linkedin_last_sync_at)}</td><td className="px-4 py-3 text-slate-700">{student.pending_candidates || "—"}</td></tr>)}</tbody></table>}
      </div>
    </section>
  );
}
