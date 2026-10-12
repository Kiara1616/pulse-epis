"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/shared/api/client";
import { qualityAtCutoff, type QualityRun } from "./priorities";
function QualityReport({ period, cutoff }: { period: string; cutoff: string }) {
  const [report, setReport] = useState<QualityRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    apiFetch<QualityRun[]>(
      `/etl/runs?period_code=${encodeURIComponent(period)}`,
      { signal: abort.signal },
    )
      .then((runs) => {
        if (!abort.signal.aborted)
          setReport(qualityAtCutoff(runs, period, cutoff));
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo consultar la calidad.",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [period, cutoff, attempt]);
  return (
    <>
      {loading ? (
        <p role="status" className="mt-4 text-sm text-slate-500">
          Consultando calidad del corte…
        </p>
      ) : error ? (
        <div className="mt-4 text-sm text-rose-700" role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              setAttempt((n) => n + 1);
            }}
            className="mt-2 font-bold underline"
          >
            Reintentar calidad
          </button>
        </div>
      ) : !report ? (
        <p className="mt-4 text-sm text-slate-500">
          No hay un informe de publicación para este periodo y corte. La calidad
          no está evaluada.
        </p>
      ) : (
        <div className="mt-4 space-y-3 text-sm text-slate-700">
          <p className="font-semibold">
            {report.status === "APPLIED"
              ? "Proceso aplicado"
              : report.status === "REJECTED"
                ? "Proceso rechazado por calidad"
                : `Estado del proceso: ${report.status}`}
          </p>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt>Filas de entrada</dt>
              <dd className="font-bold">{report.total_rows}</dd>
            </div>
            <div>
              <dt>Filas aceptadas</dt>
              <dd className="font-bold">{report.accepted_rows}</dd>
            </div>
            <div>
              <dt>Filas rechazadas</dt>
              <dd className="font-bold">{report.rejected_rows}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">
            Último intento registrado para el corte {report.cutoff_date}. Las
            filas del proceso no equivalen al número de estudiantes ni de
            credenciales distintas.
          </p>
        </div>
      )}
      <Link
        href="/admin/publicaciones"
        className="mt-4 inline-block text-sm font-bold text-blue-600"
      >
        Revisar publicaciones y calidad →
      </Link>
    </>
  );
}
export function DataQuality({
  period,
  cutoff,
  dataset,
}: {
  period: string;
  cutoff: string;
  dataset?: "registered" | "demo";
}) {
  return (
    <section
      aria-label="Calidad de datos"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-bold text-slate-900">Calidad de datos</h2>
      <p className="mt-2 text-sm text-slate-500">
        Resultado de validación del proceso de publicación para el periodo
        completo; no cambia con filtros de proveedor, cohorte o ciclo.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Fuente: GET /api/v1/etl/runs · periodo {period} · corte {cutoff}
      </p>
      {dataset === "demo" ? (
        <p className="mt-4 text-sm text-slate-500">
          Datos sintéticos: esta vista no atribuye calidad institucional a la
          demostración.
        </p>
      ) : (
        <QualityReport
          key={`${period}:${cutoff}`}
          period={period}
          cutoff={cutoff}
        />
      )}
    </section>
  );
}
