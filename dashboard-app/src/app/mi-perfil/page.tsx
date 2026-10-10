"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, Award, Clock3, FileCheck2, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { ApiError, apiFetch } from "@/shared/api/client";
import type { Certification } from "@/shared/api/types";
import { CertificationDetails } from "@/features/certifications/CertificationDetails";

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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [skillNames, setSkillNames] = useState("");
  const level = "Other";
  const [createdId, setCreatedId] = useState<string | null>(null);
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
      let id = createdId;
      if (!id) {
      const created = await apiFetch<Certification>("/certifications", {
        method: "POST",
        body: JSON.stringify({ ...form, expires_on: form.expires_on || null, source_url: form.source_url || null, skills: skillNames.split(",").map((name) => name.trim()).filter(Boolean).map((name) => ({ name, level })) }),
      });
      id = created.id; setCreatedId(id);
      }
      if (file) {
        const body = new FormData();
        body.append("file", file);
        try { await apiFetch(`/certifications/${id}/evidence`, { method: "POST", body }); }
        catch (e) { if (!(e instanceof ApiError && e.status === 409)) throw e; }
      } else if (form.source_url) {
        const body = new FormData(); body.append("source_url", form.source_url);
        try { await apiFetch(`/certifications/${id}/evidence`, { method: "POST", body }); }
        catch (e) { if (!(e instanceof ApiError && e.status === 409)) throw e; }
      }
      setForm({ credential_name: "", issuer_name: "", issued_on: "", expires_on: "", source_url: "" });
      setFile(null);
      setCreatedId(null); setSkillNames("");
      setShowForm(false);
      setMessage("Certificación registrada. El validador académico revisará la evidencia.");
      await loadCertifications();
    } catch (submitError) {
      await loadCertifications();
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar la certificación.");
    } finally {
      setSubmitting(false);
    }
  }

  const approved = certifications.filter((item) => item.status === "APPROVED").length;
  const selected = certifications.find((item) => item.id === selectedId);
  const pending = certifications.filter((item) => !["APPROVED", "REJECTED", "EXPIRED"].includes(item.status)).length;
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = certifications.filter((item) =>
    normalize(`${item.credential_name} ${item.issuer_name}`).includes(normalize(query.trim())) &&
    (statusFilter === "ALL" || item.status === statusFilter)
  );

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">Tu desarrollo profesional</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Mis certificaciones</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Registra tus logros, adjunta la evidencia y consulta el estado de tu validación académica.</p></div><button onClick={() => setShowForm((current) => !current)} aria-expanded={showForm} className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Plus size={18}/>{showForm ? "Cerrar formulario" : "Nueva certificación"}</button></div>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{message}</div>}
    {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0"/><p className="text-sm">{error}</p><button onClick={() => void loadCertifications()} className="ml-auto inline-flex items-center gap-1 text-sm font-bold"><RefreshCw size={15}/>Reintentar</button></div>}
    {showForm && <form onSubmit={submit} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><h2 className="mb-5 font-bold text-gray-900">Registrar certificación</h2><div className="grid gap-4 md:grid-cols-2"><Field label="Nombre de la certificación" value={form.credential_name} onChange={(value) => setForm((current) => ({ ...current, credential_name: value }))} required/><Field label="Entidad emisora" value={form.issuer_name} onChange={(value) => setForm((current) => ({ ...current, issuer_name: value }))} required/><Field label="Fecha de emisión" type="date" value={form.issued_on} onChange={(value) => setForm((current) => ({ ...current, issued_on: value }))} required/><Field label="Fecha de vencimiento (opcional)" type="date" value={form.expires_on} onChange={(value) => setForm((current) => ({ ...current, expires_on: value }))}/><Field label="URL pública de verificación (opcional)" type="url" value={form.source_url} onChange={(value) => setForm((current) => ({ ...current, source_url: value }))}/><Field label="Habilidades, separadas por comas" value={skillNames} onChange={setSkillNames} required/></div><label className="mt-4 block text-sm font-semibold text-gray-700">Evidencia privada<input type="file" accept=".pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-dashed border-gray-300 p-4 text-sm"/></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 font-semibold text-gray-600">Cancelar</button><button disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-bold text-white disabled:opacity-60">{submitting && <Loader2 className="animate-spin" size={16}/>}Enviar a validación</button></div></form>}
    <section className="grid gap-4 md:grid-cols-3"><StatCard label="Total registrado" value={certifications.length} icon={Award}/><StatCard label="Validadas" value={approved} icon={FileCheck2}/><StatCard label="Pendientes" value={pending} icon={Clock3}/></section>
    {createdId && <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">La certificación ya está registrada. Al reenviar se reintentará únicamente adjuntar el archivo; también puedes abrir su detalle en el historial.</p>}
    {selected && <CertificationDetails key={selected.id} item={selected} onSaved={loadCertifications} onClose={() => setSelectedId(null)}/>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Historial de certificaciones</h2><p className="mt-1 text-xs text-slate-500">Revisa tus registros y su estado de aprobación.</p></div>{loading && <Loader2 aria-label="Cargando certificaciones" className="animate-spin text-blue-600" size={18}/>}</div>
        {certifications.length > 0 && <div className="mt-5 flex flex-col gap-3 sm:flex-row"><label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5"><Search size={17} className="shrink-0 text-slate-400"/><input aria-label="Buscar certificaciones" placeholder="Buscar por certificación o entidad" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 w-full bg-transparent text-sm outline-none"/></label><select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600"><option value="ALL">Todos los estados</option>{["PENDING", "UNDER_REVIEW", "APPROVED", "OBSERVED", "RESUBMITTED", "REJECTED", "EXPIRED"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div>}
      </div>
      {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Cargando tus certificaciones…</p> : error ? <p className="p-8 text-center text-sm text-slate-500">El historial no está disponible. Reintenta la consulta.</p> : certifications.length === 0 ? <div className="px-6 py-12 text-center"><Award className="mx-auto mb-3 text-blue-500" size={30}/><p className="text-sm font-semibold text-slate-700">Todavía no tienes certificaciones registradas.</p><p className="mt-2 text-sm text-slate-500">Comienza con «Nueva certificación» y envía tu primer logro a validación.</p></div> : <>
        <div role="status" className="px-6 pt-4 text-xs text-slate-500">{filtered.length} de {certifications.length} certificaciones</div>
        <div className="divide-y divide-slate-100 px-5 md:px-6">{filtered.map((item) => <article key={item.id} className="flex flex-col justify-between gap-3 py-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-600"><Award size={20}/></span><div><p className="font-semibold text-slate-900 break-words">{item.credential_name}</p><p className="mt-1 text-sm text-slate-500 break-words">{item.issuer_name}</p><p className="mt-1 text-xs text-slate-500">Emitida {formatIssuedDate(item.issued_on)} · {item.evidences.length} {item.evidences.length === 1 ? "evidencia" : "evidencias"}</p></div></div><div className="flex shrink-0 items-center gap-3"><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{statusLabel(item.status)}</span><button onClick={() => setSelectedId(item.id)} className="text-xs font-semibold text-blue-600">Ver detalle</button></div></article>)}</div>
        {filtered.length === 0 && <div className="p-10 text-center"><p className="text-sm text-slate-500">No hay certificaciones que coincidan con tu búsqueda.</p><button onClick={() => { setQuery(""); setStatusFilter("ALL"); }} className="mt-3 text-sm font-semibold text-blue-600">Limpiar filtros</button></div>}
      </>}
    </section>
  </div>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-sm font-semibold text-gray-700">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 block w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"/></label>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Award }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p></div><span className={`rounded-xl p-3 ${label === "Validadas" ? "bg-emerald-50 text-emerald-600" : label === "Pendientes" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}><Icon size={23}/></span></div>;
}

function formatIssuedDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default function StudentProfilePage() {
  return <RoleGate allow={["STUDENT"]}><StudentProfileContent/></RoleGate>;
}
