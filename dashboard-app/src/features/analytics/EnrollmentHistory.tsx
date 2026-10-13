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
  basis: "history" | "reference";
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
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">
        Matrícula por periodo · 2020–2026
      </h2>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Los valores de 2020–2025 corresponden al historial mostrado. Para
        2026 se incluyen cifras de referencia hasta registrar el padrón de esos
        periodos.
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
              <BarChart data={rows}>
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
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <Tooltip
                  formatter={(value, _name, item) => [
                    value,
                    item.payload.basis === "reference"
                      ? "Estudiantes · referencia"
                      : "Estudiantes matriculados",
                  ]}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="active_students"
                  name="Estudiantes matriculados"
                  fill="#94a3b8"
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
                      fill={row.basis === "reference" ? "#2563eb" : row.period_code.startsWith("2023-") || row.period_code.startsWith("2024-") ? "#0d9488" : "#94a3b8"}
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
        Fuente: historial de matrícula y datos de referencia para 2026.
      </p>
    </section>
  );
}
