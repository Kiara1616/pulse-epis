"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/shared/api/client";

type TraceEvent = { role: "STUDENT" | "VALIDATOR" | "ADMIN"; action: string; date: string; reference?: string };
type ReferenceCertification = {
  id: string;
  issuer: string;
  credential_name: string;
  issued_on: string;
  expires_on: string | null;
  status: string;
  skills: { name: string; level: string | null }[];
  traceability: { student: TraceEvent; validator: TraceEvent; administrator: TraceEvent };
};
type ReferencePeriod = {
  period_code: string;
  cutoff_date: string;
  cycle: string | null;
  cohort: string | null;
  certifications: ReferenceCertification[];
};
type ReferenceProfile = {
  reference_label: string;
  student: { code: string; display_name: string; email: string };
  periods: ReferencePeriod[];
};

function dateLabel(value: string | null) {
  if (!value) return "Sin vencimiento";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function ReferenceStudentProfile() {
  const [profile, setProfile] = useState<ReferenceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch<ReferenceProfile>("/certifications/reference-preview")
      .then((result) => { if (active) setProfile(result); })
      .catch((loadError) => {
        if (!active) return;
        if (!(loadError instanceof ApiError && loadError.status === 404)) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la vista de referencia.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading || (!profile && !error)) return null;
  if (error) return <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</section>;
  if (!profile) return null;

  return <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6">
    <header><p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">{profile.reference_label}</p><h2 className="mt-1 text-xl font-bold text-slate-950">Historial académico por periodo</h2><p className="mt-2 text-sm text-slate-600">{profile.student.display_name} · {profile.student.code}. Esta misma ficha aparece en las consultas de administración y validación.</p></header>
    <div className="grid gap-3 lg:grid-cols-2">
      {profile.periods.map((period) => <article key={period.period_code} className="rounded-lg border border-blue-100 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-900">Periodo {period.period_code}</h3><p className="mt-1 text-xs text-slate-500">Corte {dateLabel(period.cutoff_date)} · Ciclo {period.cycle ?? "—"}</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Ingreso {period.cohort ?? "—"}</span></div>
        {period.certifications.length ? <div className="mt-3 space-y-2">{period.certifications.map((certificate) => <details key={certificate.id} className="rounded-md border border-slate-200 p-3">
          <summary className="cursor-pointer list-none"><span className="text-xs font-semibold text-emerald-700">Aprobada · referencia</span><p className="mt-1 font-semibold text-slate-900">{certificate.credential_name}</p><p className="mt-1 text-sm text-slate-600">{certificate.issuer} · emisión {dateLabel(certificate.issued_on)} · vence {dateLabel(certificate.expires_on)}</p></summary>
          <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 text-xs text-slate-600"><div><p className="font-semibold text-slate-700">Habilidades acreditadas</p><p className="mt-1">{certificate.skills.map((skill) => `${skill.name}${skill.level ? ` · ${skill.level}` : ""}`).join(", ")}</p></div><div className="grid gap-2 sm:grid-cols-3">{([certificate.traceability.student, certificate.traceability.validator, certificate.traceability.administrator] as TraceEvent[]).map((event) => <div key={`${event.role}-${event.date}`} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="font-semibold">{event.role === "STUDENT" ? "Estudiante" : event.role === "VALIDATOR" ? "Validador" : "Administrador"}</p><p className="mt-1">{event.action}</p><p className="mt-1">{dateLabel(event.date)}</p></div>)}</div></div>
        </details>)}</div> : <p className="mt-4 text-sm text-slate-500">Sin certificaciones aprobadas en este corte.</p>}
      </article>)}
    </div>
  </section>;
}
