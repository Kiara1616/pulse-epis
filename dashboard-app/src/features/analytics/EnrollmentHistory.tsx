"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/shared/api/client";

type EnrollmentPoint = {
  period_code: string;
  active_students: number;
  basis: "public_history" | "published_snapshot";
  reference_total: number;
  source_label: string;
  source_url: string;
};

export function EnrollmentHistory() {
  const [rows, setRows] = useState<EnrollmentPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    void apiFetch<EnrollmentPoint[]>("/indicators/enrollment-history", {
      signal: abort.signal,
    })
      .then((history) => {
        if (!abort.signal.aborted) setRows(history);
      })
      .catch((loadError) => {
        if (!abort.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar el historial de matrícula.",
          );
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, []);

  return (
    <section className="surface-card min-w-0 p-5">
      <h2 className="section-title">
        Matrícula por periodo
      </h2>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Histórico agregado UPT/GPAD y padrón actual publicado en Pulse.
      </p>
      {loading ? (
        <p role="status" className="mt-6 text-sm text-slate-500">
          Cargando historial…
        </p>
      ) : error ? (
        <p role="alert" className="mt-6 text-sm text-rose-700">
          {error}
        </p>
      ) : rows.length ? (
        <div className="mt-5 h-72 overflow-x-auto">
          <div className="h-full min-w-[650px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke="#e2e8f0"
                  strokeDasharray="3 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="period_code"
                  tick={{ fontSize: 10 }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => Math.ceil((dataMax + Math.max(15, dataMax * 0.12)) / 10) * 10]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <Tooltip
                  formatter={(value) => [
                    value,
                    "Estudiantes matriculados",
                  ]}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="active_students"
                  name="Estudiantes matriculados"
                  fill="#60a5fa"
                  radius={[5, 5, 0, 0]}
                >
                  <LabelList
                    dataKey="active_students"
                    position="top"
                    fontSize={11}
                    fill="#475569"
                  />
                  {rows.map((row) => (
                    <Cell
                      key={row.period_code}
                      fill={row.basis === "published_snapshot" ? "#1d4ed8" : "#93c5fd"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          No hay periodos de matrícula disponibles.
        </p>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Fuente: UPT/GPAD para el histórico; snapshot ETL de Pulse para el periodo vigente.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500" aria-label="Leyenda de fuentes">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-300" aria-hidden="true" />Histórico UPT/GPAD</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-800" aria-hidden="true" />Padrón vigente en Pulse</span>
      </div>
      {rows.filter((row) => row.basis === "published_snapshot" && row.active_students !== row.reference_total).map((row) => (
        <p key={`${row.period_code}-reconciliation`} className="mt-2 text-xs text-amber-700">
          {row.period_code}: Pulse publica {row.active_students} estudiantes activos; GPAD reporta {row.reference_total}. La diferencia queda visible para conciliación institucional.
        </p>
      ))}
    </section>
  );
}
