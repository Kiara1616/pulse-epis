"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, ExternalLink, Plus, X } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { apiFetch } from "@/shared/api/client";
import type { IssuerCatalogItem, IssuerRequest } from "@/shared/api/types";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(date);
}

function AdminIssuersContent() {
  const [issuers, setIssuers] = useState<IssuerCatalogItem[]>([]);
  const [requests, setRequests] = useState<IssuerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [issuerRows, requestRows] = await Promise.all([
        apiFetch<IssuerCatalogItem[]>("/issuers"),
        apiFetch<IssuerRequest[]>("/issuers/requests?status=PENDING"),
      ]);
      setIssuers(issuerRows);
      setRequests(requestRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el catálogo de emisores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createIssuer() {
    if (!name.trim()) {
      setError("Indica el nombre de la entidad emisora.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch<IssuerCatalogItem>("/issuers", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), website_url: websiteUrl.trim() || null, logo_url: logoUrl.trim() || null }),
      });
      setName("");
      setWebsiteUrl("");
      setLogoUrl("");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear la entidad.");
    } finally {
      setSaving(false);
    }
  }

  async function approve(request: IssuerRequest) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/issuers/requests/${request.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ name: request.raw_name, website_url: request.website_url || null }),
      });
      await load();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "No se pudo aprobar la solicitud.");
    } finally {
      setSaving(false);
    }
  }

  async function reject(request: IssuerRequest) {
    const comment = window.prompt("Motivo del rechazo de la entidad:", "No se pudo verificar el emisor.");
    if (!comment?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/issuers/requests/${request.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ comment: comment.trim() }),
      });
      await load();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "No se pudo rechazar la solicitud.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow">Catálogo institucional</p>
        <h1 className="page-title mt-1">Entidades emisoras</h1>
        <p className="mt-2 max-w-3xl text-gray-500">Administra los emisores canónicos que aparecen en certificaciones, validaciones e indicadores.</p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      <section className="surface-card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Plus size={18} className="text-blue-600" />
          <h2 className="font-bold text-slate-900">Crear entidad emisora</h2>
        </div>
        <p className="text-sm text-slate-500">Usa el nombre oficial y, si está disponible, agrega su sitio y logotipo.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={150} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Ej. Linux Foundation" /></label>
          <label className="text-sm font-semibold text-slate-700">Sitio web<input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} maxLength={2048} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="https://…" /></label>
          <label className="text-sm font-semibold text-slate-700">Logo (URL opcional)<input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} maxLength={2048} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="https://…/logo.svg" /></label>
        </div>
        <button type="button" onClick={() => void createIssuer()} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? "Guardando…" : "Crear entidad"}</button>
      </section>

      <section className="surface-card space-y-4 p-6" aria-label="Solicitudes pendientes">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Solicitudes del validador</h2>
            <p className="mt-1 text-sm text-slate-500">Aprueba una entidad para que la certificación pueda continuar a validación.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{requests.length} pendientes</span>
        </div>
        {requests.length === 0 ? <p className="text-sm text-slate-500">No hay solicitudes pendientes.</p> : (
          <div className="space-y-3">
            {requests.map((request) => (
              <article key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{request.raw_name}</h3>
                    <p className="text-sm text-slate-600">{request.credential_name} · {request.student_name}</p>
                    <p className="mt-2 text-sm text-slate-700">{request.note}</p>
                    <p className="mt-1 text-xs text-slate-500">Solicitada {formatDate(request.created_at)}</p>
                    {request.website_url && <a href={request.website_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-blue-700 underline"><ExternalLink size={14} />Sitio declarado</a>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => void approve(request)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check size={15} />Aprobar y crear</button>
                    <button type="button" onClick={() => void reject(request)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><X size={15} />Rechazar</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface-card space-y-4 p-6" aria-label="Entidades registradas">
        <div className="flex items-center gap-2"><Building2 size={18} className="text-blue-600" /><h2 className="font-bold text-slate-900">Entidades registradas</h2></div>
        {loading ? <p className="text-sm text-slate-500">Cargando catálogo…</p> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {issuers.map((issuer) => (
              <article key={issuer.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  {issuer.logo_url ? (
                    // External issuer logos are intentionally not passed through Next's image optimizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={issuer.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain" />
                  ) : <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><Building2 size={19} /></div>}
                  <div className="min-w-0"><h3 className="truncate font-semibold text-slate-900">{issuer.name}</h3>{issuer.website_url && <a href={issuer.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 underline">Sitio oficial</a>}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminIssuersPage() {
  return <RoleGate allow={["ADMIN"]}><AdminIssuersContent /></RoleGate>;
}
