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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [skillNames, setSkillNames] = useState("");
  const level = "Other";
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    credential_name: "",
    issuer_name: "",
    issued_on: "",
    expires_on: "",
    source_url: "",
  });

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
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      let id = createdId;
      if (!id) {
        const created = await apiFetch<Certification>("/certifications", {
          method: "POST",
          body: JSON.stringify({
            ...form,
            expires_on: form.expires_on || null,
            source_url: form.source_url || null,
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
      } else if (form.source_url) {
        const body = new FormData();
        body.append("source_url", form.source_url);
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
        credential_name: "",
        issuer_name: "",
        issued_on: "",
        expires_on: "",
        source_url: "",
      });
      setFile(null);
      setCreatedId(null);
      setSkillNames("");
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
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">
            Tu desarrollo profesional
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
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
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus aria-hidden="true" size={18} />
          {showForm ? "Cerrar formulario" : "Nueva certificación"}
        </button>
      </header>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {message}
        </div>
      )}

      {sessionExpired ? (
        <SessionExpiredState />
      ) : (
        <>
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
              className="scroll-mt-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">
                    Nueva evidencia
                  </p>
                  <h2 className="mt-1 font-bold text-gray-900">
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
                  required
                />
                <Field
                  label="Entidad emisora"
                  value={form.issuer_name}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, issuer_name: value }))
                  }
                  required
                />
                <Field
                  label="Fecha de emisión"
                  type="date"
                  value={form.issued_on}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, issued_on: value }))
                  }
                  required
                />
                <Field
                  label="Fecha de vencimiento (opcional)"
                  type="date"
                  value={form.expires_on}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, expires_on: value }))
                  }
                />
                <Field
                  label="URL pública de verificación (opcional)"
                  type="url"
                  value={form.source_url}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, source_url: value }))
                  }
                />
                <Field
                  label="Habilidades, separadas por comas"
                  value={skillNames}
                  onChange={setSkillNames}
                  required
                />
              </div>
              <label className="mt-4 block text-sm font-semibold text-gray-700">
                Evidencia privada
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={(event) =>
                    setFile(event.target.files?.[0] ?? null)
                  }
                  className="mt-2 block w-full rounded-lg border border-dashed border-gray-300 p-4 text-sm"
                />
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
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-bold text-white disabled:opacity-60"
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
            <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              La certificación ya está registrada. Al reenviar se reintentará únicamente adjuntar el archivo; también puedes abrir su detalle en el historial.
            </p>
          )}

          {selected && (
            <div id="student-certification-detail" className="scroll-mt-6">
              <CertificationDetails
                key={selected.id}
                item={selected}
                onSaved={loadCertifications}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}

          <section
            id="student-certification-history"
            aria-labelledby="student-history-heading"
            className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 p-5 md:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
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
      tone: "border-emerald-100 bg-emerald-50 text-emerald-700",
    },
    {
      label: "Pendientes",
      value: summary.pending,
      description: "En espera o en revisión.",
      icon: Clock3,
      tone: "border-amber-100 bg-amber-50 text-amber-700",
    },
    {
      label: "Observadas",
      value: summary.observed,
      description: "Requieren revisar un comentario.",
      icon: MessageCircleWarning,
      tone: "border-orange-100 bg-orange-50 text-orange-700",
    },
    {
      label: "Vencidas",
      value: summary.expired,
      description: "Con fecha de vencimiento superada.",
      icon: CalendarClock,
      tone: "border-slate-200 bg-slate-50 text-slate-700",
    },
  ] as const;
  const corrections = summary.credentials.filter(
    (item) => item.status === "OBSERVED" && item.canCorrect,
  );

  return (
    <section aria-labelledby="student-summary-heading" className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">
            Resumen de tu avance
          </p>
          <h2 id="student-summary-heading" className="mt-1 text-2xl font-bold text-slate-950">
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
              className={`rounded-2xl border p-5 shadow-sm ${card.tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight">{card.value}</p>
                </div>
                <Icon aria-hidden="true" size={22} />
              </div>
              <p className="mt-3 text-xs opacity-80">{card.description}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-blue-600 p-3 text-white">
              <ArrowRight aria-hidden="true" size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
                Siguiente acción
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">{nextAction.title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                {nextAction.description}
              </p>
              <button
                onClick={onNextAction}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {nextAction.buttonLabel}
                <ArrowRight aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="student-attention-heading"
          className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <MessageCircleWarning aria-hidden="true" className="text-orange-600" size={19} />
            <h3 id="student-attention-heading" className="font-bold text-slate-950">
              Necesitan tu atención
            </h3>
          </div>
          {corrections.length > 0 ? (
            <div className="mt-4 space-y-3">
              {corrections.map((item) => (
                <div key={item.id} className="rounded-xl bg-orange-50 p-3">
                  <p className="text-sm font-semibold text-orange-950">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-orange-900/80">
                    {item.comment ?? "Revisa la observación del validador."}
                  </p>
                  <button
                    onClick={() => onOpenCredential(item.id)}
                    className="mt-2 text-xs font-bold text-orange-800 underline underline-offset-2"
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
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 block w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
      />
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
