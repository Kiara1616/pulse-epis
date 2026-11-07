"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageCircleWarning,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { statusLabel, statusClass } from "@/shared/ui/status";
import { AsyncState } from "@/shared/ui/AsyncState";
import { RoleGate } from "@/features/access/RoleGate";
import { ApiError, apiFetch } from "@/shared/api/client";
import type { Certification } from "@/shared/api/types";
import {
  certificationStatuses,
  type StudentSummary,
} from "@/shared/contracts/types";
import { studentSummary } from "@/shared/contracts/adapters";
import { CertificationDetails } from "@/features/certifications/CertificationDetails";
import { ReferenceStudentProfile } from "@/features/certifications/ReferenceStudentProfile";
import { MetricCard, PageHeader, SectionHeading } from "@/shared/ui/DashboardPrimitives";
import { catalogApi, type CatalogCredential, type CatalogDraft, type CatalogIssuer, type CatalogSkill } from "@/shared/api/catalog";
import {
  hasCertificationFormErrors,
  validateCertificationForm,
  type CertificationFormErrors,
} from "@/features/certifications/validation";

type NextAction = {
  title: string;
  description: string;
  buttonLabel: string;
  credentialId?: string;
  opensForm?: boolean;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isSessionExpired(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function StudentProfileContent() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<CertificationFormErrors>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issuers, setIssuers] = useState<CatalogIssuer[]>([]);
  const [credentials, setCredentials] = useState<CatalogCredential[]>([]);
  const [catalogSkills, setCatalogSkills] = useState<CatalogSkill[]>([]);
  const [catalogDrafts, setCatalogDrafts] = useState<CatalogDraft[]>([]);
  const [issuerId, setIssuerId] = useState("");
  const [issuerSearch, setIssuerSearch] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [credentialSearch, setCredentialSearch] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [showProposal, setShowProposal] = useState(false);
  const [proposalKind, setProposalKind] = useState<"ISSUER" | "CREDENTIAL" | "SKILL">("ISSUER");
  const [proposalName, setProposalName] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    credential_name: "",
    issuer_name: "",
    issued_on: "",
    expires_on: "",
    source_url: "",
  });
  const skillNames = selectedSkillIds.map((id) => catalogSkills.find((item) => item.id === id)?.name).filter(Boolean).join(", ");

  const loadCatalog = useCallback(async () => {
    const [nextIssuers, nextCredentials, nextSkills, nextDrafts] = await Promise.all([
      catalogApi.issuers(), catalogApi.credentials(), catalogApi.skills(), catalogApi.drafts(),
    ]);
    setIssuers(nextIssuers); setCredentials(nextCredentials); setCatalogSkills(nextSkills); setCatalogDrafts(nextDrafts);
  }, []);
  useEffect(() => { void Promise.resolve().then(loadCatalog).catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo abrir el catálogo.")); }, [loadCatalog]);

  const loadCertifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await apiFetch<Certification[]>("/certifications");
      setCertifications(items);
      setSummary(studentSummary(items, todayIso()));
      setSessionExpired(false);
    } catch (loadError) {
      if (isSessionExpired(loadError)) {
        setCertifications([]);
        setSummary(null);
        setSessionExpired(true);
        setError(null);
      } else {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar tus certificaciones.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCertifications(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCertifications]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const nextFormErrors = validateCertificationForm(
      { ...form, skills: skillNames },
      file,
    );
    setFormErrors(nextFormErrors);
    if (hasCertificationFormErrors(nextFormErrors)) return;

    setSubmitting(true);
    const normalizedSourceUrl = form.source_url.trim() || null;
    try {
      if (activeDraftId) {
        await catalogApi.submitDraft(activeDraftId, { issuer_id: issuerId, catalog_credential_id: credentialId, skill_ids: selectedSkillIds });
        setActiveDraftId(null);
        await loadCatalog();
      } else {
      let id = createdId;
      if (!id) {
        const created = await apiFetch<Certification>("/certifications", {
          method: "POST",
          body: JSON.stringify({
            ...form,
            issuer_id: issuerId,
            catalog_credential_id: credentialId,
            skill_ids: selectedSkillIds,
            expires_on: form.expires_on || null,
            source_url: normalizedSourceUrl,
          }),
        });
        id = created.id;
        setCreatedId(id);
      }
      if (file) {
        const body = new FormData();
        body.append("file", file);
        try {
          await apiFetch(`/certifications/${id}/evidence`, {
            method: "POST",
            body,
          });
        } catch (uploadError) {
          if (
            !(
              uploadError instanceof ApiError &&
              uploadError.status === 409
            )
          ) {
            throw uploadError;
          }
        }
      } else if (normalizedSourceUrl) {
        const body = new FormData();
        body.append("source_url", normalizedSourceUrl);
        try {
          await apiFetch(`/certifications/${id}/evidence`, {
            method: "POST",
            body,
          });
        } catch (uploadError) {
          if (
            !(
              uploadError instanceof ApiError &&
              uploadError.status === 409
            )
          ) {
            throw uploadError;
          }
        }
      }
      }
      setForm({
        credential_name: "",
        issuer_name: "",
        issued_on: "",
        expires_on: "",
        source_url: "",
      });
      setFile(null);
      setCreatedId(null);
      setIssuerId(""); setCredentialId(""); setSelectedSkillIds([]);
      setFormErrors({});
      setShowForm(false);
      setMessage(
        "Certificación registrada. El validador académico revisará la evidencia.",
      );
      await loadCertifications();
    } catch (submitError) {
      if (isSessionExpired(submitError)) {
        setSessionExpired(true);
        setError(null);
      } else {
        await loadCertifications();
        setError(
          submitError instanceof Error
            ? submitError.message
            : "No se pudo registrar la certificación.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = certifications.filter(
    (item) =>
      normalize(`${item.credential_name} ${item.issuer_name}`).includes(
        normalize(query.trim()),
      ) &&
      (statusFilter === "ALL" || item.status === statusFilter),
  );

  const correction = summary?.credentials.find(
    (item) => item.status === "OBSERVED" && item.canCorrect,
  );
  const nextAction = useMemo<NextAction | null>(() => {
    if (!summary) return null;
    if (correction) {
      return {
        title: "Tienes una certificación por corregir",
        description:
          correction.comment ??
          "Revisa las observaciones del validador y reenvía la evidencia.",
        buttonLabel: "Corregir ahora",
        credentialId: correction.id,
      };
    }
    if (summary.pending > 0) {
      return {
        title: "Tu certificación está en revisión",
        description:
          "El validador revisará tus evidencias. Puedes consultar el estado en tu historial.",
        buttonLabel: "Ver historial",
      };
    }
    if (summary.total === 0) {
      return {
        title: "Comienza tu avance profesional",
        description:
          "Registra una certificación y adjunta una evidencia para iniciar la validación.",
        buttonLabel: "Registrar certificación",
        opensForm: true,
      };
    }
    if (summary.expired > 0) {
      return {
        title: "Revisa tus certificaciones vencidas",
        description:
          "Consulta los registros vencidos y mantén actualizado tu historial profesional.",
        buttonLabel: "Ver historial",
      };
    }
    return {
      title: "Sigue construyendo tu perfil",
      description:
        "Registra nuevos logros para mantener tu avance profesional actualizado.",
      buttonLabel: "Nueva certificación",
      opensForm: true,
    };
  }, [correction, summary]);

  function openDetails(id: string) {
    setShowForm(false);
    setSelectedId(id);
    window.setTimeout(() => {
      document
        .getElementById("student-certification-detail")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function openNewCertification() {
    setSelectedId(null);
    setShowForm(true);
    window.setTimeout(() => {
      document
        .getElementById("student-certification-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function clearFormError(field: keyof CertificationFormErrors) {
    setFormErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleNextAction() {
    if (!nextAction) return;
    if (nextAction.credentialId) {
      openDetails(nextAction.credentialId);
    } else if (nextAction.opensForm) {
      openNewCertification();
    } else {
      document
        .getElementById("student-certification-history")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function saveProposalDraft() {
    if (!proposalName.trim() || !form.issued_on) {
      setError("Indica el nombre solicitado y la fecha de emisión antes de guardar el borrador.");
      return;
    }
    if (proposalKind === "CREDENTIAL" && !issuerId) {
      setError("Selecciona primero la entidad emisora.");
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const proposal = await catalogApi.propose({ kind: proposalKind, proposed_name: proposalName.trim(), issuer_id: proposalKind === "CREDENTIAL" ? issuerId : null });
      const draft = await catalogApi.createDraft({
        issuer_id: issuerId || null,
        catalog_credential_id: credentialId || null,
        skill_ids: selectedSkillIds,
        proposal_ids: [proposal.id],
        issued_on: form.issued_on,
        expires_on: form.expires_on || null,
        source_url: form.source_url.trim() || null,
      });
      if (file) await catalogApi.uploadDraftEvidence(draft.id, file);
      await loadCatalog();
      setMessage("Solicitud enviada a administración. Tu registro y evidencia quedaron guardados como borrador.");
      setShowProposal(false); setShowForm(false); setProposalName(""); setFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el borrador.");
    } finally { setSubmitting(false); }
  }

  function continueDraft(draft: CatalogDraft) {
    const resolvedIssuer = draft.proposals.find((item) => item.kind === "ISSUER")?.resolved_id;
    const resolvedCredential = draft.proposals.find((item) => item.kind === "CREDENTIAL")?.resolved_id;
    const resolvedSkills = draft.proposals.filter((item) => item.kind === "SKILL").map((item) => item.resolved_id).filter((value): value is string => Boolean(value));
    const nextIssuerId = resolvedIssuer || draft.form_data.issuer_id || "";
    const nextCredentialId = resolvedCredential || draft.form_data.catalog_credential_id || "";
    setIssuerId(nextIssuerId); setCredentialId(nextCredentialId);
    setSelectedSkillIds([...new Set([...draft.form_data.skill_ids, ...resolvedSkills])]);
    setForm({ issuer_name: issuers.find((item) => item.id === nextIssuerId)?.name || "", credential_name: credentials.find((item) => item.id === nextCredentialId)?.name || "", issued_on: draft.form_data.issued_on, expires_on: draft.form_data.expires_on || "", source_url: draft.form_data.source_url || "" });
    setActiveDraftId(draft.id); setFile(null); setShowForm(true); setShowProposal(false);
    window.setTimeout(() => document.getElementById("student-certification-form")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mis certificaciones" action={!showForm && (
          <button
            onClick={openNewCertification}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus aria-hidden="true" size={18} />
            Nueva certificación
          </button>
        )} />

      {message && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700"
        >
          {message}
        </div>
      )}

      {sessionExpired ? (
        <SessionExpiredState />
      ) : (
        <>
          <ReferenceStudentProfile />

          {summary && nextAction && (
            <StudentOverview
              summary={summary}
              nextAction={nextAction}
              onNextAction={handleNextAction}
              onOpenCredential={openDetails}
            />
          )}

          {error && summary && (
            <InlineError message={error} onRetry={() => void loadCertifications()} />
          )}

          {catalogDrafts.some((draft) => !draft.submitted_certification_id) && <section className="surface-card p-5" aria-label="Borradores pendientes"><h2 className="section-title">Borradores pendientes</h2><div className="mt-3 space-y-2">{catalogDrafts.filter((draft) => !draft.submitted_certification_id).map((draft) => <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"><div><p className="font-semibold text-slate-900">Certificación del {formatDate(draft.form_data.issued_on)}</p><p className="text-slate-600">{draft.proposals.some((item) => item.status === "REJECTED") ? `Opción rechazada: ${draft.proposals.find((item) => item.status === "REJECTED")?.reason || "consulta a administración"}` : draft.proposals.some((item) => item.status !== "RESOLVED") ? "Administración revisa las opciones solicitadas" : "Opciones resueltas; completa y envía el registro"}{draft.evidence_filename ? ` · Evidencia: ${draft.evidence_filename}` : ""}</p></div>{draft.proposals.every((item) => item.status === "RESOLVED") && <button type="button" onClick={() => continueDraft(draft)} className="font-semibold text-blue-700">Continuar →</button>}</div>)}</div></section>}

          {showForm && (
            <form
              id="student-certification-form"
              onSubmit={submit}
              noValidate
              className="scroll-mt-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
            >
              {hasCertificationFormErrors(formErrors) && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                >
                  Revisa los campos marcados antes de enviar la certificación.
                </p>
              )}
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="section-title">
                    Registrar certificación
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cerrar
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">Entidad emisora
                  <input type="search" value={issuerSearch} onChange={(event) => setIssuerSearch(event.target.value)} placeholder="Buscar entidad" aria-label="Buscar entidad emisora" className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <select required value={issuerId} onChange={(event) => { const next = event.target.value; setIssuerId(next); setCredentialId(""); setCredentialSearch(""); setSelectedSkillIds([]); setForm((current) => ({ ...current, issuer_name: issuers.find((item) => item.id === next)?.name || "", credential_name: "" })); clearFormError("issuer_name"); }} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3"><option value="">Selecciona la entidad...</option>{issuers.filter((item) => item.active && (item.id === issuerId || item.name.toLocaleLowerCase("es").includes(issuerSearch.toLocaleLowerCase("es")) || item.aliases.some((alias) => alias.toLocaleLowerCase("es").includes(issuerSearch.toLocaleLowerCase("es"))))).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                  {formErrors.issuer_name && <span role="alert" className="mt-1 block text-xs text-rose-700">{formErrors.issuer_name}</span>}
                </label>
                <label className="block text-sm font-semibold text-slate-700">Nombre de la certificación
                  <input type="search" disabled={!issuerId} value={credentialSearch} onChange={(event) => setCredentialSearch(event.target.value)} placeholder="Buscar certificación" aria-label="Buscar certificación" className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50" />
                  <select required disabled={!issuerId} value={credentialId} onChange={(event) => { const next = event.target.value; const selected = credentials.find((item) => item.id === next); setCredentialId(next); setSelectedSkillIds(selected?.skill_ids ?? []); setForm((current) => ({ ...current, credential_name: selected?.name ?? "" })); clearFormError("credential_name"); }} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 disabled:bg-slate-50"><option value="">Selecciona la certificación...</option>{credentials.filter((item) => item.active && item.issuer_id === issuerId && (item.id === credentialId || item.name.toLocaleLowerCase("es").includes(credentialSearch.toLocaleLowerCase("es")))).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                  {formErrors.credential_name && <span role="alert" className="mt-1 block text-xs text-rose-700">{formErrors.credential_name}</span>}
                </label>
                <Field
                  label="Fecha de emisión"
                  type="date"
                  value={form.issued_on}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, issued_on: value }))
                  }
                  onEdited={() => clearFormError("issued_on")}
                  error={formErrors.issued_on}
                  required
                />
                <Field
                  label="Fecha de vencimiento (opcional)"
                  type="date"
                  value={form.expires_on}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, expires_on: value }))
                  }
                  onEdited={() => clearFormError("expires_on")}
                  error={formErrors.expires_on}
                />
                <Field
                  label="URL pública de verificación (opcional)"
                  type="url"
                  value={form.source_url}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, source_url: value }))
                  }
                  onEdited={() => clearFormError("source_url")}
                  error={formErrors.source_url}
                />
                <fieldset className="md:col-span-2"><legend className="text-sm font-semibold text-slate-700">Habilidades acreditadas</legend><div className="mt-2 flex flex-wrap gap-2">{catalogSkills.filter((item) => item.active).map((skill) => <label key={skill.id} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${credentials.find((item) => item.id === credentialId)?.skill_ids.includes(skill.id) ? "border-blue-200 bg-blue-50" : "border-slate-200"}`}><input type="checkbox" checked={selectedSkillIds.includes(skill.id)} onChange={() => { setSelectedSkillIds((current) => current.includes(skill.id) ? current.filter((id) => id !== skill.id) : [...current, skill.id]); clearFormError("skills"); }} />{skill.name}</label>)}</div>{formErrors.skills && <span role="alert" className="mt-1 block text-xs text-rose-700">{formErrors.skills}</span>}</fieldset>
              </div>
              <div className="mt-4"><button type="button" onClick={() => setShowProposal((value) => !value)} className="text-sm font-semibold text-blue-700">No encuentro esta opción</button>{showProposal && <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[180px_1fr_auto]"><label className="text-sm">Tipo de solicitud<select value={proposalKind} onChange={(event) => setProposalKind(event.target.value as typeof proposalKind)} className="mt-1 w-full rounded-lg border border-slate-300 p-2"><option value="ISSUER">Entidad emisora</option><option value="CREDENTIAL">Certificación</option><option value="SKILL">Habilidad</option></select></label><label className="text-sm">Nombre que figura en la evidencia<input value={proposalName} onChange={(event) => setProposalName(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><button type="button" disabled={submitting || !proposalName.trim()} onClick={() => void saveProposalDraft()} className="self-end rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar borrador</button><p className="text-xs text-slate-600 sm:col-span-3">Administración revisará el nombre. La solicitud no se incorpora a los indicadores.</p></div>}</div>
              <label className="mt-4 block text-sm font-semibold text-gray-700">
                Evidencia privada (PDF, PNG o JPEG; máximo 10 MB)
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  aria-invalid={Boolean(formErrors.file)}
                  aria-describedby={formErrors.file ? "student-evidence-error" : undefined}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    clearFormError("file");
                  }}
                  className="mt-2 block w-full rounded-lg border border-dashed border-gray-300 p-4 text-sm"
                />
                {formErrors.file && (
                  <span
                    id="student-evidence-error"
                    role="alert"
                    className="mt-1 block text-xs font-medium text-rose-700"
                  >
                    {formErrors.file}
                  </span>
                )}
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 font-semibold text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-60"
                >
                  {submitting && (
                    <Loader2 aria-hidden="true" className="animate-spin" size={16} />
                  )}
                  Enviar a validación
                </button>
              </div>
            </form>
          )}

          {createdId && (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
              La certificación ya está registrada. Al reenviar se reintentará únicamente adjuntar el archivo; también puedes abrir su detalle en el historial.
            </p>
          )}

          <section
            id="student-certification-history"
            aria-labelledby="student-history-heading"
            className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 p-5 md:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 id="student-history-heading" className="section-title">
                    Historial de certificaciones
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Revisa tus registros y el estado de cada validación.
                  </p>
                </div>
                {loading && (
                  <Loader2
                    aria-label="Cargando certificaciones"
                    className="animate-spin text-blue-600"
                    size={18}
                  />
                )}
              </div>
              {certifications.length > 0 && (
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
                    <Search aria-hidden="true" size={17} className="shrink-0 text-slate-400" />
                    <span className="sr-only">Buscar certificaciones</span>
                    <input
                      aria-label="Buscar certificaciones"
                      placeholder="Buscar por certificación o entidad"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="min-w-0 w-full bg-transparent text-sm outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <span>Estado</span>
                    <select
                      aria-label="Filtrar por estado"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600"
                    >
                      <option value="ALL">Todos</option>
                      {certificationStatuses.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
            <AsyncState
              loading={loading}
              error={summary ? null : error}
              empty={Boolean(summary && summary.total === 0)}
              onRetry={() => void loadCertifications()}
              loadingText="Cargando tus certificaciones…"
              emptyText="Todavía no tienes certificaciones registradas."
            >
              <>
                <div role="status" className="px-6 pt-4 text-xs text-slate-500">
                  {filtered.length} de {certifications.length} certificaciones
                </div>
                <div className="divide-y divide-slate-100 px-5 md:px-6">
                  {filtered.map((item) => {
                    const expanded = selectedId === item.id;
                    return (
                      <article key={item.id} className="py-5">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 text-slate-500">
                              <Award aria-hidden="true" size={20} />
                            </span>
                            <div>
                              <p className="break-words font-semibold text-slate-900">{item.credential_name}</p>
                              <p className="mt-1 break-words text-sm text-slate-500">{item.issuer_name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Emitida {formatDate(item.issued_on)} · {item.evidences.length}{" "}
                                {item.evidences.length === 1 ? "evidencia" : "evidencias"}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                              {statusLabel(item.status)}
                            </span>
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() => setSelectedId(expanded ? null : item.id)}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {expanded ? "Cerrar detalle" : "Ver detalle"}
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div id="student-certification-detail" className="scroll-mt-6 mt-4">
                            <CertificationDetails
                              key={item.id}
                              item={item}
                              onSaved={loadCertifications}
                              onClose={() => setSelectedId(null)}
                            />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
                {filtered.length === 0 && (
                  <div className="p-10 text-center">
                    <p className="text-sm text-slate-500">
                      No hay certificaciones que coincidan con tu búsqueda.
                    </p>
                    <button
                      onClick={() => {
                        setQuery("");
                        setStatusFilter("ALL");
                      }}
                      className="mt-3 text-sm font-semibold text-blue-600"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </>
            </AsyncState>
          </section>
        </>
      )}
    </div>
  );
}

function StudentOverview({
  summary,
  nextAction,
  onNextAction,
  onOpenCredential,
}: {
  summary: StudentSummary;
  nextAction: NextAction;
  onNextAction: () => void;
  onOpenCredential: (id: string) => void;
}) {
  const cards = [
    {
      label: "Aprobadas",
      value: summary.approved,
      description: "Listas para mostrar en tu avance.",
      icon: CheckCircle2,
    },
    {
      label: "Pendientes",
      value: summary.pending,
      description: "En espera o en revisión.",
      icon: Clock3,
    },
    {
      label: "Observadas",
      value: summary.observed,
      description: "Requieren revisar un comentario.",
      icon: MessageCircleWarning,
    },
    {
      label: "Vencidas",
      value: summary.expired,
      description: "Con fecha de vencimiento superada.",
      icon: CalendarClock,
    },
  ] as const;
  const corrections = summary.credentials.filter(
    (item) => item.status === "OBSERVED" && item.canCorrect,
  );

  return (
    <section aria-labelledby="student-summary-heading" className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <SectionHeading id="student-summary-heading" title="Resumen de certificaciones" />
        <p className="text-xs text-slate-500">
          Consulta del {formatDate(summary.asOf)} · {summary.total}{" "}
          {summary.total === 1 ? "registro" : "registros"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <MetricCard key={card.label} label={card.label} value={card.value} icon={card.icon} description={card.description} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="surface-card p-5">
          <div className="flex items-start gap-3">
            <span className="mt-1 text-blue-700">
              <ArrowRight aria-hidden="true" size={19} />
            </span>
            <div className="min-w-0">
              <h3 className="card-title">{nextAction.title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                {nextAction.description}
              </p>
              {!nextAction.opensForm && (
                <button
                  onClick={onNextAction}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  {nextAction.buttonLabel}
                  <ArrowRight aria-hidden="true" size={16} />
                </button>
              )}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="student-attention-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <MessageCircleWarning aria-hidden="true" className="text-slate-500" size={19} />
            <h3 id="student-attention-heading" className="font-semibold text-slate-950">
              Correcciones
            </h3>
          </div>
          {corrections.length > 0 ? (
            <div className="mt-4 space-y-3">
              {corrections.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {item.comment ?? "Revisa la observación del validador."}
                  </p>
                  <button
                    onClick={() => onOpenCredential(item.id)}
                    className="mt-2 text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                  >
                    Abrir corrección
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              No hay correcciones pendientes.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function SessionExpiredState() {
  return (
    <section
      role="alert"
      aria-labelledby="student-session-expired"
      className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center"
    >
      <AlertCircle aria-hidden="true" className="text-blue-700" size={32} />
      <h2 id="student-session-expired" className="mt-4 text-xl font-semibold text-slate-950">
        Tu sesión expiró
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
        Inicia sesión nuevamente para consultar tus certificaciones. Tus registros siguen protegidos y no se han eliminado.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <RefreshCw aria-hidden="true" size={16} />
        Volver a iniciar sesión
      </button>
    </section>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800"
    >
      <XCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
      <p className="flex-1 text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold"
      >
        <RefreshCw aria-hidden="true" size={15} />
        Reintentar
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onEdited,
  type = "text",
  required = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onEdited?: () => void;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  const fieldId = `student-field-${label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()}`;
  const errorId = `${fieldId}-error`;
  return (
    <label htmlFor={fieldId} className="text-sm font-semibold text-gray-700">
      {label}
      <input
        id={fieldId}
        required={required}
        type={type}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          onEdited?.();
        }}
        className={`mt-2 block w-full rounded-lg border px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? "border-rose-300" : "border-gray-200"
        }`}
      />
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs font-medium text-rose-700">
          {error}
        </span>
      )}
    </label>
  );
}

export default function StudentProfilePage() {
  return (
    <RoleGate allow={["STUDENT"]}>
      <StudentProfileContent />
    </RoleGate>
  );
}
