"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Clock3, ExternalLink, Eye, Loader2, RotateCcw, X } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { apiFetch } from "@/shared/api/client";

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
    let comment: string | null = null;
    if (action === "OBSERVE" || action === "REJECT") {
      comment = window.prompt("Escribe el comentario que verá el estudiante:")?.trim() || null;
      if (!comment) return;
    }
    setActingId(record.id);
    setError(null);
    try {
      await apiFetch(`/validations/${record.id}`, {
        method: "POST",
        body: JSON.stringify({ action, comment }),
      });
      await loadRecords();
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
      window.open(access.access_url, "_blank", "noopener,noreferrer");
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : "No se pudo abrir la evidencia.");
    } finally {
      setActingId(null);
    }
  }

  return <RoleGate allow={["VALIDATOR"]}><div className="space-y-6">
    <div><p className="text-sm font-bold text-blue-600 uppercase tracking-wider">Control de evidencia</p><h2 className="text-3xl font-black text-gray-900 mt-1">Bandeja de validaciones</h2><p className="text-gray-500 mt-2">Revisa titular, emisor, vigencia y duplicados antes de incluir una certificación en los indicadores.</p></div>
    {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0"/><p>{error}</p></div>}
    <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      {[["Pendientes", counts.pending], ["En revisión", counts.review], ["Aprobadas", counts.approved], ["Observadas", counts.observed]].map(([label, count]) => <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5"><p className="text-sm text-gray-500">{label}</p><p className="text-3xl font-black mt-1">{count}</p></div>)}
    </section>
    {loading ? <div className="flex items-center justify-center gap-2 py-16 text-gray-500"><Loader2 className="animate-spin" size={20}/>Cargando certificaciones...</div> : records.length === 0 ? <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-500">No hay certificaciones para revisar.</div> : <section className="space-y-4">{records.map((record) => <article key={record.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center gap-5"><div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Clock3/></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-gray-900">{record.credential_name}</h3><span className={`text-xs px-2 py-1 rounded-full font-bold ${statusClasses[record.status]}`}>{statusLabels[record.status]}</span></div><p className="text-sm text-gray-500 mt-1">{record.student_key} · {record.issuer_name} · Emitida {formatDate(record.issued_on)}{record.expires_on ? ` · Vence ${formatDate(record.expires_on)}` : ""}</p>{record.latest_comment && <p className="text-sm text-gray-600 mt-2"><span className="font-semibold">Último comentario:</span> {record.latest_comment}</p>}<div className="flex flex-wrap gap-2 mt-3">{record.evidences.map((evidence) => <button key={evidence.id} onClick={() => void openEvidence(record, evidence)} disabled={actingId === record.id} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"><ExternalLink size={14}/>{evidence.original_filename ?? `Evidencia ${evidence.evidence_type}`}</button>)}</div></div><div className="flex flex-wrap gap-2 xl:max-w-sm xl:justify-end">{(record.status === "PENDING" || record.status === "RESUBMITTED") && <button onClick={() => void decide(record, "START_REVIEW")} disabled={actingId === record.id} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"><RotateCcw size={16}/>Tomar revisión</button>}{record.status === "UNDER_REVIEW" && <><button onClick={() => void decide(record, "APPROVE")} disabled={actingId === record.id} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"><Check size={16}/>Aprobar</button><button onClick={() => void decide(record, "OBSERVE")} disabled={actingId === record.id} className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-bold disabled:opacity-50"><Eye size={16}/>Observar</button><button onClick={() => void decide(record, "REJECT")} disabled={actingId === record.id} className="p-2.5 bg-rose-50 text-rose-700 rounded-lg disabled:opacity-50" title="Rechazar"><X size={17}/></button></>}</div></article>)}</section>}
  </div></RoleGate>;
}
