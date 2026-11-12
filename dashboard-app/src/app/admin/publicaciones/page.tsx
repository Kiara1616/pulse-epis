"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { RoleGate } from "@/features/access/RoleGate";
import { apiFetch } from "@/shared/api/client";
import type { RosterImport } from "@/shared/api/types";
import Link from "next/link";

type Period = { code: string; starts_on: string; ends_on: string };
type Run = { id: string; period_code: string; cutoff_date: string; created_at: string; completed_at: string | null; status: string; total_rows: number; enrollment_rows: number | null; active_enrollment_rows: number | null; accepted_rows: number; rejected_rows: number; idempotent: boolean; rejections: Array<{message: string}> };

function PublicationContent() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodCode, setPeriodCode] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [imports, setImports] = useState<RosterImport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [result, setResult] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = periods.find((p) => p.code === periodCode);
  const history = useCallback(async () => {
    if (!periodCode) { setRuns([]); setImports([]); return; }
    setHistoryLoading(true);
    try {
      const [etlRuns, rosterImports] = await Promise.all([
        apiFetch<Run[]>(`/etl/runs?period_code=${encodeURIComponent(periodCode)}`),
        apiFetch<RosterImport[]>(`/padron/imports?period_code=${encodeURIComponent(periodCode)}`),
      ]);
      setRuns(etlRuns);
      setImports(rosterImports);
    } finally {
      setHistoryLoading(false);
    }
  }, [periodCode]);
  useEffect(() => {
    apiFetch<Period[]>("/padron/periods").then(setPeriods).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    if (!periodCode) return () => { active = false; };
    Promise.all([
      apiFetch<Run[]>(`/etl/runs?period_code=${encodeURIComponent(periodCode)}`),
      apiFetch<RosterImport[]>(`/padron/imports?period_code=${encodeURIComponent(periodCode)}`),
    ]).then(([etlRuns, rosterImports]) => {
      if (active) { setRuns(etlRuns); setImports(rosterImports); }
    }).catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [periodCode]);
  const latestImport = imports.filter((item) => item.status === "APPLIED").sort((a, b) => Date.parse(b.completed_at ?? b.created_at) - Date.parse(a.completed_at ?? a.created_at))[0];
  const latestRun = runs.filter((run) => run.status === "APPLIED").sort((a, b) => Date.parse(b.completed_at ?? b.created_at) - Date.parse(a.completed_at ?? a.created_at))[0];
  const importTime = latestImport?.completed_at ?? latestImport?.created_at;
  const runTime = latestRun?.completed_at ?? latestRun?.created_at;
  const etlNeedsRefresh = Boolean(importTime && runTime && Date.parse(importTime) > Date.parse(runTime));
  const rosterDifference = latestImport && latestRun?.active_enrollment_rows != null
    ? latestRun.active_enrollment_rows - latestImport.accepted_rows
    : null;
  const comparisonNeedsAttention = !historyLoading && (!latestImport || !latestRun || etlNeedsRefresh || (rosterDifference !== null && rosterDifference !== 0));
  async function publish(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setResult(null);
    try {
      setResult(await apiFetch<Run>("/etl/runs", { method: "POST", body: JSON.stringify({ period_code: periodCode, cutoff_date: cutoff }) }));
      await history();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo publicar."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold text-slate-950">Publicar indicadores</h1><p className="mt-2 text-sm text-slate-500">Actualiza el resumen a partir del padrón importado y las certificaciones revisadas, para un periodo y una fecha de corte.</p></div>
    <section className="rounded-xl border border-slate-200 bg-white p-6"><form onSubmit={publish} className="grid gap-4 md:grid-cols-3 md:items-end"><label className="text-sm font-semibold">Periodo<select required disabled={busy} value={periodCode} onChange={(e) => { setPeriodCode(e.target.value); setCutoff(""); setRuns([]); setImports([]); setHistoryLoading(Boolean(e.target.value)); setResult(null); setError(null); }} className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2.5"><option value="">Selecciona un periodo</option>{periods.map((p) => <option key={p.code}>{p.code}</option>)}</select></label><label className="text-sm font-semibold">Fecha de corte<input required disabled={busy} type="date" min={selected?.starts_on} max={selected?.ends_on} value={cutoff} onChange={(e) => setCutoff(e.target.value)} className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2.5"/></label><button disabled={busy || !periodCode || !cutoff} className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Publicando…" : "Publicar indicadores"}</button></form><p className="mt-4 text-xs text-slate-500">La publicación conserva su corte y valida la calidad de los datos. Repetir la misma fuente no genera una carga duplicada.</p>{!periods.length && <Link className="mt-3 inline-block text-sm text-blue-600" href="/admin/estudiantes">Registrar periodos e importar padrón</Link>}</section>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {result && <div role="status" className={`rounded-lg p-4 text-sm ${result.status === "APPLIED" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}><p className="font-semibold">{result.status === "APPLIED" ? "Indicadores publicados" : "Publicación rechazada por calidad de datos"}{result.idempotent ? " · Fuente ya publicada, sin duplicar" : ""}</p><p className="mt-1">{result.period_code} · Corte {result.cutoff_date}</p><p className="mt-1">Padrón leído: {result.enrollment_rows ?? "sin dato"} matrículas · {result.active_enrollment_rows ?? "sin dato"} activas</p><p className="mt-1">Certificaciones: {result.accepted_rows} aceptadas · {result.rejected_rows} rechazadas</p>{result.rejections.map((r, i) => <p key={i} className="mt-1">{r.message}</p>)}{result.status === "APPLIED" && <Link href="/" className="mt-3 inline-block font-semibold underline">Consultar resumen</Link>}</div>}
    {periodCode && <section aria-live="polite" className={`rounded-xl border p-5 ${comparisonNeedsAttention ? "border-amber-200 bg-amber-50 text-amber-950" : "border-blue-200 bg-blue-50 text-slate-800"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Cotejo de padrón y ETL</h2><p className="mt-1 text-sm text-slate-600">Compara conteos del mismo periodo. La coincidencia numérica no confirma identidad de personas ni modifica matrículas automáticamente.</p></div><Link href="/admin/estudiantes" className="text-sm font-semibold text-blue-700 underline">Revisar padrón</Link></div>
      {historyLoading ? <p className="mt-4 text-sm text-slate-600">Consultando el último padrón y el último corte…</p> : !latestImport ? <p className="mt-4 text-sm">No hay una importación aplicada para {periodCode}.</p> : !latestRun ? <p className="mt-4 text-sm">Hay un padrón importado, pero aún no existe un ETL aplicado para este periodo.</p> : <>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p>Padrón aceptado: <strong>{latestImport.accepted_rows}</strong>{importTime && <span className="block text-xs text-slate-500">{new Date(importTime).toLocaleString("es-PE", { timeZone: "America/Lima" })}</span>}</p><p>Último ETL: <strong>{latestRun.active_enrollment_rows ?? "sin conteo"}</strong> matrículas activas · corte {latestRun.cutoff_date}{runTime && <span className="block text-xs text-slate-500">{new Date(runTime).toLocaleString("es-PE", { timeZone: "America/Lima" })}</span>}</p></div>
        {etlNeedsRefresh ? <p className="mt-4 text-sm font-medium">El último ETL es anterior a la importación aplicada. Publica un nuevo corte para incorporar ese padrón.</p> : rosterDifference === null ? <p className="mt-4 text-sm">El ETL no contiene conteo de matrículas para comparar.</p> : rosterDifference !== 0 ? <p className="mt-4 text-sm font-medium">Los conteos difieren en {rosterDifference > 0 ? "+" : ""}{rosterDifference}. Revisa el padrón y la bandeja de conciliación; no se desactiva ni agrega a nadie automáticamente.</p> : <p className="mt-4 text-sm">Los conteos coinciden. Revisa también la bandeja de pendientes: Pulse no confirma identidades por coincidencia numérica.</p>}
      </>}
    </section>}
    <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Historial de publicaciones</h2>{!runs.length ? <p className="mt-4 text-sm text-slate-500">{periodCode ? "No hay publicaciones para este periodo." : "Selecciona un periodo para consultar su historial."}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Corte</th><th className="p-3">Estado</th><th className="p-3">Matrículas</th><th className="p-3">Activas</th><th className="p-3">Cert. aceptadas</th><th className="p-3">Cert. rechazadas</th></tr></thead><tbody>{runs.map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="p-3">{r.cutoff_date}</td><td className="p-3">{r.status === "APPLIED" ? "Publicada" : "Rechazada"}</td><td className="p-3">{r.enrollment_rows ?? "—"}</td><td className="p-3">{r.active_enrollment_rows ?? "—"}</td><td className="p-3">{r.accepted_rows}</td><td className="p-3">{r.rejected_rows}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}

export default function PublicationsPage() { return <RoleGate allow={["ADMIN"]}><PublicationContent/></RoleGate>; }
