"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/shared/api/client";
import { qualityAtCutoff, type QualityRun } from "./priorities";
import { SectionHeading, SurfaceCard } from "@/shared/ui/DashboardPrimitives";
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
          Consultando la calidad de los datos…
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
            className="mt-2 font-semibold underline"
          >
            Reintentar calidad
          </button>
        </div>
      ) : !report ? (
        <p className="mt-4 text-sm text-slate-500">
          Todavía no hay un informe de calidad para esta fecha. Revisa las publicaciones del periodo.
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
              <dd className="font-semibold tabular-nums">{report.total_rows}</dd>
            </div>
            <div>
              <dt>Filas aceptadas</dt>
              <dd className="font-semibold tabular-nums">{report.accepted_rows}</dd>
            </div>
            <div>
              <dt>Filas rechazadas</dt>
              <dd className="font-semibold tabular-nums">{report.rejected_rows}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">
            Las filas procesadas no equivalen al número de estudiantes ni de credenciales distintas.
          </p>
        </div>
      )}
      <Link
        href="/admin/publicaciones"
        className="mt-4 inline-block text-sm font-semibold text-blue-700"
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
  if (dataset === "demo") return null;

  return (
    <SurfaceCard className="p-5 sm:p-6" labelledBy="data-quality-heading">
      <SectionHeading id="data-quality-heading" title="Calidad de datos" description="Resultado del periodo completo; no cambia con los filtros." />
      <QualityReport
        key={`${period}:${cutoff}`}
        period={period}
        cutoff={cutoff}
      />
    </SurfaceCard>
  );
}
