"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, ExternalLink, Filter, X } from "lucide-react";
import { statusLabel, statusClass } from "@/shared/ui/status";
import { AsyncState } from "@/shared/ui/AsyncState";
import { RoleGate } from "@/features/access/RoleGate";
import { apiFetch } from "@/shared/api/client";
import { ValidationHistory } from "@/features/certifications/ValidationHistory";

type Status =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "OBSERVED"
  | "RESUBMITTED"
  | "REJECTED"
  | "EXPIRED";
type Action = "START_REVIEW" | "APPROVE" | "OBSERVE" | "REJECT";
type AgeFilter = "ALL" | "TODAY" | "WEEK" | "OLDER";
type CaseFilter = "ALL" | "NEW" | "CORRECTION" | "REVIEW" | "DECIDED";
type Priority = "HIGH" | "MEDIUM" | "LOW";

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
  updated_at?: string;
  external_id?: string | null;
  issuer_url?: string | null;
  skills?: Array<{ name: string; level: string | null }>;
};

const statusOptions: Array<{ value: Status | "ALL"; label: string }> = [
  { value: "ALL", label: "Todos los estados" },
  { value: "PENDING", label: "Pendientes" },
  { value: "RESUBMITTED", label: "Reenviadas" },
  { value: "UNDER_REVIEW", label: "En revisión" },
  { value: "OBSERVED", label: "Observadas" },
  { value: "APPROVED", label: "Aprobadas" },
  { value: "REJECTED", label: "Rechazadas" },
  { value: "EXPIRED", label: "Vencidas" },
];

const ageOptions: Array<{ value: AgeFilter; label: string }> = [
  { value: "ALL", label: "Cualquier antigüedad" },
  { value: "TODAY", label: "Últimas 24 horas" },
  { value: "WEEK", label: "Últimos 7 días" },
  { value: "OLDER", label: "Más de 7 días" },
];

const caseOptions: Array<{ value: CaseFilter; label: string }> = [
  { value: "ALL", label: "Todos los casos" },
  { value: "NEW", label: "Nuevo registro" },
  { value: "CORRECTION", label: "Corrección" },
  { value: "REVIEW", label: "Revisión activa" },
  { value: "DECIDED", label: "Decidido" },
];

function evidencePreviewKind(evidence: ValidationEvidence): "image" | "pdf" | "link" {
  if (evidence.evidence_type !== "FILE") return "link";
  const contentType = evidence.content_type?.toLowerCase() ?? "";
  const filename = evidence.original_filename?.toLowerCase() ?? "";
  if (contentType.startsWith("image/") || /\.(png|jpe?g)$/.test(filename)) return "image";
  if (contentType === "application/pdf" || filename.endsWith(".pdf")) return "pdf";
  return "link";
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-PE").format(date);
}

