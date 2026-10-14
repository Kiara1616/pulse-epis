"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/shared/api/client";

type TraceEvent = {
  role: "STUDENT" | "VALIDATOR" | "ADMIN";
  action: string;
  date: string;
};

type ReferenceCertification = {
  id: string;
  issuer: string;
  credential_name: string;
  issued_on: string;
  expires_on: string | null;
  status: string;
  skills: Array<{ name: string; level: string | null }>;
  traceability: {
    source: "EXAMPLE";
    student: TraceEvent;
    validator: TraceEvent;
    administrator: TraceEvent;
  };
};

type ReferenceStudent = {
  student_key: string;
  student_code: string;
  display_name: string;
  email: string | null;
  cycle: string | null;
  cohort: string | null;
  certifications: ReferenceCertification[];
};

type ReferenceValidationRecords = {
  dataset: "demo";
  reference_label: string;
  period_code: string | null;
  cutoff_date: string | null;
  total_students: number;
  students_with_certifications: number;
  total_certifications: number;
  items: ReferenceStudent[];
};

type AnalyticsPeriod = { code: string; latest_cutoff_date: string | null };

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function roleLabel(role: TraceEvent["role"]) {
  if (role === "STUDENT") return "Estudiante";
  if (role === "VALIDATOR") return "Validador";
  return "Administrador";
}

export function ReferenceValidationRecords() {
  const [periods, setPeriods] = useState<AnalyticsPeriod[]>([]);
  const [period, setPeriod] = useState("");
  const [periodsRevision, setPeriodsRevision] = useState(-1);
  const [data, setData] = useState<ReferenceValidationRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<AnalyticsPeriod[]>("/indicators/periods?dataset=demo")
      .then((items) => {
        if (!active) return;
        setPeriods(items);
        if (!items.length) {
          setData(null);
          setError("No hay periodos disponibles para consultar.");
          setLoading(false);
          return;
        }
        setPeriod((current) =>
          items.some((item) => item.code === current)
            ? current
            : items[0]?.code ?? "",
        );
        setPeriodsRevision(revision);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los periodos.",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  useEffect(() => {
    if (!period || periodsRevision !== revision) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ period_code: period });
      apiFetch<ReferenceValidationRecords>(`/validations/reference?${params}`)
        .then((result) => {
          if (active) setData(result);
        })
        .catch((loadError) => {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "No se pudieron cargar las certificaciones de referencia.",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [period, periodsRevision, revision]);

  function refresh() {
    setLoading(true);
    setData(null);
    setError("");
    setPeriodsRevision(-1);
    setRevision((value) => value + 1);
  }

  return (
    <section
      aria-label="Certificaciones de referencia para consulta"
      className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Datos de referencia · no oficiales
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">
            Certificaciones y trazabilidad
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Consulta las credenciales asociadas a cada estudiante y los eventos
            vinculados con estudiante, validador y administrador. Estos registros
            son de solo lectura.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          Actualizar
        </button>
      </header>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">
          Periodo
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
          >
            {periods.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-600">
          {data
            ? `${data.total_certifications} certificaciones · ${data.total_students} estudiantes · corte ${dateLabel(data.cutoff_date)}`
            : "Selecciona un periodo para consultar sus registros."}
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg bg-white p-4 text-sm text-rose-700">
          <p>{error}</p>
          <button type="button" onClick={refresh} className="mt-2 font-semibold underline">
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <p role="status" className="rounded-lg bg-white p-4 text-sm text-slate-600">
          Cargando certificaciones…
        </p>
      ) : data?.items.length ? (
        <div className="space-y-3">
          {data.items.map((student) => (
            <article
              key={student.student_key}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-slate-900">
                    {student.display_name}
                  </h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {student.student_code}
                    {student.email ? ` · ${student.email}` : ""}
                  </p>
                </div>
                <p className="text-sm text-slate-600">
                  Ciclo {student.cycle ?? "—"} · ingreso {student.cohort ?? "—"} ·{" "}
                  {student.certifications.length} certificaciones
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {student.certifications.map((certification) => (
                  <details
                    key={certification.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <summary className="cursor-pointer">
                      <span className="text-xs font-semibold text-emerald-700">
                        Aprobada · referencia no oficial
                      </span>
                      <p className="mt-1 font-semibold text-slate-900">
                        {certification.credential_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {certification.issuer} · emitida {dateLabel(certification.issued_on)}
                      </p>
                    </summary>
                    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
                      <div>
                        <p className="font-semibold text-slate-700">Habilidades</p>
                        <p className="mt-1">
                          {certification.skills
                            .map(
                              (skill) =>
                                `${skill.name}${skill.level ? ` · ${skill.level}` : ""}`,
                            )
                            .join(", ") || "Sin habilidades registradas"}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {(
                          [
                            certification.traceability.student,
                            certification.traceability.validator,
                            certification.traceability.administrator,
                          ] as TraceEvent[]
                        ).map((event) => (
                          <div
                            key={`${event.role}-${event.date}`}
                            className="rounded border border-slate-200 bg-white p-2"
                          >
                            <p className="font-semibold text-slate-700">
                              {roleLabel(event.role)}
                            </p>
                            <p className="mt-1 text-amber-700">Evento de ejemplo</p>
                            <p className="mt-1">{event.action}</p>
                            <p className="mt-1">{dateLabel(event.date)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-white p-4 text-sm text-slate-600">
          No hay certificaciones para este periodo.
        </p>
      )}
    </section>
  );
}
