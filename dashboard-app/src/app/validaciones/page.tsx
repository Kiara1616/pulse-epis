"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, ExternalLink, Loader2 } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { apiFetch } from "@/shared/api/client";
import { ValidationHistory } from "@/features/certifications/ValidationHistory";

type Status = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "OBSERVED" | "RESUBMITTED" | "REJECTED" | "EXPIRED";
type Action = "START_REVIEW" | "APPROVE" | "OBSERVE" | "REJECT";

type ValidationEvidence = {
  id: string;
  evidence_type: "URL" | "FILE";
  original_filename: string | null;
  content_type: string | null;
};

type ValidationRecord = {
  id: string;
  student_key: string;
  credential_name: string;
  issuer_name: string;
  issued_on: string;
  expires_on: string | null;
  stored_status: Status;
  status: Status;
  evidences: ValidationEvidence[];
  latest_comment: string | null;
  source_url: string | null;
  external_id?: string | null;
  issuer_url?: string | null;
  skills?: Array<{ name: string; level: string | null }>;
};

const statusLabels: Record<Status, string> = {
  PENDING: "Pendiente",
  UNDER_REVIEW: "En revisión",
  APPROVED: "Aprobada",
  OBSERVED: "Observada",
  RESUBMITTED: "Reenviada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
};

const statusClasses: Record<Status, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  UNDER_REVIEW: "bg-blue-50 text-blue-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  OBSERVED: "bg-orange-50 text-orange-700",
  RESUBMITTED: "bg-violet-50 text-violet-700",
  REJECTED: "bg-rose-50 text-rose-700",
  EXPIRED: "bg-gray-100 text-gray-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE").format(new Date(`${value}T00:00:00`));
}

