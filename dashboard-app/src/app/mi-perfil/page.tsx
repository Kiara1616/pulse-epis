"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, Award, Clock3, FileCheck2, Loader2, Plus, RefreshCw } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { apiFetch } from "@/shared/api/client";
import type { Certification } from "@/shared/api/types";

function statusLabel(status: string) {
  return { PENDING: "Pendiente", UNDER_REVIEW: "En revisión", APPROVED: "Validada", OBSERVED: "Observada", RESUBMITTED: "Reenviada", REJECTED: "Rechazada", EXPIRED: "Vencida" }[status] ?? status;
}

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (["PENDING", "RESUBMITTED", "UNDER_REVIEW"].includes(status)) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function StudentProfileContent() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ credential_name: "", issuer_name: "", issued_on: "", expires_on: "", source_url: "" });

  const loadCertifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCertifications(await apiFetch<Certification[]>("/certifications"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar tus certificaciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadCertifications(), 0); return () => window.clearTimeout(timer); }, [loadCertifications]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiFetch<Certification>("/certifications", {
        method: "POST",
        body: JSON.stringify({ ...form, expires_on: form.expires_on || null, source_url: form.source_url || null, skills: [] }),
      });
      if (file) {
        const body = new FormData();
        body.append("file", file);
        await apiFetch(`/certifications/${created.id}/evidence`, { method: "POST", body });
      }
      setForm({ credential_name: "", issuer_name: "", issued_on: "", expires_on: "", source_url: "" });
      setFile(null);
      setShowForm(false);
      setMessage("Certificación registrada. El validador académico revisará la evidencia.");
      await loadCertifications();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar la certificación.");
    } finally {
      setSubmitting(false);
    }
  }

  const approved = certifications.filter((item) => item.status === "APPROVED").length;
  const pending = certifications.filter((item) => !["APPROVED", "REJECTED", "EXPIRED"].includes(item.status)).length;

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-bold uppercase tracking-wider text-blue-600">Portal del estudiante</p><h1 className="mt-1 text-3xl font-black text-gray-900">Mis certificaciones</h1><p className="mt-2 text-gray-500">Los registros se consultan y guardan en la API con tu sesión institucional.</p></div><button onClick={() => setShowForm((current) => !current)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-bold text-white"><Plus size={18}/>Nueva certificación</button></div>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{message}</div>}
    {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0"/><p className="text-sm">{error}</p><button onClick={() => void loadCertifications()} className="ml-auto inline-flex items-center gap-1 text-sm font-bold"><RefreshCw size={15}/>Reintentar</button></div>}
    {showForm && <form onSubmit={submit} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><h2 className="mb-5 font-bold text-gray-900">Registrar certificación</h2><div className="grid gap-4 md:grid-cols-2"><Field label="Nombre de la certificación" value={form.credential_name} onChange={(value) => setForm((current) => ({ ...current, credential_name: value }))} required/><Field label="Entidad emisora" value={form.issuer_name} onChange={(value) => setForm((current) => ({ ...current, issuer_name: value }))} required/><Field label="Fecha de emisión" type="date" value={form.issued_on} onChange={(value) => setForm((current) => ({ ...current, issued_on: value }))} required/><Field label="Fecha de vencimiento (opcional)" type="date" value={form.expires_on} onChange={(value) => setForm((current) => ({ ...current, expires_on: value }))}/><Field label="URL pública de verificación (opcional)" type="url" value={form.source_url} onChange={(value) => setForm((current) => ({ ...current, source_url: value }))}/></div><label className="mt-4 block text-sm font-semibold text-gray-700">Evidencia privada<input type="file" accept=".pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-dashed border-gray-300 p-4 text-sm"/></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 font-semibold text-gray-600">Cancelar</button><button disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-bold text-white disabled:opacity-60">{submitting && <Loader2 className="animate-spin" size={16}/>}Enviar a validación</button></div></form>}
    <section className="grid gap-4 md:grid-cols-3"><StatCard label="Total registrado" value={certifications.length} icon={Award}/><StatCard label="Validadas" value={approved} icon={FileCheck2}/><StatCard label="Pendientes" value={pending} icon={Clock3}/></section>
    <section className="rounded-2xl border border-gray-100 bg-white p-6"><div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Historial</h2>{loading && <Loader2 className="animate-spin text-blue-600" size={18}/>}</div>{!loading && certifications.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">Todavía no tienes certificaciones registradas.</p> : <div className="mt-4 space-y-3">{certifications.map((item) => <article key={item.id} className="flex flex-col justify-between gap-3 rounded-xl bg-gray-50 p-4 sm:flex-row sm:items-center"><div><p className="font-bold text-gray-900">{item.credential_name}</p><p className="text-sm text-gray-500">{item.issuer_name} · Emitida {item.issued_on}{item.evidences.length ? ` · ${item.evidences.length} evidencia(s)` : ""}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${statusClass(item.status)}`}>{statusLabel(item.status)}</span></article>)}</div>}</section>
  </div>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-sm font-semibold text-gray-700">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 block w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"/></label>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Award }) {
  return <div className="rounded-2xl border border-gray-100 bg-white p-5"><Icon className="text-blue-500"/><p className="mt-4 text-sm text-gray-500">{label}</p><p className="text-3xl font-black">{value}</p></div>;
}

export default function StudentProfilePage() {
  return <RoleGate allow={["STUDENT"]}><StudentProfileContent/></RoleGate>;
}
