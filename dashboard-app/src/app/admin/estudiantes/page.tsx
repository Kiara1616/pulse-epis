"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, FileUp, Loader2, RefreshCw } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { ApiError, apiFetch } from "@/shared/api/client";
import type { RosterImport } from "@/shared/api/types";

type RosterPeriod = { code: string; starts_on: string; ends_on: string };

type ImportReport = RosterImport & {
  rejections: Array<{ row_number: number; field_name: string; reason_code: string; message: string }>;
  idempotent: boolean;
};

function importLabel(status: string) { return ({ APPLIED: "Importación completada", REJECTED: "Carga rechazada" } as Record<string, string>)[status] ?? status; }

function RosterPageContent() {
  const [periods, setPeriods] = useState<RosterPeriod[]>([]);
  const [groups, setGroups] = useState<Array<{ code: string; rows: number }>>([]);
  const [inspecting, setInspecting] = useState(false);
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ code: "", starts_on: "", ends_on: "" });
  const fileAttempt = useRef(0);
  const historyAttempt = useRef(0);
  const [periodCode, setPeriodCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<RosterImport[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPeriods = useCallback(async () => {
    try {
      const available = await apiFetch<RosterPeriod[]>("/padron/periods");
      setPeriods(available);
      setPeriodCode((current) => current || available[0]?.code || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los periodos.");
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const attempt = ++historyAttempt.current;
    if (!periodCode) { setHistory([]); setLoading(false); return; }
    setLoading(true);
    setHistory([]);
    try {
      const result = await apiFetch<RosterImport[]>(`/padron/imports?period_code=${encodeURIComponent(periodCode)}`);
      if (attempt === historyAttempt.current) setHistory(result);
    } catch (loadError) {
      if (attempt === historyAttempt.current) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el historial del padrón.");
    } finally {
      if (attempt === historyAttempt.current) setLoading(false);
    }
  }, [periodCode]);

  useEffect(() => { const timer = window.setTimeout(() => void loadPeriods(), 0); return () => window.clearTimeout(timer); }, [loadPeriods]);
  useEffect(() => { const timer = window.setTimeout(() => void loadHistory(), 0); return () => window.clearTimeout(timer); }, [loadHistory]);

  async function inspectFile(selected: File | null) {
    const attempt = ++fileAttempt.current;
    setFile(selected); setGroups([]); setReport(null); setError(null);
    if (!selected) { setInspecting(false); return; }
    setInspecting(true);
    try {
      const body = new FormData(); body.append("file", selected);
      const [result, available] = await Promise.all([
        apiFetch<Array<{ code: string; rows: number }>>("/padron/preview", { method: "POST", body }),
        apiFetch<RosterPeriod[]>("/padron/periods"),
      ]);
      if (attempt !== fileAttempt.current) return;
      setGroups(result);
      setPeriods(available);
      if (result.length === 1) {
        const code = result[0].code;
        if (available.some((p) => p.code === code)) setPeriodCode(code);
        else { setNewPeriod({ code, starts_on: "", ends_on: "" }); setShowPeriodForm(true); }
      }
    } catch (inspectionError) {
      if (attempt === fileAttempt.current) setError(inspectionError instanceof Error ? inspectionError.message : "No se pudo revisar el CSV.");
    } finally { if (attempt === fileAttempt.current) setInspecting(false); }
  }

  async function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCreating(true); setError(null);
    try {
      const period = await apiFetch<RosterPeriod>("/padron/periods", { method: "POST", body: JSON.stringify(newPeriod) });
      await loadPeriods(); setPeriodCode(period.code); setReport(null); setShowPeriodForm(false);
      setNewPeriod({ code: "", starts_on: "", ends_on: "" });
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "No se pudo registrar el periodo.");
    } finally { setCreating(false); }
  }

  async function uploadRoster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !periodCode) return;
    setUploading(true);
    setError(null);
    setReport(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await apiFetch<ImportReport>(`/padron/imports?period_code=${encodeURIComponent(periodCode)}&selected_period_only=true`, { method: "POST", body });
      setReport(result);
      await loadHistory();
    } catch (uploadError) {
      const rejected = uploadError instanceof ApiError ? uploadError.payload as ImportReport | null : null;
      if (rejected?.status === "REJECTED" && Array.isArray(rejected.rejections)) { setReport(rejected); await loadHistory(); }
      else setError(uploadError instanceof Error ? uploadError.message : "No se pudo importar el padrón.");
    } finally {
      setUploading(false);
    }
  }

  const latest = history[0];
  const selectedRows = groups.find((group) => group.code === periodCode)?.rows ?? 0;
  return <div className="space-y-6">
    <div><p className="text-sm font-bold uppercase tracking-wider text-blue-600">Fuente maestra</p><h1 className="mt-1 text-3xl font-black text-gray-900">Padrón de estudiantes EPIS</h1><p className="mt-2 text-gray-500">Importa el CSV oficial por periodo y consulta el resultado de conciliación sin mostrar datos nominales.</p></div>
    {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0"/><p className="text-sm">{error}</p><button onClick={() => { void loadPeriods(); void loadHistory(); }} className="ml-auto inline-flex items-center gap-1 text-sm font-bold"><RefreshCw size={15}/>Reintentar</button></div>}
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">Importar padrón</h2><button type="button" disabled={uploading} onClick={() => setShowPeriodForm((value) => !value)} className="text-sm font-semibold text-blue-600">{showPeriodForm ? "Cancelar nuevo periodo" : "Registrar periodo"}</button></div>
      <p className="mt-2 text-sm text-slate-500">Cada fila del CSV debe indicar su periodo en la columna <code>period</code>. Puedes usar un archivo con varios periodos.</p>
      {showPeriodForm && <form onSubmit={createPeriod} className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-4 lg:items-end"><label className="text-sm font-medium">Código del periodo<input required pattern="20[0-9]{2}-(I|II)" placeholder="2025-II" value={newPeriod.code} onChange={(event) => setNewPeriod((p) => ({ ...p, code: event.target.value.toUpperCase() }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"/></label><label className="text-sm font-medium">Inicio del periodo<input required type="date" value={newPeriod.starts_on} onChange={(event) => setNewPeriod((p) => ({ ...p, starts_on: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"/></label><label className="text-sm font-medium">Fin del periodo<input required type="date" min={newPeriod.starts_on} value={newPeriod.ends_on} onChange={(event) => setNewPeriod((p) => ({ ...p, ends_on: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"/></label><button disabled={creating} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{creating ? "Guardando…" : "Guardar periodo"}</button></form>}
      {!periods.length && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No hay periodos registrados. Usa «Registrar periodo» e indica las fechas del calendario académico.</p>}
      <form onSubmit={uploadRoster} className="mt-4 grid gap-4 md:grid-cols-[200px_1fr_auto] md:items-end"><label className="text-sm font-semibold text-gray-700">Periodo<select disabled={uploading} value={periodCode} onChange={(event) => { setPeriodCode(event.target.value); setReport(null); }} className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5"><option value="">Selecciona...</option>{periods.map((period) => <option key={period.code} value={period.code}>{period.code}</option>)}</select></label><label className="text-sm font-semibold text-gray-700">CSV del padrón<input disabled={uploading} required type="file" accept=".csv,text/csv" onChange={(event) => void inspectFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-dashed border-gray-300 p-2 text-sm"/></label><button disabled={uploading || inspecting || !file || !periodCode || !selectedRows} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{uploading ? <Loader2 className="animate-spin" size={17}/> : <FileUp size={17}/>}Importar</button></form>
      {inspecting && <p role="status" className="mt-3 text-sm text-slate-500">Revisando periodos del CSV…</p>}
      {groups.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-sm font-semibold text-slate-700">Periodos detectados en el archivo</p><div className="mt-2 flex flex-wrap gap-2">{groups.map((group) => <button type="button" disabled={uploading} key={group.code} onClick={() => { setReport(null); if (periods.some((p) => p.code === group.code)) setPeriodCode(group.code); else { setNewPeriod({ code: group.code, starts_on: "", ends_on: "" }); setShowPeriodForm(true); } }} className={`rounded-md border px-3 py-2 text-sm ${group.code === periodCode ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600"}`}>{group.code} · {group.rows} filas{!periods.some((p) => p.code === group.code) && " · Registrar"}</button>)}</div><p className="mt-3 text-sm text-slate-500">{selectedRows ? `Se importarán únicamente ${selectedRows} filas de ${periodCode}.` : "Selecciona un periodo presente en el CSV o regístralo primero."} Para cargar los demás, cambia el periodo y vuelve a importar; el archivo se conserva y cada periodo tiene su propio historial.</p></div>}
    </section>
    {report && <section className={`rounded-lg border bg-white p-4 ${report.status === "REJECTED" ? "border-rose-200" : "border-slate-200"}`}><h2 className="font-bold">Resultado de importación {report.idempotent ? "(repetida, sin cambios)" : ""}</h2><div className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><p>Total: <strong>{report.total_rows}</strong></p><p>Aceptados: <strong>{report.accepted_rows}</strong></p><p>Rechazados: <strong>{report.rejected_rows}</strong></p></div>{report.rejections.length > 0 && <ul className="mt-3 list-inside list-disc text-sm">{report.rejections.slice(0, 5).map((item) => <li key={`${item.row_number}-${item.field_name}`}>Fila {item.row_number}: {item.message}</li>)}</ul>}</section>}
    <section className="grid gap-4 md:grid-cols-3"><StatCard label="Última carga" value={latest ? importLabel(latest.status) : "Sin cargas"} icon={Clock3}/><StatCard label="Filas aceptadas" value={latest?.accepted_rows ?? 0} icon={CheckCircle2}/><StatCard label="Filas rechazadas" value={latest?.rejected_rows ?? 0} icon={AlertCircle}/></section>
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Historial del periodo {periodCode || "seleccionado"}</h2>{loading && <Loader2 className="animate-spin text-blue-600" size={18}/>}</div>{!loading && history.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">No hay importaciones registradas para este periodo.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Aceptadas</th><th className="px-4 py-3">Rechazadas</th><th className="px-4 py-3">Creada</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-b border-gray-100"><td className="px-4 py-3 font-bold">{importLabel(item.status)}</td><td className="px-4 py-3">{item.total_rows}</td><td className="px-4 py-3 text-emerald-700">{item.accepted_rows}</td><td className="px-4 py-3 text-rose-700">{item.rejected_rows}</td><td className="px-4 py-3">{new Date(item.created_at).toLocaleString("es-PE")}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Clock3 }) {
  return <div className="rounded-2xl border border-gray-100 bg-white p-5"><Icon className="text-blue-500"/><p className="mt-4 text-sm text-gray-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}

export default function StudentsAdminPage() {
  return <RoleGate allow={["ADMIN"]}><RosterPageContent/></RoleGate>;
}
