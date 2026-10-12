"use client";

import { FormEvent, useState } from "react";
import { ApiError, apiFetch } from "@/shared/api/client";
import type { Certification } from "@/shared/api/types";
import {
  hasCertificationFormErrors,
  validateCertificationForm,
  type CertificationFormErrors,
  type CertificationFormValues,
} from "@/features/certifications/validation";

type DetailFormValues = CertificationFormValues & { level: string };

const editableFields: Array<{
  key: keyof CertificationFormValues;
  label: string;
  type: "date" | "text" | "url";
  required?: boolean;
}> = [
  { key: "credential_name", label: "Nombre de la certificación", type: "text", required: true },
  { key: "issuer_name", label: "Entidad emisora", type: "text", required: true },
  { key: "issued_on", label: "Fecha de emisión", type: "date", required: true },
  { key: "expires_on", label: "Fecha de vencimiento (opcional)", type: "date" },
  { key: "source_url", label: "URL de verificación (opcional)", type: "url" },
  { key: "skills", label: "Habilidades, separadas por comas", type: "text", required: true },
];

export function CertificationDetails({
  item,
  onSaved,
  onClose,
}: {
  item: Certification;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DetailFormValues>({
    credential_name: item.credential_name,
    issuer_name: item.issuer_name,
    issued_on: item.issued_on,
    expires_on: item.expires_on ?? "",
    source_url: item.source_url ?? "",
    skills: item.skills.map((skill) => skill.name).join(", "),
    level: item.skills[0]?.level ?? "Other",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<CertificationFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function updateField(field: keyof CertificationFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateCertificationForm(form, file);
    setErrors(nextErrors);
    if (hasCertificationFormErrors(nextErrors)) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (file) {
        const body = new FormData();
        body.append("file", file);
        try {
          await apiFetch(`/certifications/${item.id}/evidence`, {
            method: "POST",
            body,
          });
        } catch (uploadError) {
          if (
            !(uploadError instanceof ApiError && uploadError.status === 409)
          ) {
            throw uploadError;
          }
        }
        setFile(null);
      }

      const { skills, level, ...values } = form;
      await apiFetch(`/certifications/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...values,
          expires_on: values.expires_on || null,
          source_url: values.source_url || null,
          skills: skills
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name) => ({
              name,
              level: item.skills.find((skill) => skill.name === name)?.level ?? level,
            })),
        }),
      });
      setErrors({});
      setMessage(
        item.status === "OBSERVED"
          ? "Corrección reenviada al validador."
          : "Cambios guardados.",
      );
      await onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudieron guardar los cambios.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function viewEvidence(id: string) {
    const preview = window.open("", "_blank");
    if (preview) preview.opener = null;
    setError(null);
    try {
      const access = await apiFetch<{ access_url: string }>(
        `/certifications/${item.id}/evidence/${id}/access`,
        { method: "POST" },
      );
      if (preview) preview.location.href = access.access_url;
      else setError("Permite abrir ventanas para consultar la evidencia.");
    } catch (accessError) {
      preview?.close();
      setError(
        accessError instanceof Error
          ? accessError.message
          : "No se pudo abrir la evidencia.",
      );
    }
  }

  return (
    <section
      role="region"
      aria-labelledby="certification-detail-heading"
      className="rounded-xl border border-blue-200 bg-white p-5"
    >
      <div className="flex justify-between gap-3">
        <h2
          id="certification-detail-heading"
          className="font-semibold text-slate-900"
        >
          Detalle de certificación
        </h2>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="text-sm text-slate-500"
        >
          Cerrar detalle
        </button>
      </div>

      {item.latest_comment && (
        <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Comentario del validador:</strong> {item.latest_comment}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <div className="mt-4">
        <h3 className="text-sm font-semibold">Evidencias adjuntas</h3>
        {item.evidences.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.evidences.map((evidence) => (
              <button
                key={evidence.id}
                type="button"
                onClick={() => void viewEvidence(evidence.id)}
                className="rounded-md border border-slate-200 px-3 py-2 text-xs text-blue-700"
              >
                Ver {evidence.original_filename ?? "enlace de verificación"}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Aún no hay evidencias adjuntas.
          </p>
        )}
      </div>

      {item.correction_allowed ? (
        <form noValidate onSubmit={save} className="mt-5 space-y-4">
          {hasCertificationFormErrors(errors) && (
            <p
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              Revisa los campos marcados antes de reenviar la corrección.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {editableFields.map(({ key, label, type, required }) => {
              const inputId = `certification-detail-${key}`;
              const errorId = `${inputId}-error`;
              return (
                <label key={key} htmlFor={inputId} className="text-sm font-medium">
                  {label}
                  <input
                    id={inputId}
                    disabled={busy}
                    required={required}
                    type={type}
                    value={form[key]}
                    aria-invalid={Boolean(errors[key])}
                    aria-describedby={errors[key] ? errorId : undefined}
                    onChange={(event) => updateField(key, event.target.value)}
                    className={`mt-1 block w-full rounded-md border px-3 py-2 ${
                      errors[key] ? "border-rose-300" : "border-slate-300"
                    }`}
                  />
                  {errors[key] && (
                    <span
                      id={errorId}
                      role="alert"
                      className="mt-1 block text-xs font-medium text-rose-700"
                    >
                      {errors[key]}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <label htmlFor="certification-detail-evidence" className="block text-sm font-medium">
            Adjuntar evidencia adicional (PDF, PNG o JPEG; máximo 10 MB)
            <input
              id="certification-detail-evidence"
              disabled={busy}
              type="file"
              accept=".pdf,image/png,image/jpeg"
              aria-invalid={Boolean(errors.file)}
              aria-describedby={errors.file ? "certification-detail-file-error" : undefined}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setErrors((current) => {
                  if (!current.file) return current;
                  const next = { ...current };
                  delete next.file;
                  return next;
                });
              }}
              className="mt-2 block w-full rounded-md border border-dashed border-slate-300 p-3"
            />
            {errors.file && (
              <span
                id="certification-detail-file-error"
                role="alert"
                className="mt-1 block text-xs font-medium text-rose-700"
              >
                {errors.file}
              </span>
            )}
          </label>
          <p className="text-xs text-slate-500">
            Las evidencias existentes se conservan. Si la certificación está observada,
            guardar la corrección la reenvía a revisión.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy
              ? "Guardando…"
              : item.status === "OBSERVED"
                ? "Reenviar corrección"
                : "Guardar cambios"}
          </button>
        </form>
      ) : (
        <p className="mt-5 text-sm text-slate-500">
          Esta certificación no admite cambios en su estado actual.
        </p>
      )}
    </section>
  );
}