function formatDateTime(value?: string) {
  if (!value) return "Sin actualización registrada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin actualización registrada"
    : new Intl.DateTimeFormat("es-PE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function recordTimestamp(record: ValidationRecord) {
  const value = record.updated_at ?? `${record.issued_on}T00:00:00`;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function ageInDays(record: ValidationRecord, now: number) {
  return Math.max(0, Math.floor((now - recordTimestamp(record)) / 86_400_000));
}

function matchesAge(record: ValidationRecord, filter: AgeFilter, now: number) {
  const age = ageInDays(record, now);
  if (filter === "TODAY") return age < 1;
  if (filter === "WEEK") return age < 7;
  if (filter === "OLDER") return age >= 7;
  return true;
}

function caseType(record: ValidationRecord): Exclude<CaseFilter, "ALL"> {
  if (record.status === "PENDING") return "NEW";
  if (record.status === "OBSERVED" || record.status === "RESUBMITTED") {
    return "CORRECTION";
  }
  if (record.status === "UNDER_REVIEW") return "REVIEW";
  return "DECIDED";
}

function caseTypeLabel(record: ValidationRecord) {
  return caseOptions.find((option) => option.value === caseType(record))?.label ?? "Caso";
}

function priorityFor(record: ValidationRecord, now: number): Priority {
  if (record.status === "OBSERVED" || record.status === "RESUBMITTED") return "HIGH";
  if (
    (record.status === "PENDING" || record.status === "UNDER_REVIEW") &&
    ageInDays(record, now) >= 7
  ) {
    return "HIGH";
  }
  if (record.status === "PENDING" || record.status === "UNDER_REVIEW") return "MEDIUM";
  return "LOW";
}

function priorityLabel(priority: Priority) {
  return priority === "HIGH" ? "Alta" : priority === "MEDIUM" ? "Media" : "Baja";
}

function priorityClass(priority: Priority) {
  if (priority === "HIGH") return "bg-rose-50 text-rose-700";
  if (priority === "MEDIUM") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function ValidationsContent() {
  const [records, setRecords] = useState<ValidationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [preview, setPreview] = useState<{
    url: string;
    evidence: ValidationEvidence;
  } | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("ALL");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("ALL");
  const [caseFilter, setCaseFilter] = useState<CaseFilter>("ALL");
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  const selected = records.find((record) => record.id === selectedId);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setRecords(await apiFetch<ValidationRecord[]>("/validations"));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la bandeja.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrentTime(Date.now());
      void loadRecords();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const counts = useMemo(
    () => ({
      pending: records.filter(
        (record) => record.status === "PENDING" || record.status === "RESUBMITTED",
      ).length,
      review: records.filter((record) => record.status === "UNDER_REVIEW").length,
      approved: records.filter((record) => record.status === "APPROVED").length,
      observed: records.filter((record) => record.status === "OBSERVED").length,
    }),
    [records],
  );

  const visibleRecords = useMemo(() => {
    const now = currentTime ?? 0;
    return records
      .filter((record) => statusFilter === "ALL" || record.status === statusFilter)
      .filter((record) => matchesAge(record, ageFilter, now))
      .filter((record) => caseFilter === "ALL" || caseType(record) === caseFilter)
      .sort((left, right) => {
        const priorityDifference =
          ["HIGH", "MEDIUM", "LOW"].indexOf(priorityFor(left, now)) -
          ["HIGH", "MEDIUM", "LOW"].indexOf(priorityFor(right, now));
        return priorityDifference || recordTimestamp(right) - recordTimestamp(left);
      });
  }, [ageFilter, caseFilter, currentTime, records, statusFilter]);

  const filtersActive = statusFilter !== "ALL" || ageFilter !== "ALL" || caseFilter !== "ALL";

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
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : "No se pudo guardar la decisión.",
      );
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
      setError(
        accessError instanceof Error
          ? accessError.message
          : "No se pudo abrir la evidencia.",
      );
    } finally {
      setActingId(null);
    }
  }

  function selectRecord(record: ValidationRecord) {
    setSelectedId(record.id);
    setComment("");
    setPreview(null);
    setPreviewError(false);
    setHistoryId(null);
    setError(null);
    if (record.evidences[0]) void openEvidence(record, record.evidences[0]);
  }

  function closeDetail() {
    setSelectedId(null);
    setPreview(null);
    setPreviewError(false);
    setHistoryId(null);
    setComment("");
  }

  function clearFilters() {
    setStatusFilter("ALL");
    setAgeFilter("ALL");
    setCaseFilter("ALL");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-blue-600">Control de evidencia</p>
        <h2 className="mt-1 text-3xl font-black text-gray-900">Bandeja de validaciones</h2>
        <p className="mt-2 max-w-3xl text-gray-500">
          Prioriza los casos, revisa la evidencia y registra una decisión trazable para cada certificación.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {historyId && (
        <ValidationHistory key={historyId} id={historyId} onClose={() => setHistoryId(null)} />
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de validaciones">
        {[
          ["Pendientes", counts.pending],
          ["En revisión", counts.review],
          ["Aprobadas", counts.approved],
          ["Observadas", counts.observed],
        ].map(([label, count]) => (
          <article key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-black text-gray-900">{count}</p>
          </article>
        ))}
      </section>

      <section
        aria-label="Filtros de la bandeja"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-blue-600" aria-hidden="true" />
              <h3 className="font-bold text-slate-900">Filtrar casos de revisión</h3>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {visibleRecords.length} de {records.length} casos visibles · ordenados por prioridad
            </p>
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700"
            >
              <X size={15} aria-hidden="true" />
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Estado
            <select
              aria-label="Filtrar por estado"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as Status | "ALL")}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Antigüedad
            <select
              aria-label="Filtrar por antigüedad"
              value={ageFilter}
              onChange={(event) => setAgeFilter(event.target.value as AgeFilter)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {ageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Tipo de caso
            <select
              aria-label="Filtrar por tipo de caso"
              value={caseFilter}
              onChange={(event) => setCaseFilter(event.target.value as CaseFilter)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {caseOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {selected && (
        <section
          className="space-y-5 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm"
          aria-label="Detalle del envío"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900">{selected.credential_name}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(selected.status)}`}>
                  {statusLabel(selected.status)}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${priorityClass(priorityFor(selected, currentTime ?? 0))}`}>
                  Prioridad {priorityLabel(priorityFor(selected, currentTime ?? 0))}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{caseTypeLabel(selected)}</p>
            </div>
            <button
              type="button"
              disabled={actingId !== null}
              onClick={closeDetail}
              className="text-sm font-semibold text-blue-600 disabled:opacity-50"
            >
              Cerrar detalle
            </button>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Estudiante", selected.student_key],
              ["Emisor", selected.issuer_name],
              ["Identificador de la credencial", selected.external_id || "No registrado"],
              ["Fecha de emisión", formatDate(selected.issued_on)],
              [
                "Fecha de vencimiento",
                selected.expires_on ? formatDate(selected.expires_on) : "Sin vencimiento registrado",
              ],
              ["Última actualización", formatDateTime(selected.updated_at)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-gray-500">{label}</dt>
                <dd className="break-words font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <h4 className="font-semibold text-slate-900">Habilidades declaradas</h4>
            <p className="text-sm text-gray-600">
              {selected.skills?.map((skill) => `${skill.name}${skill.level ? ` (${skill.level})` : ""}`).join(", ") ||
                "Sin habilidades registradas"}
            </p>
          </div>

          {selected.issuer_url && (
            <a href={selected.issuer_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 underline">
              Sitio del emisor
            </a>
          )}
          {selected.source_url && (
            <a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 underline">
              Enlace de verificación declarado
            </a>
          )}
          {selected.latest_comment && (
            <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
              <strong>Último comentario:</strong> {selected.latest_comment}
            </p>
          )}

          <div>
            <h4 className="mb-2 font-semibold text-slate-900">Evidencia adjunta</h4>
            <div className="flex flex-wrap gap-2">
              {selected.evidences.map((evidence) => (
                <button
                  key={evidence.id}
                  type="button"
                  disabled={actingId !== null}
                  onClick={() => void openEvidence(selected, evidence)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-700 disabled:opacity-50"
                >
                  {evidence.original_filename || "Abrir enlace de evidencia"}
                </button>
              ))}
            </div>
            {selected.evidences.length === 0 && (
              <p className="text-sm text-gray-500">No hay evidencia adjunta.</p>
            )}
          </div>

          {preview && (
            <div className="space-y-3 rounded-xl border bg-slate-50 p-3" aria-live="polite">
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 underline"
              >
                <ExternalLink size={16} aria-hidden="true" />
                Abrir evidencia en otra pestaña
              </a>
              {evidencePreviewKind(preview.evidence) === "image" && !previewError && (
                // Temporary signed URLs must be rendered directly, without Next image caching.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={preview.url}
                  src={preview.url}
                  alt="Certificado adjunto por el estudiante"
                  decoding="async"
                  onError={() => setPreviewError(true)}
                  className="max-h-[650px] w-full rounded-lg border border-slate-200 bg-white object-contain"
                />
              )}
              {evidencePreviewKind(preview.evidence) === "pdf" && (
                <iframe
                  src={preview.url}
                  title="Certificado PDF adjunto"
                  className="h-[650px] w-full rounded-lg border border-slate-200 bg-white"
                />
              )}
              {evidencePreviewKind(preview.evidence) === "link" && (
                <p className="text-sm text-slate-600">Esta evidencia se abrirá mediante el enlace de verificación.</p>
              )}
              {previewError && (
                <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-rose-700">
                  <p>No se pudo cargar la imagen. El acceso temporal puede haber vencido.</p>
                  <button
                    type="button"
                    onClick={() => void openEvidence(selected, preview.evidence)}
                    className="rounded-md border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700"
                  >
                    Renovar vista previa
                  </button>
                </div>
              )}
            </div>
          )}

          {(selected.status === "PENDING" || selected.status === "RESUBMITTED") && (
            <button
              type="button"
              disabled={actingId !== null}
              onClick={() => void decide(selected, "START_REVIEW")}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              Tomar revisión
            </button>
          )}

          {selected.status === "UNDER_REVIEW" && (
            <div className="space-y-3 border-t pt-4">
              <label htmlFor="review-comment" className="block font-semibold text-slate-900">
                Comentario para el estudiante
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={2000}
                disabled={actingId !== null}
                rows={3}
                placeholder="Indica el motivo del rechazo o las correcciones necesarias."
                className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              />
              <p className="text-sm text-gray-500">
                Obligatorio al observar o rechazar. El comentario quedará visible para el estudiante.
              </p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    ["APPROVE", "Aprobar", "bg-emerald-600 text-white"],
                    ["OBSERVE", "Observar", "bg-amber-100 text-amber-800"],
                    ["REJECT", "Rechazar", "bg-rose-50 text-rose-700"],
                  ] as const
                ).map(([action, label, color]) => (
                  <button
                    key={action}
                    type="button"
                    disabled={actingId !== null}
                    onClick={() => void decide(selected, action)}
                    className={`rounded-lg px-4 py-2 font-semibold disabled:opacity-50 ${color}`}
                  >
                    {actingId === selected.id ? "Guardando…" : label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setHistoryId(selected.id)}
            className="text-sm font-semibold text-blue-600"
          >
            Ver historial de decisiones
          </button>
        </section>
      )}

      <AsyncState
        loading={loading}
        error={records.length ? null : error}
        empty={!visibleRecords.length}
        onRetry={() => void loadRecords()}
        loadingText="Cargando certificaciones…"
        emptyText={
          records.length
            ? "No hay casos que coincidan con los filtros seleccionados."
            : "No hay certificaciones para revisar."
        }
      >
        <section aria-label="Casos de validación" className="space-y-4">
          {visibleRecords.map((record) => {
            const priority = priorityFor(record, currentTime ?? 0);
            return (
              <button
                key={record.id}
                type="button"
                disabled={actingId !== null}
                onClick={() => selectRecord(record)}
                className="group flex w-full items-center gap-5 rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
              >
                <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                  <Clock3 aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900">{record.credential_name}</h3>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(record.status)}`}>
                      {statusLabel(record.status)}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${priorityClass(priority)}`}>
                      Prioridad {priorityLabel(priority)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {record.student_key} · {record.issuer_name} · {caseTypeLabel(record)} · Actualizado {formatDateTime(record.updated_at)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-blue-600 group-hover:underline">
                  Ver envío
                </span>
              </button>
            );
          })}
        </section>
      </AsyncState>
    </div>
  );
}

export default function ValidationsPage() {
  return (
    <RoleGate allow={["VALIDATOR"]}>
      <ValidationsContent />
    </RoleGate>
  );
}
