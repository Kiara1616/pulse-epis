"use client";
import { FormEvent, useState } from "react";
import { ApiError, apiFetch } from "@/shared/api/client";
import type { Certification } from "@/shared/api/types";

export function CertificationDetails({ item, onSaved, onClose }: {item: Certification; onSaved: () => Promise<void>; onClose: () => void}) {
  const [form, setForm] = useState({ credential_name: item.credential_name, issuer_name: item.issuer_name, issued_on: item.issued_on, expires_on: item.expires_on ?? "", source_url: item.source_url ?? "", skills: item.skills.map((s) => s.name).join(", "), level: item.skills[0]?.level ?? "Other" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try {
      if (file) {
        const body = new FormData(); body.append("file", file);
        try { await apiFetch(`/certifications/${item.id}/evidence`, {method: "POST", body}); }
        catch (e) { if (!(e instanceof ApiError && e.status === 409)) throw e; }
        setFile(null);
      }
      const { skills, level, ...values } = form;
      await apiFetch(`/certifications/${item.id}`, {method: "PATCH", body: JSON.stringify({ ...values, expires_on: values.expires_on || null, source_url: values.source_url || null, skills: skills.split(",").map((name) => name.trim()).filter(Boolean).map((name) => ({name, level: item.skills.find((s) => s.name === name)?.level ?? level})) })});
      setMessage(item.status === "OBSERVED" ? "Corrección reenviada al validador." : "Cambios guardados.");
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron guardar los cambios."); }
    finally { setBusy(false); }
  }
  async function viewEvidence(id: string) {
    const preview = window.open("", "_blank");
    if (preview) preview.opener = null;
    setError(null);
    try {
      const access = await apiFetch<{access_url: string}>(`/certifications/${item.id}/evidence/${id}/access`, {method: "POST"});
      if (preview) preview.location.href = access.access_url;
      else setError("Permite abrir ventanas para consultar la evidencia.");
    } catch (e) { preview?.close(); setError(e instanceof Error ? e.message : "No se pudo abrir la evidencia."); }
  }
  return <section className="rounded-xl border border-blue-200 bg-white p-5"><div className="flex justify-between gap-3"><h2 className="font-semibold text-slate-900">Detalle de certificación</h2><button disabled={busy} onClick={onClose} className="text-sm text-slate-500">Cerrar detalle</button></div>
    {item.latest_comment && <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900"><strong>Comentario del validador:</strong> {item.latest_comment}</p>}
    {error && <p role="alert" className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{message && <p role="status" className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="mt-4"><h3 className="text-sm font-semibold">Evidencias adjuntas</h3>{item.evidences.length ? <div className="mt-2 flex flex-wrap gap-2">{item.evidences.map((e) => <button key={e.id} onClick={() => void viewEvidence(e.id)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-blue-700">Ver {e.original_filename ?? "enlace de verificación"}</button>)}</div> : <p className="mt-2 text-sm text-slate-500">Aún no hay evidencias adjuntas.</p>}</div>
    {item.correction_allowed ? <form onSubmit={save} className="mt-5 space-y-4"><div className="grid gap-4 md:grid-cols-2">{([
      ["credential_name", "Nombre de la certificación", "text"], ["issuer_name", "Entidad emisora", "text"], ["issued_on", "Fecha de emisión", "date"], ["expires_on", "Fecha de vencimiento (opcional)", "date"], ["source_url", "URL de verificación (opcional)", "url"], ["skills", "Habilidades, separadas por comas", "text"],
    ] as const).map(([key, label, type]) => <label key={key} className="text-sm font-medium">{label}<input disabled={busy} required={["credential_name", "issuer_name", "issued_on", "skills"].includes(key)} type={type} value={form[key]} onChange={(e) => setForm((f) => ({...f, [key]: e.target.value}))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"/></label>)}</div><label className="block text-sm font-medium">Adjuntar evidencia adicional<input disabled={busy} type="file" accept=".pdf,image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-md border border-dashed border-slate-300 p-3"/></label><p className="text-xs text-slate-500">Las evidencias existentes se conservan. Si la certificación está observada, guardar la corrección la reenvía a revisión.</p><button disabled={busy} className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Guardando…" : item.status === "OBSERVED" ? "Reenviar corrección" : "Guardar cambios"}</button></form> : <p className="mt-5 text-sm text-slate-500">Esta certificación no admite cambios en su estado actual.</p>}
  </section>;
}
