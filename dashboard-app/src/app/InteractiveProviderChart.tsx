"use client";

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
import type { AnalyticsMetric } from "@/shared/api/types";

const colors = [
  "#2563eb",
  "#4f83e8",
  "#6b9cf0",
  "#7aaaf3",
  "#31578f",
  "#8eb9f5",
  "#5278ae",
  "#a8c5f8",
];

function DistributionCard({
  title,
  rows,
}: {
  title: string;
  rows: AnalyticsMetric[];
}) {
  return (
    <section className="surface-card overflow-hidden p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-semibold tabular-nums text-blue-700">
          {rows.length}
        </span>
      </div>
      {rows.length ? (
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ left: 0, right: 32, top: 5, bottom: 0 }}
              barSize={18}
            >
              <CartesianGrid
                stroke="#e2e8f0"
                strokeDasharray="3 4"
                horizontal={false}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#475569" }}
              />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                }}
              />
              <Bar
                isAnimationActive={false}
                dataKey="value"
                name="Certificaciones aprobadas"
                radius={[0, 5, 5, 0]}
                background={{ fill: "#f8fafc", radius: 5 }}
              >
                {rows.map((row, index) => (
                  <Cell key={row.name} fill={colors[index % colors.length]} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  fill="#334155"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-slate-500">
          Sin certificaciones aprobadas. El radar de cursos se reporta por separado.
        </p>
      )}
    </section>
  );
}

export function InteractiveProviderChart({
  byIssuer,
  bySkill,
}: {
  byIssuer: AnalyticsMetric[];
  bySkill: AnalyticsMetric[];
}) {
  return (
    <section aria-label="Distribución de certificaciones aprobadas" className="space-y-3">
      <p className="text-xs text-slate-500">Estas distribuciones se calculan con certificaciones de estudiantes aprobadas por el validador; los proveedores del radar pertenecen al catálogo de oportunidades.</p>
      <div className="grid gap-5 lg:grid-cols-2">
        <DistributionCard title="Entidades emisoras" rows={byIssuer} />
        <DistributionCard title="Habilidades acreditadas" rows={bySkill} />
      </div>
    </section>
  );
}
