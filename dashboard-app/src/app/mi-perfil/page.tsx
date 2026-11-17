"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Link2,
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
import type { Certification, IssuerOption, LinkedInProfile } from "@/shared/api/types";
import {
  certificationStatuses,
  type StudentSummary,
} from "@/shared/contracts/types";
import { studentSummary } from "@/shared/contracts/adapters";
import { CertificationDetails } from "@/features/certifications/CertificationDetails";
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

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-PE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function StudentProfileContent() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [issuerOptions, setIssuerOptions] = useState<IssuerOption[]>([]);
  const [issuerCatalogLoading, setIssuerCatalogLoading] = useState(true);
  const [issuerCatalogError, setIssuerCatalogError] = useState<string | null>(null);
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
  const [skillNames, setSkillNames] = useState("");
  const level = "Other";
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [linkedinProfile, setLinkedinProfile] = useState<LinkedInProfile | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinSaving, setLinkedinSaving] = useState(false);
  const [linkedinSyncing, setLinkedinSyncing] = useState(false);
  const [linkedinMessage, setLinkedinMessage] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [form, setForm] = useState({
    issuer_id: "",
    credential_name: "",
    issuer_name: "",
    issued_on: "",
    expires_on: "",
    source_url: "",
  });

  const loadIssuerOptions = useCallback(async () => {
    setIssuerCatalogLoading(true);
    setIssuerCatalogError(null);
    try {
      setIssuerOptions(await apiFetch<IssuerOption[]>("/certifications/issuers"));
    } catch (loadError) {
      setIssuerCatalogError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el catálogo de entidades emisoras.",
      );
    } finally {
      setIssuerCatalogLoading(false);
    }
  }, []);

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

  useEffect(() => {
    const timer = window.setTimeout(() => void loadIssuerOptions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadIssuerOptions]);

  const loadLinkedInProfile = useCallback(async () => {
    try {
      const profile = await apiFetch<LinkedInProfile>("/certifications/linkedin/profile");
      setLinkedinProfile(profile);
      setLinkedinUrl(profile.linkedin_url ?? "");
      setLinkedinError(null);
    } catch (loadError) {
      // A student can still use manual certification registration if the
      // optional Apify integration is not configured yet.
      if (loadError instanceof ApiError && loadError.status === 404) return;
      setLinkedinError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el perfil de LinkedIn.",
      );
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLinkedInProfile(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLinkedInProfile]);

  async function saveLinkedInProfile() {
    setLinkedinSaving(true);
    setLinkedinMessage(null);
    setLinkedinError(null);
    try {
      const profile = await apiFetch<LinkedInProfile>("/certifications/linkedin/profile", {
        method: "PUT",
        body: JSON.stringify({ linkedin_url: linkedinUrl.trim() || null }),
      });
      setLinkedinProfile(profile);
      setLinkedinUrl(profile.linkedin_url ?? "");
      if (!profile.linkedin_url) {
        setLinkedinMessage("Se quitó el enlace de LinkedIn del perfil.");
        return;
      }
      setLinkedinSyncing(true);
      try {
        const report = await apiFetch<{
          created: number;
          updated?: number;
          duplicates: number;
          profile_candidates: number;
          publication_candidates: number;
          message: string;
        }>("/certifications/linkedin/sync", { method: "POST" });
        setLinkedinMessage(
          `${report.message} Nuevos: ${report.created}; enlaces actualizados: ${report.updated ?? 0}; repetidos: ${report.duplicates}.`,
        );
        await loadCertifications();
        await loadLinkedInProfile();
      } catch (syncError) {
        // Keep the URL saved even when the deployment has not received the
        // Apify token yet; the student can retry later without retyping it.
        setLinkedinError(
          syncError instanceof Error
            ? `Enlace guardado, pero no se pudo sincronizar: ${syncError.message}`
            : "Enlace guardado, pero no se pudo sincronizar todavía.",
        );
        await loadLinkedInProfile();
      } finally {
        setLinkedinSyncing(false);
      }
    } catch (saveError) {
      setLinkedinError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el enlace de LinkedIn.",
      );
    } finally {
      setLinkedinSaving(false);
    }
  }

  async function syncLinkedIn(force = false) {
    if (!linkedinProfile?.linkedin_url) return;
    setLinkedinSyncing(true);
    setLinkedinMessage(null);
    setLinkedinError(null);
    try {
      const report = await apiFetch<{
        created: number;
        updated?: number;
        duplicates: number;
        message: string;
      }>(`/certifications/linkedin/sync${force ? "?force=true" : ""}`, { method: "POST" });
      setLinkedinMessage(
        `${report.message} Nuevos: ${report.created}; enlaces actualizados: ${report.updated ?? 0}; repetidos: ${report.duplicates}.`,
      );
      await loadCertifications();
      await loadLinkedInProfile();
    } catch (syncError) {
      setLinkedinError(
        syncError instanceof Error
          ? syncError.message
          : "No se pudo sincronizar el perfil.",
      );
      await loadLinkedInProfile();
    } finally {
      setLinkedinSyncing(false);
    }
  }

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
      let id = createdId;
      if (!id) {
        const created = await apiFetch<Certification>("/certifications", {
          method: "POST",
          body: JSON.stringify({
            ...form,
            issuer_id: form.issuer_id || null,
            expires_on: form.expires_on || null,
            source_url: normalizedSourceUrl,
            skills: skillNames
              .split(",")
              .map((name) => name.trim())
              .filter(Boolean)
              .map((name) => ({ name, level })),
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
      setForm({
        issuer_id: "",
        credential_name: "",
        issuer_name: "",
        issued_on: "",
        expires_on: "",
        source_url: "",
      });
      setFile(null);
      setCreatedId(null);
      setSkillNames("");
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

  const selected = certifications.find((item) => item.id === selectedId);
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

  function toggleCertificationForm() {
    if (showForm) {
      setShowForm(false);
      return;
    }
    openNewCertification();
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">
            Tu desarrollo profesional
          </p>
          <h1 className="page-title mt-2">
            Mi avance
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Consulta el estado de tus certificaciones y descubre cuál es tu siguiente acción.
            Solo tú puedes ver y actualizar tus registros.
          </p>
        </div>
        <button
          onClick={toggleCertificationForm}
          aria-expanded={showForm}
          className="primary-button"
        >
          <Plus aria-hidden="true" size={18} />
          {showForm ? "Cerrar formulario" : "Nueva certificación"}
        </button>
      </header>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
        >
          {message}
        </div>
      )}

      {sessionExpired ? (
        <SessionExpiredState />
      ) : (
        <>
          <section
            aria-labelledby="linkedin-profile-heading"
            className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm md:p-6"
          >
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-blue-50 p-3 text-blue-700">
                  <Link2 aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">
                    Importación opcional
                  </p>
                  <h2 id="linkedin-profile-heading" className="mt-1 font-bold text-slate-950">
                    Perfil de LinkedIn
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Guarda tu perfil público para detectar certificaciones y publicaciones. Todo queda pendiente de validación; Pulse no aprueba automáticamente.
                  </p>
                </div>
              </div>
              {linkedinProfile && linkedinProfile.sync_status !== "NEVER" && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {linkedinProfile.sync_status === "SUCCEEDED"
                    ? "Sincronizado"
                    : linkedinProfile.sync_status === "RUNNING"
                      ? "Sincronizando"
                      : linkedinProfile.sync_status === "PARTIAL"
                        ? "Sincronización parcial"
                        : "Requiere revisión"}
                </span>
              )}
            </div>
            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="flex-1 text-sm font-semibold text-slate-700">
                URL del perfil público
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(event) => setLinkedinUrl(event.target.value)}
                  placeholder="https://www.linkedin.com/in/tu-perfil"
                  className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveLinkedInProfile()}
                  disabled={linkedinSaving || linkedinSyncing}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {(linkedinSaving || linkedinSyncing) && <Loader2 size={16} className="animate-spin" />}
                  Guardar y sincronizar
                </button>
                {linkedinProfile?.linkedin_url && (
                  <button
                    type="button"
                    onClick={() => void syncLinkedIn(true)}
                    disabled={linkedinSaving || linkedinSyncing}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                  >
                    <RefreshCw size={16} className={linkedinSyncing ? "animate-spin" : ""} />
                    Actualizar datos
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Certificaciones pendientes: {linkedinProfile?.pending_candidates ?? 0}</span>
              {linkedinProfile?.last_sync_at && (
                <span>Última consulta: {formatDateTime(linkedinProfile.last_sync_at)}</span>
              )}
            </div>
            {(linkedinError || linkedinProfile?.sync_error) && (
              <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {linkedinError ?? linkedinProfile?.sync_error}
              </p>
            )}
            {linkedinMessage && (
              <p role="status" className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                {linkedinMessage}
              </p>
            )}
          </section>
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

          {showForm && (
            <form
              id="student-certification-form"
              onSubmit={submit}
              noValidate
              className="surface-card scroll-mt-6 p-6"
            >
              {hasCertificationFormErrors(formErrors) && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
                >
                  Revisa los campos marcados antes de enviar la certificación.
                </p>
              )}
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">
                    Nueva evidencia
                  </p>
                  <h2 className="card-title mt-1">
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
                <Field
                  label="Nombre de la certificación"
                  value={form.credential_name}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      credential_name: value,
                    }))
                  }
                  onEdited={() => clearFormError("credential_name")}
                  error={formErrors.credential_name}
                  required
                />
                <label className="form-label">
                  Entidad emisora
                  <select
                    required
                    value={form.issuer_name}
                    disabled={issuerCatalogLoading || issuerOptions.length === 0}
                    onChange={(event) => {
                      const option = issuerOptions.find((item) => item.name === event.target.value);
                      setForm((current) => ({
                        ...current,
                        issuer_name: option?.name ?? "",
                        issuer_id: option?.id ?? "",
                      }));
                      clearFormError("issuer_name");
                    }}
                    className={`mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 ${formErrors.issuer_name ? "border-rose-300" : "border-slate-300"}`}
                  >
                    <option value="">
                      {issuerCatalogLoading ? "Cargando entidades…" : "Selecciona una entidad"}
                    </option>
                    {issuerOptions.map((option) => (
                      <option key={option.id ?? option.name} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.issuer_name && <span className="mt-1 block text-xs font-medium text-rose-700">{formErrors.issuer_name}</span>}
                  {issuerCatalogError ? (
                    <span className="mt-1 block text-xs text-rose-700">{issuerCatalogError}</span>
                  ) : issuerOptions.length === 0 && !issuerCatalogLoading ? (
                    <span className="mt-1 block text-xs text-slate-500">El administrador debe publicar primero una entidad desde el radar de cursos.</span>
                  ) : (
                    <span className="mt-1 block text-xs text-slate-500">Selecciona una entidad publicada por administración.</span>
                  )}
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
                  label="URL de verificación (Credly o proveedor; opcional)"
                  type="url"
                  value={form.source_url}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, source_url: value }))
                  }
                  onEdited={() => clearFormError("source_url")}
                  error={formErrors.source_url}
                />
                <Field
                  label="Habilidades, separadas por comas"
                  value={skillNames}
                  onChange={setSkillNames}
                  onEdited={() => clearFormError("skills")}
                  error={formErrors.skills}
                  required
                />
              </div>
              <label className="mt-4 block text-sm font-semibold text-gray-700">
                Evidencia privada (PDF, PNG o JPEG; máximo 2 MB)
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
                  className="primary-button disabled:opacity-60"
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
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              La certificación ya está registrada. Al reenviar se reintentará únicamente adjuntar el archivo; también puedes abrir su detalle en el historial.
            </p>
          )}

          {selected && (
            <div id="student-certification-detail" className="scroll-mt-6">
              <CertificationDetails
                key={selected.id}
                item={selected}
                issuerOptions={issuerOptions}
                onSaved={loadCertifications}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}

          <section
            id="student-certification-history"
            aria-labelledby="student-history-heading"
            className="surface-card scroll-mt-6 overflow-hidden"
          >
            <div className="border-b border-slate-100 p-5 md:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow text-slate-500">
                    Tus registros
                  </p>
                  <h2 id="student-history-heading" className="mt-1 font-semibold text-slate-900">
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
              emptyAction={
                <button
                  onClick={openNewCertification}
                  className="font-semibold text-blue-600 hover:text-blue-800"
                >
                  Registrar la primera
                </button>
              }
            >
              <>
                <div role="status" className="px-6 pt-4 text-xs text-slate-500">
                  {filtered.length} de {certifications.length} certificaciones
                </div>
                <div className="divide-y divide-slate-100 px-5 md:px-6">
                  {filtered.map((item) => (
                    <article
                      key={item.id}
                      className="flex flex-col justify-between gap-3 py-5 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-start gap-3">
                        <span className="rounded-xl bg-blue-50 p-3 text-blue-600">
                          <Award aria-hidden="true" size={20} />
                        </span>
                        <div>
                          <p className="break-words font-semibold text-slate-900">
                            {item.credential_name}
                          </p>
                          <p className="mt-1 break-words text-sm text-slate-500">
                            {item.issuer_name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Emitida {formatDate(item.issued_on)} · {item.evidences.length}{" "}
                            {item.evidences.length === 1 ? "evidencia" : "evidencias"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                        <button
                          onClick={() => openDetails(item.id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Ver detalle
                        </button>
                      </div>
                    </article>
                  ))}
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
      tone: "status-card status-card-approved",
    },
    {
      label: "Pendientes",
      value: summary.pending,
      description: "En espera o en revisión.",
      icon: Clock3,
      tone: "status-card status-card-pending",
    },
    {
      label: "Observadas",
      value: summary.observed,
      description: "Requieren revisar un comentario.",
      icon: MessageCircleWarning,
      tone: "status-card status-card-observed",
    },
    {
      label: "Vencidas",
      value: summary.expired,
      description: "Con fecha de vencimiento superada.",
      icon: CalendarClock,
      tone: "status-card status-card-expired",
    },
  ] as const;
  const corrections = summary.credentials.filter(
    (item) => item.status === "OBSERVED" && item.canCorrect,
  );

  return (
    <section aria-labelledby="student-summary-heading" className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">
            Resumen de tu avance
          </p>
          <h2 id="student-summary-heading" className="section-title mt-1 text-2xl">
            Un paso a la vez
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Consulta del {formatDate(summary.asOf)} · {summary.total}{" "}
          {summary.total === 1 ? "registro" : "registros"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              aria-label={`${card.label}: ${card.value}`}
              className={`p-5 shadow-sm ${card.tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</p>
                </div>
                <Icon aria-hidden="true" size={22} />
              </div>
              <p className="mt-3 text-xs opacity-80">{card.description}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="soft-panel p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-blue-600 p-3 text-white">
              <ArrowRight aria-hidden="true" size={20} />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">
                Siguiente acción
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">{nextAction.title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                {nextAction.description}
              </p>
              <button
                onClick={onNextAction}
                className="primary-button mt-5"
              >
                {nextAction.buttonLabel}
                <ArrowRight aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="student-attention-heading"
          className="surface-card p-6"
        >
          <div className="flex items-center gap-2">
            <MessageCircleWarning aria-hidden="true" className="text-blue-600" size={19} />
            <h3 id="student-attention-heading" className="font-bold text-slate-950">
              Necesitan tu atención
            </h3>
          </div>
          {corrections.length > 0 ? (
            <div className="mt-4 space-y-3">
              {corrections.map((item) => (
                <div key={item.id} className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {item.comment ?? "Revisa la observación del validador."}
                  </p>
                  <button
                    onClick={() => onOpenCredential(item.id)}
                    className="mt-2 text-xs font-semibold text-blue-700 underline underline-offset-2"
                  >
                    Abrir corrección
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              No tienes correcciones pendientes. Cuando el validador observe un registro, aparecerá aquí.
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
      className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"
    >
      <AlertCircle aria-hidden="true" className="text-amber-600" size={32} />
      <h2 id="student-session-expired" className="mt-4 text-xl font-bold text-amber-950">
        Tu sesión expiró
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-amber-900">
        Inicia sesión nuevamente para consultar tus certificaciones. Tus registros siguen protegidos y no se han eliminado.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800"
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
        className="inline-flex shrink-0 items-center gap-1 text-sm font-bold"
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
