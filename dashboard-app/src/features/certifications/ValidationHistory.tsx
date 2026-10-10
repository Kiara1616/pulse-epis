"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/shared/api/client";

type Change = { id: string; to_status: string; comment: string | null; changed_at: string };
const labels: Record<string, string> = { PENDING: "Registrada", UNDER_REVIEW: "En revisión", OBSERVED: "Observada", RESUBMITTED: "Reenviada", APPROVED: "Aprobada", REJECTED: "Rechazada", EXPIRED: "Vencida" };
export function ValidationHistory({id, onClose}: {id: string; onClose: () => void}) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    apiFetch<Change[]>(`/validations/${id}/history`).then((data) => { if (active) setChanges(data); }).catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex justify-between"><h2 className="font-semibold">Historial de revisión</h2><button onClick={onClose} className="text-sm text-slate-500">Cerrar historial</button></div>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{loading ? <p role="status" className="mt-3 text-sm text-slate-500">Cargando historial…</p> : <ol className="mt-3 divide-y divide-slate-100">{changes.map((change) => <li key={change.id} className="py-3 text-sm"><p className="font-semibold">{labels[change.to_status] ?? change.to_status}<span className="ml-3 text-xs font-normal text-slate-500">{new Date(change.changed_at).toLocaleString("es-PE")}</span></p>{change.comment && <p className="mt-1 text-slate-600">{change.comment}</p>}</li>)}</ol>}</section>;
}
