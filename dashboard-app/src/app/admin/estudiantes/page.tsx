"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, FileUp, Loader2, RefreshCw } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { apiFetch } from "@/shared/api/client";
import type { AnalyticsPeriod, RosterImport } from "@/shared/api/types";

type ImportReport = RosterImport & {
  rejections: Array<{ row_number: number; field_name: string; reason_code: string; message: string }>;
  idempotent: boolean;
};

function RosterPageContent() {
  const [periods, setPeriods] = useState<AnalyticsPeriod[]>([]);
  const [periodCode, setPeriodCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<RosterImport[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPeriods = useCallback(async () => {
    try {
      const available = await apiFetch<AnalyticsPeriod[]>("/indicators/periods");
      setPeriods(available);
      setPeriodCode((current) => current || available[0]?.code || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los periodos.");
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!periodCode) return;
    setLoading(true);
    setError(null);
    try {
      setHistory(await apiFetch<RosterImport[]>(`/padron/imports?period_code=${encodeURIComponent(periodCode)}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el historial del padrón.");
    } finally {
      setLoading(false);
    }
  }, [periodCode]);

  useEffect(() => { const timer = window.setTimeout(() => void loadPeriods(), 0); return () => window.clearTimeout(timer); }, [loadPeriods]);
  useEffect(() => { const timer = window.setTimeout(() => void loadHistory(), 0); return () => window.clearTimeout(timer); }, [loadHistory]);

  async function uploadRoster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !periodCode) return;
    setUploading(true);
    setError(null);
    setReport(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await apiFetch<ImportReport>(`/padron/imports?period_code=${encodeURIComponent(periodCode)}`, { method: "POST", body });
      setReport(result);
      setFile(null);
      await loadHistory();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo importar el padrón.");
    } finally {
      setUploading(false);
    }
  }

  const latest = history[0];
  return <div className="space-y-6">
    <div><p className="text-sm font-bold uppercase tracking-wider text-blue-600">Fuente maestra</p><h1 className="mt-1 text-3xl font-black text-gray-900">Padrón de estudiantes EPIS</h1><p className="mt-2 text-gray-500">Importa el CSV oficial por periodo y consulta el resultado de conciliación sin mostrar datos nominales.</p></div>
    {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0"/><p className="text-sm">{error}</p><button onClick={() => { void loadPeriods(); void loadHistory(); }} className="ml-auto inline-flex items-center gap-1 text-sm font-bold"><RefreshCw size={15}/>Reintentar</button></div>}
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="font-bold text-gray-900">Importar padrón</h2><form onSubmit={uploadRoster} className="mt-4 grid gap-4 md:grid-cols-[200px_1fr_auto] md:items-end"><label className="text-sm font-semibold text-gray-700">Periodo<select value={periodCode} onChange={(event) => setPeriodCode(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5"><option value="">Selecciona...</option>{periods.map((period) => <option key={period.code} value={period.code}>{period.code}</option>)}</select></label><label className="text-sm font-semibold text-gray-700">CSV del padrón<input required type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-dashed border-gray-300 p-2 text-sm"/></label><button disabled={uploading || !file || !periodCode} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{uploading ? <Loader2 className="animate-spin" size={17}/> : <FileUp size={17}/>}Importar</button></form></section>
    {report && <section className={`rounded-2xl border p-5 ${report.status === "REJECTED" ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}><h2 className="font-bold">Resultado de importación {report.idempotent ? "(repetida, sin cambios)" : ""}</h2><div className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><p>Total: <strong>{report.total_rows}</strong></p><p>Aceptados: <strong>{report.accepted_rows}</strong></p><p>Rechazados: <strong>{report.rejected_rows}</strong></p></div>{report.rejections.length > 0 && <ul className="mt-3 list-inside list-disc text-sm">{report.rejections.slice(0, 5).map((item) => <li key={`${item.row_number}-${item.field_name}`}>Fila {item.row_number}: {item.message}</li>)}</ul>}</section>}
    <section className="grid gap-4 md:grid-cols-3"><StatCard label="Última carga" value={latest?.status ?? "Sin cargas"} icon={Clock3}/><StatCard label="Filas aceptadas" value={latest?.accepted_rows ?? 0} icon={CheckCircle2}/><StatCard label="Filas rechazadas" value={latest?.rejected_rows ?? 0} icon={AlertCircle}/></section>
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Historial del periodo {periodCode || "seleccionado"}</h2>{loading && <Loader2 className="animate-spin text-blue-600" size={18}/>}</div>{!loading && history.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">No hay importaciones registradas para este periodo.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Aceptadas</th><th className="px-4 py-3">Rechazadas</th><th className="px-4 py-3">Creada</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-b border-gray-100"><td className="px-4 py-3 font-bold">{item.status}</td><td className="px-4 py-3">{item.total_rows}</td><td className="px-4 py-3 text-emerald-700">{item.accepted_rows}</td><td className="px-4 py-3 text-rose-700">{item.rejected_rows}</td><td className="px-4 py-3">{new Date(item.created_at).toLocaleString("es-PE")}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Clock3 }) {
  return <div className="rounded-2xl border border-gray-100 bg-white p-5"><Icon className="text-blue-500"/><p className="mt-4 text-sm text-gray-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}

export default function StudentsAdminPage() {
  return <RoleGate allow={["ADMIN"]}><RosterPageContent/></RoleGate>;
}