export default function ValidationsPage() {
  const [records, setRecords] = useState<ValidationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [preview, setPreview] = useState<{ url: string; evidence: ValidationEvidence } | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const selected = records.find((record) => record.id === selectedId);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setRecords(await apiFetch<ValidationRecord[]>("/validations"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la bandeja.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRecords(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const counts = useMemo(() => ({
    pending: records.filter((record) => record.status === "PENDING" || record.status === "RESUBMITTED").length,
    review: records.filter((record) => record.status === "UNDER_REVIEW").length,
    approved: records.filter((record) => record.status === "APPROVED").length,
    observed: records.filter((record) => record.status === "OBSERVED").length,
  }), [records]);

  async function decide(record: ValidationRecord, action: Action) {
    const decisionComment = comment.trim() || null;
    if ((action === "OBSERVE" || action === "REJECT") && !decisionComment) {
      setError("Escribe el motivo o las correcciones que debe realizar el estudiante.");
      return;
    }
    setActingId(record.id);
    setError(null);
    try {
      await apiFetch(`/validations/${record.id}`, {
        method: "POST",
        body: JSON.stringify({ action, comment: decisionComment }),
      });
      await loadRecords();
      setComment("");
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "No se pudo guardar la decisión.");
    } finally {
      setActingId(null);
    }
  }

  async function openEvidence(record: ValidationRecord, evidence: ValidationEvidence) {
    setActingId(record.id);
    setError(null);
    try {
      const access = await apiFetch<{ access_url: string }>(
        `/validations/${record.id}/evidence/${evidence.id}/access`,
        { method: "POST" },
      );
      setPreviewError(false);
      setPreview({ url: access.access_url, evidence });
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : "No se pudo abrir la evidencia.");
    } finally {
      setActingId(null);
    }
  }

  return <RoleGate allow={["VALIDATOR"]}><div className="space-y-6">
    <div><p className="text-sm font-bold text-blue-600 uppercase tracking-wider">Control de evidencia</p><h2 className="text-3xl font-black text-gray-900 mt-1">Bandeja de validaciones</h2><p className="text-gray-500 mt-2">Revisa titular, emisor, vigencia y duplicados antes de incluir una certificación en los indicadores.</p></div>
    {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0"/><p>{error}</p></div>}
    {historyId && <ValidationHistory key={historyId} id={historyId} onClose={() => setHistoryId(null)}/>}
    <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      {[["Pendientes", counts.pending], ["En revisión", counts.review], ["Aprobadas", counts.approved], ["Observadas", counts.observed]].map(([label, count]) => <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5"><p className="text-sm text-gray-500">{label}</p><p className="text-3xl font-black mt-1">{count}</p></div>)}
    </section>
    {selected && <section className="rounded-2xl border border-blue-200 bg-white p-6 space-y-5" aria-label="Detalle del envío">
      <div className="flex justify-between gap-4"><div><h3 className="text-xl font-bold">{selected.credential_name}</h3><span className={`inline-block mt-2 rounded-full px-3 py-1 text-xs font-bold ${statusClasses[selected.status]}`}>{statusLabels[selected.status]}</span></div><button disabled={actingId !== null} onClick={() => { setSelectedId(null); setPreview(null); setHistoryId(null); }} className="text-sm font-semibold text-blue-600">Cerrar detalle</button></div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[
        ["Estudiante", selected.student_key], ["Emisor", selected.issuer_name],
        ["Identificador de la credencial", selected.external_id || "No registrado"],
        ["Fecha de emisión", formatDate(selected.issued_on)],
        ["Fecha de vencimiento", selected.expires_on ? formatDate(selected.expires_on) : "Sin vencimiento registrado"],
      ].map(([label, value]) => <div key={label}><dt className="text-sm text-gray-500">{label}</dt><dd className="font-semibold break-words">{value}</dd></div>)}</dl>
      <div><h4 className="font-semibold">Habilidades declaradas</h4><p className="text-sm text-gray-600">{selected.skills?.map((skill) => `${skill.name}${skill.level ? ` (${skill.level})` : ""}`).join(", ") || "Sin habilidades registradas"}</p></div>
      {selected.issuer_url && <a href={selected.issuer_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 underline">Sitio del emisor</a>}
      {selected.source_url && <a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 underline">Enlace de verificación declarado</a>}
      {selected.latest_comment && <p className="rounded-lg bg-orange-50 p-3 text-sm"><strong>Último comentario:</strong> {selected.latest_comment}</p>}
      <div><h4 className="font-semibold mb-2">Evidencia adjunta</h4><div className="flex flex-wrap gap-2">{selected.evidences.map((evidence) => <button key={evidence.id} disabled={actingId !== null} onClick={() => void openEvidence(selected, evidence)} className="rounded-lg border px-3 py-2 text-sm text-blue-700 disabled:opacity-50">{evidence.original_filename || "Abrir enlace de evidencia"}</button>)}</div>{selected.evidences.length === 0 && <p className="text-sm text-gray-500">No hay evidencia adjunta.</p>}</div>
      {preview && <div className="rounded-xl border bg-slate-50 p-3 space-y-3">
        <a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 underline"><ExternalLink size={16}/>Abrir evidencia en otra pestaña</a>
        {preview.evidence.evidence_type === "FILE" && preview.evidence.content_type?.startsWith("image/") && !previewError &&
          // Temporary signed URLs must be rendered directly, without Next image caching.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.url} alt="Certificado adjunto por el estudiante" onError={() => setPreviewError(true)} className="max-h-[650px] w-full object-contain"/>}
        {preview.evidence.evidence_type === "FILE" && preview.evidence.content_type === "application/pdf" && <iframe src={preview.url} title="Certificado PDF adjunto" className="h-[650px] w-full"/>}
        {previewError && <p role="alert" className="text-sm text-rose-700">No se pudo cargar la imagen. Vuelve a seleccionar el archivo para renovar el acceso o ábrelo en otra pestaña.</p>}
      </div>}
      {(selected.status === "PENDING" || selected.status === "RESUBMITTED") && <button disabled={actingId !== null} onClick={() => void decide(selected, "START_REVIEW")} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Tomar revisión</button>}
      {selected.status === "UNDER_REVIEW" && <div className="space-y-3 border-t pt-4"><label htmlFor="review-comment" className="block font-semibold">Comentario para el estudiante</label><textarea id="review-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} disabled={actingId !== null} rows={3} placeholder="Indica el motivo del rechazo o las correcciones necesarias." className="w-full rounded-lg border p-3"/><p className="text-sm text-gray-500">Obligatorio al observar o rechazar. Si observas el envío, el estudiante podrá corregirlo y reenviarlo.</p><div className="flex flex-wrap gap-3">{([['APPROVE', 'Aprobar', 'bg-emerald-600 text-white'], ['OBSERVE', 'Observar', 'bg-amber-100 text-amber-800'], ['REJECT', 'Rechazar', 'bg-rose-50 text-rose-700']] as const).map(([action, label, color]) => <button key={action} disabled={actingId !== null} onClick={() => void decide(selected, action)} className={`rounded-lg px-4 py-2 font-semibold disabled:opacity-50 ${color}`}>{actingId === selected.id ? "Guardando…" : label}</button>)}</div></div>}
      <button onClick={() => setHistoryId(selected.id)} className="text-sm font-semibold text-blue-600">Ver historial</button>
    </section>}
    {loading ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-gray-500"><Loader2 className="animate-spin" size={20}/>Cargando certificaciones...</div> : records.length === 0 ? <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-500">No hay certificaciones para revisar.</div> : <section className="space-y-4">{records.map((record) => <button key={record.id} disabled={actingId !== null} onClick={() => { setSelectedId(record.id); setComment(""); setPreview(null); setHistoryId(null); setError(null); if (record.evidences[0]) void openEvidence(record, record.evidences[0]); }} className="w-full text-left bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-5 hover:border-blue-300 focus-visible:outline-blue-600 disabled:opacity-50"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Clock3/></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-gray-900">{record.credential_name}</h3><span className={`text-xs px-2 py-1 rounded-full font-bold ${statusClasses[record.status]}`}>{statusLabels[record.status]}</span></div><p className="text-sm text-gray-500 mt-1">{record.student_key} · {record.issuer_name} · Emitida {formatDate(record.issued_on)}</p></div><span className="text-sm font-semibold text-blue-600">Ver envío</span></button>)}</section>}
  </div></RoleGate>;
}
