"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, FileUp, Loader2, RefreshCw } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { ApiError, apiFetch } from "@/shared/api/client";
import type { RosterImport } from "@/shared/api/types";

type RosterPeriod = { code: string; starts_on: string; ends_on: string };
type RosterCandidate = {
  id: string; period_code: string; source_row: number; source_name: string; source_cycle: string;
  name: string; cycle: string; email: string | null; student_code: string | null;
  school: string; study_plan: string; student_status: "ACTIVE" | "INACTIVE" | "GRADUATED";
  issue_code: string; state: "PENDING" | "RESOLVED" | "EXCLUDED"; resolution_reason: string | null;
};

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
  const [candidates, setCandidates] = useState<RosterCandidate[]>([]);
  const [candidateFile, setCandidateFile] = useState<File | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateImporting, setCandidateImporting] = useState(false);
  const [candidateActionId, setCandidateActionId] = useState<string | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [candidateMessage, setCandidateMessage] = useState<string | null>(null);
  const [exclusionReasons, setExclusionReasons] = useState<Record<string, string>>({});
  const candidateAttempt = useRef(0);

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

  const loadCandidates = useCallback(async () => {
    const attempt = ++candidateAttempt.current;
    if (!periodCode) { setCandidates([]); return; }
    setCandidateLoading(true);
    setCandidateError(null);
    try {
      const result = await apiFetch<{ items: RosterCandidate[] }>(`/padron/candidates?period_code=${encodeURIComponent(periodCode)}&state=ALL&limit=500`);
      if (attempt === candidateAttempt.current) setCandidates(result.items);
    } catch (loadError) {
      if (attempt === candidateAttempt.current) setCandidateError(loadError instanceof Error ? loadError.message : "No se pudo cargar la bandeja de conciliación.");
    } finally {
      if (attempt === candidateAttempt.current) setCandidateLoading(false);
    }
  }, [periodCode]);

  useEffect(() => { const timer = window.setTimeout(() => void loadPeriods(), 0); return () => window.clearTimeout(timer); }, [loadPeriods]);
  useEffect(() => { const timer = window.setTimeout(() => void loadHistory(), 0); return () => window.clearTimeout(timer); }, [loadHistory]);
  useEffect(() => { const timer = window.setTimeout(() => void loadCandidates(), 0); return () => window.clearTimeout(timer); }, [loadCandidates]);

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
      if (attempt === fileAttempt.current) setError(inspectionError instanceof Error ? inspectionError.message : "No se pudo revisar el archivo.");
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

  async function uploadCandidates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidateFile || !periodCode) return;
    setCandidateImporting(true); setCandidateError(null); setCandidateMessage(null);
    try {
      const body = new FormData(); body.append("file", candidateFile);
      const result = await apiFetch<{ added: number; already_registered: number; total_rows: number }>(`/padron/candidates/import?period_code=${encodeURIComponent(periodCode)}`, { method: "POST", body });
      setCandidateMessage(`Pendientes detectados: ${result.total_rows}. Nuevos: ${result.added}. Ya registrados: ${result.already_registered}.`);
      await loadCandidates();
    } catch (uploadError) {
      setCandidateError(uploadError instanceof Error ? uploadError.message : "No se pudieron importar los pendientes.");
    } finally { setCandidateImporting(false); }
  }

  function updateCandidateField(candidateId: string, field: keyof RosterCandidate, value: string) {
    setCandidates((current) => current.map((item) => item.id === candidateId ? { ...item, [field]: value } : item));
  }

  async function saveCandidate(candidate: RosterCandidate) {
    setCandidateActionId(candidate.id); setCandidateError(null); setCandidateMessage(null);
    try {
      const updated = await apiFetch<RosterCandidate>(`/padron/candidates/${candidate.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: candidate.name, cycle: candidate.cycle, email: candidate.email ?? "", student_code: candidate.student_code ?? "", school: candidate.school, study_plan: candidate.study_plan, student_status: candidate.student_status }),
      });
      setCandidates((current) => current.map((item) => item.id === candidate.id ? updated : item));
      setCandidateMessage("Correcciones guardadas. Confirma el registro para incorporarlo al padrón.");
    } catch (saveError) {
      setCandidateError(saveError instanceof Error ? saveError.message : "No se pudieron guardar las correcciones.");
    } finally { setCandidateActionId(null); }
  }

  async function reconcileCandidate(candidate: RosterCandidate) {
    setCandidateActionId(candidate.id); setCandidateError(null); setCandidateMessage(null);
    try {
      await apiFetch<{ state: string }>(`/padron/candidates/${candidate.id}/reconcile`, { method: "POST" });
      setCandidateMessage(`Registro incorporado al padrón ${candidate.period_code}.`);
      await loadCandidates();
      await loadHistory();
    } catch (resolveError) {
      setCandidateError(resolveError instanceof Error ? resolveError.message : "No se pudo confirmar el estudiante.");
    } finally { setCandidateActionId(null); }
  }

  async function excludeCandidate(candidate: RosterCandidate) {
    const reason = exclusionReasons[candidate.id]?.trim() ?? "";
    if (reason.length < 5) return;
    setCandidateActionId(candidate.id); setCandidateError(null); setCandidateMessage(null);
    try {
      await apiFetch<RosterCandidate>(`/padron/candidates/${candidate.id}/exclude`, { method: "POST", body: JSON.stringify({ reason }) });
      setCandidateMessage("Pendiente excluido de este periodo; el registro se conserva en el historial.");
      await loadCandidates();
    } catch (excludeError) {
      setCandidateError(excludeError instanceof Error ? excludeError.message : "No se pudo excluir el pendiente.");
    } finally { setCandidateActionId(null); }
  }

  const latest = history[0];
  const selectedRows = groups.find((group) => group.code === periodCode)?.rows ?? 0;
  return <div className="space-y-6">
    <div><p className="text-sm font-medium uppercase tracking-wider text-blue-600">Fuente maestra</p><h1 className="mt-1 text-3xl font-semibold text-gray-900">Padrón de estudiantes EPIS</h1><p className="mt-2 text-gray-500">Importa el padrón autorizado en Excel o CSV y consulta el resultado por periodo.</p></div>
    {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0"/><p className="text-sm">{error}</p><button onClick={() => { void loadPeriods(); void loadHistory(); }} className="ml-auto inline-flex items-center gap-1 text-sm font-bold"><RefreshCw size={15}/>Reintentar</button></div>}
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">Importar padrón</h2><button type="button" disabled={uploading} onClick={() => setShowPeriodForm((value) => !value)} className="text-sm font-semibold text-blue-600">{showPeriodForm ? "Cancelar nuevo periodo" : "Registrar periodo"}</button></div>
      <p className="mt-2 text-sm text-slate-500">Cada fila debe indicar el periodo en la columna <code>period</code>. En Excel, Pulse procesa una sola hoja visible con las columnas requeridas; las otras hojas no se importan.</p>
      {showPeriodForm && <form onSubmit={createPeriod} className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-4 lg:items-end"><label className="text-sm font-medium">Código del periodo<input required pattern="20[0-9]{2}-(I|II)" placeholder="2025-II" value={newPeriod.code} onChange={(event) => setNewPeriod((p) => ({ ...p, code: event.target.value.toUpperCase() }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"/></label><label className="text-sm font-medium">Inicio del periodo<input required type="date" value={newPeriod.starts_on} onChange={(event) => setNewPeriod((p) => ({ ...p, starts_on: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"/></label><label className="text-sm font-medium">Fin del periodo<input required type="date" min={newPeriod.starts_on} value={newPeriod.ends_on} onChange={(event) => setNewPeriod((p) => ({ ...p, ends_on: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"/></label><button disabled={creating} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{creating ? "Guardando…" : "Guardar periodo"}</button></form>}
      {!periods.length && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No hay periodos registrados. Usa «Registrar periodo» e indica las fechas del calendario académico.</p>}
      <form onSubmit={uploadRoster} className="mt-4 grid gap-4 md:grid-cols-[200px_1fr_auto] md:items-end"><label className="text-sm font-semibold text-gray-700">Periodo<select disabled={uploading} value={periodCode} onChange={(event) => { setPeriodCode(event.target.value); setReport(null); }} className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5"><option value="">Selecciona...</option>{periods.map((period) => <option key={period.code} value={period.code}>{period.code}</option>)}</select></label><label className="text-sm font-semibold text-gray-700">Archivo del padrón<input disabled={uploading} required type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void inspectFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-dashed border-gray-300 p-2 text-sm"/></label><button disabled={uploading || inspecting || !file || !periodCode || !selectedRows} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{uploading ? <Loader2 className="animate-spin" size={17}/> : <FileUp size={17}/>}Importar</button></form>
      {inspecting && <p role="status" className="mt-3 text-sm text-slate-500">Revisando archivo y periodos…</p>}
      {groups.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-sm font-semibold text-slate-700">Periodos detectados en el archivo</p><div className="mt-2 flex flex-wrap gap-2">{groups.map((group) => <button type="button" disabled={uploading} key={group.code} onClick={() => { setReport(null); if (periods.some((p) => p.code === group.code)) setPeriodCode(group.code); else { setNewPeriod({ code: group.code, starts_on: "", ends_on: "" }); setShowPeriodForm(true); } }} className={`rounded-md border px-3 py-2 text-sm ${group.code === periodCode ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600"}`}>{group.code} · {group.rows} filas{!periods.some((p) => p.code === group.code) && " · Registrar"}</button>)}</div><p className="mt-3 text-sm text-slate-500">{selectedRows ? `Se importarán únicamente ${selectedRows} filas de ${periodCode}.` : "Selecciona un periodo presente en el CSV o regístralo primero."} Para cargar los demás, cambia el periodo y vuelve a importar; el archivo se conserva y cada periodo tiene su propio historial.</p></div>}
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div><h2 className="font-semibold text-slate-900">Conciliar estudiantes pendientes</h2><p className="mt-2 text-sm text-slate-500">Carga el mismo Excel. Pulse leerá únicamente la hoja de pendientes. Completa los datos con el padrón institucional y confirma cada estudiante; solo entonces se crea su matrícula del periodo.</p></div>
      <form onSubmit={uploadCandidates} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="text-sm font-semibold text-gray-700">Excel o CSV de conciliación<input required type="file" accept=".xlsx,.csv" disabled={candidateImporting || !periodCode} onChange={(event) => setCandidateFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-dashed border-gray-300 p-2 text-sm"/></label>
        <button disabled={!candidateFile || !periodCode || candidateImporting} className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{candidateImporting ? "Leyendo…" : "Cargar pendientes"}</button>
      </form>
      {candidateError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{candidateError}</p>}
      {candidateMessage && <p role="status" className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">{candidateMessage}</p>}
      <div className="mt-5 flex items-center justify-between"><h3 className="font-medium text-slate-900">Bandeja del periodo {periodCode || "seleccionado"}</h3>{candidateLoading && <Loader2 size={17} className="animate-spin text-blue-600"/>}</div>
      {!candidateLoading && candidates.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No hay pendientes cargados para este periodo.</p>}
      <div className="mt-3 space-y-4">{candidates.map((candidate) => <article key={candidate.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-medium text-slate-900">{candidate.source_name}</h4><p className="mt-1 text-xs text-slate-500">Fila fuente {candidate.source_row} · Ciclo de origen {candidate.source_cycle} · {candidate.issue_code}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${candidate.state === "PENDING" ? "bg-amber-100 text-amber-800" : candidate.state === "RESOLVED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{candidate.state === "PENDING" ? "Pendiente" : candidate.state === "RESOLVED" ? "Incorporado" : "Excluido"}</span></div>
        {candidate.state === "PENDING" ? <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Nombre<input value={candidate.name} onChange={(event) => updateCandidateField(candidate.id, "name", event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"/></label>
            <label className="text-xs font-medium text-slate-600">Correo institucional<input type="email" value={candidate.email ?? ""} onChange={(event) => updateCandidateField(candidate.id, "email", event.target.value)} placeholder="usuario@virtual.upt.pe" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"/></label>
            <label className="text-xs font-medium text-slate-600">Código<input value={candidate.student_code ?? ""} onChange={(event) => updateCandidateField(candidate.id, "student_code", event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"/></label>
            <label className="text-xs font-medium text-slate-600">Ciclo<input value={candidate.cycle} onChange={(event) => updateCandidateField(candidate.id, "cycle", event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"/></label>
            <label className="text-xs font-medium text-slate-600">Escuela<input value={candidate.school} onChange={(event) => updateCandidateField(candidate.id, "school", event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"/></label>
            <label className="text-xs font-medium text-slate-600">Plan de estudios<input value={candidate.study_plan} onChange={(event) => updateCandidateField(candidate.id, "study_plan", event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"/></label>
            <label className="text-xs font-medium text-slate-600">Estado<select value={candidate.student_status} onChange={(event) => updateCandidateField(candidate.id, "student_status", event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option><option value="GRADUATED">Egresado</option></select></label>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2"><button type="button" disabled={candidateActionId === candidate.id} onClick={() => void saveCandidate(candidate)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60">Guardar correcciones</button><button type="button" disabled={candidateActionId === candidate.id || !candidate.email || !candidate.student_code} onClick={() => void reconcileCandidate(candidate)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{candidateActionId === candidate.id ? "Procesando…" : "Confirmar e incorporar"}</button><label className="ml-auto text-xs font-medium text-slate-600">Motivo para excluir<input value={exclusionReasons[candidate.id] ?? ""} onChange={(event) => setExclusionReasons((current) => ({ ...current, [candidate.id]: event.target.value }))} placeholder="Indica por qué no pertenece al padrón" className="mt-1 w-64 max-w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"/></label><button type="button" disabled={candidateActionId === candidate.id || (exclusionReasons[candidate.id]?.trim().length ?? 0) < 5} onClick={() => void excludeCandidate(candidate)} className="rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-700 disabled:opacity-50">Excluir con motivo</button></div>
        </> : <p className="mt-3 text-sm text-slate-600">{candidate.resolution_reason}</p>}
      </article>)}</div>
    </section>
    {report && <section className={`rounded-lg border bg-white p-4 ${report.status === "REJECTED" ? "border-rose-200" : "border-slate-200"}`}><h2 className="font-bold">Resultado de importación {report.idempotent ? "(repetida, sin cambios)" : ""}</h2><div className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><p>Total: <strong>{report.total_rows}</strong></p><p>Aceptados: <strong>{report.accepted_rows}</strong></p><p>Rechazados: <strong>{report.rejected_rows}</strong></p></div>{report.rejections.length > 0 && <ul className="mt-3 list-inside list-disc text-sm">{report.rejections.slice(0, 5).map((item) => <li key={`${item.row_number}-${item.field_name}`}>Fila {item.row_number}: {item.message}</li>)}</ul>}</section>}
    <section className="grid gap-4 md:grid-cols-3"><StatCard label="Última carga" value={latest ? importLabel(latest.status) : "Sin cargas"} icon={Clock3}/><StatCard label="Filas aceptadas" value={latest?.accepted_rows ?? 0} icon={CheckCircle2}/><StatCard label="Filas rechazadas" value={latest?.rejected_rows ?? 0} icon={AlertCircle}/></section>
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Historial del periodo {periodCode || "seleccionado"}</h2>{loading && <Loader2 className="animate-spin text-blue-600" size={18}/>}</div>{!loading && history.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">No hay importaciones registradas para este periodo.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Aceptadas</th><th className="px-4 py-3">Rechazadas</th><th className="px-4 py-3">Creada</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-b border-gray-100"><td className="px-4 py-3 font-bold">{importLabel(item.status)}</td><td className="px-4 py-3">{item.total_rows}</td><td className="px-4 py-3 text-emerald-700">{item.accepted_rows}</td><td className="px-4 py-3 text-rose-700">{item.rejected_rows}</td><td className="px-4 py-3">{new Date(item.created_at).toLocaleString("es-PE")}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Clock3 }) {
  return <div className="rounded-2xl border border-gray-100 bg-white p-5"><Icon className="text-blue-500"/><p className="mt-4 text-sm text-gray-500">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>;
}

export default function StudentsAdminPage() {
  return <RoleGate allow={["ADMIN"]}><RosterPageContent/></RoleGate>;
}
