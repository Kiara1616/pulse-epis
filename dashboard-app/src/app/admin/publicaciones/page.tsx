"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { RoleGate } from "@/features/access/RoleGate";
import { apiFetch } from "@/shared/api/client";
import Link from "next/link";

type Period = { code: string; starts_on: string; ends_on: string };
type Run = { id: string; period_code: string; cutoff_date: string; status: string; total_rows: number; accepted_rows: number; rejected_rows: number; idempotent: boolean; rejections: Array<{message: string}> };

function PublicationContent() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodCode, setPeriodCode] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [result, setResult] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = periods.find((p) => p.code === periodCode);
  const history = useCallback(async () => {
    if (!periodCode) return;
    setRuns(await apiFetch<Run[]>(`/etl/runs?period_code=${encodeURIComponent(periodCode)}`));
  }, [periodCode]);
  useEffect(() => {
    apiFetch<Period[]>("/padron/periods").then(setPeriods).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    if (periodCode) apiFetch<Run[]>(`/etl/runs?period_code=${encodeURIComponent(periodCode)}`).then((data) => { if (active) setRuns(data); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [periodCode]);
  async function publish(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setResult(null);
    try {
      setResult(await apiFetch<Run>("/etl/runs", { method: "POST", body: JSON.stringify({ period_code: periodCode, cutoff_date: cutoff }) }));
      await history();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo publicar."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold text-slate-950">Publicar indicadores</h1><p className="mt-2 text-sm text-slate-500">Actualiza el resumen a partir del padrón importado y las certificaciones revisadas, para un periodo y una fecha de corte.</p></div>
    <section className="rounded-xl border border-slate-200 bg-white p-6"><form onSubmit={publish} className="grid gap-4 md:grid-cols-3 md:items-end"><label className="text-sm font-semibold">Periodo<select required disabled={busy} value={periodCode} onChange={(e) => { setPeriodCode(e.target.value); setCutoff(""); setRuns([]); setResult(null); setError(null); }} className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2.5"><option value="">Selecciona un periodo</option>{periods.map((p) => <option key={p.code}>{p.code}</option>)}</select></label><label className="text-sm font-semibold">Fecha de corte<input required disabled={busy} type="date" min={selected?.starts_on} max={selected?.ends_on} value={cutoff} onChange={(e) => setCutoff(e.target.value)} className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2.5"/></label><button disabled={busy || !periodCode || !cutoff} className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Publicando…" : "Publicar indicadores"}</button></form><p className="mt-4 text-xs text-slate-500">La publicación conserva su corte y valida la calidad de los datos. Repetir la misma fuente no genera una carga duplicada.</p>{!periods.length && <Link className="mt-3 inline-block text-sm text-blue-600" href="/admin/estudiantes">Registrar periodos e importar padrón</Link>}</section>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {result && <div role="status" className={`rounded-lg p-4 text-sm ${result.status === "APPLIED" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}><p className="font-semibold">{result.status === "APPLIED" ? "Indicadores publicados" : "Publicación rechazada por calidad de datos"}{result.idempotent ? " · Fuente ya publicada, sin duplicar" : ""}</p><p className="mt-1">{result.period_code} · Corte {result.cutoff_date} · {result.accepted_rows} registros de certificación aceptados · {result.rejected_rows} rechazados</p>{result.rejections.map((r, i) => <p key={i} className="mt-1">{r.message}</p>)}{result.status === "APPLIED" && <Link href="/" className="mt-3 inline-block font-semibold underline">Consultar resumen</Link>}</div>}
    <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Historial de publicaciones</h2>{!runs.length ? <p className="mt-4 text-sm text-slate-500">{periodCode ? "No hay publicaciones para este periodo." : "Selecciona un periodo para consultar su historial."}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Corte</th><th className="p-3">Estado</th><th className="p-3">Aceptados</th><th className="p-3">Rechazados</th></tr></thead><tbody>{runs.map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="p-3">{r.cutoff_date}</td><td className="p-3">{r.status === "APPLIED" ? "Publicada" : "Rechazada"}</td><td className="p-3">{r.accepted_rows}</td><td className="p-3">{r.rejected_rows}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}

export default function PublicationsPage() { return <RoleGate allow={["ADMIN"]}><PublicationContent/></RoleGate>; }
