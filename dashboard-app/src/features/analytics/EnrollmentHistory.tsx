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
  basis: "published";
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
        Periodos con padrón y snapshot ETL publicados.
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
                      fill="#3b82f6"
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
        Fuente: snapshots ETL de padrón publicados.
      </p>
    </section>
  );
}
