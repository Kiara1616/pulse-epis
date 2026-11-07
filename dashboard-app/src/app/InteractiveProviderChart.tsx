"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsMetric } from "@/shared/api/types";

const blueTones = ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#1e40af", "#1e3a8a"];
const chartTooltipStyle = { borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgb(15 23 42 / 0.08)" };

export function InteractiveProviderChart({
  byIssuer,
  bySkill,
}: {
  byIssuer: AnalyticsMetric[];
  bySkill: AnalyticsMetric[];
}) {
  const issuers = [...byIssuer].sort((left, right) => right.value - left.value);
  const skills = [...bySkill].sort((left, right) => right.value - left.value);
  const skillTotal = skills.reduce((total, item) => total + item.value, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="surface-card min-w-0 p-5">
        <ChartHeading title="Entidades emisoras" description="Certificaciones aprobadas por entidad." count={issuers.length} />
        {issuers.length ? (
          <>
            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={issuers} layout="vertical" margin={{ left: 0, right: 34, top: 4, bottom: 0 }} barSize={20}>
                  <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis type="category" dataKey="name" width={115} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#475569" }} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={chartTooltipStyle} />
                  <Bar isAnimationActive={false} dataKey="value" name="Certificaciones aprobadas" fill="#2563eb" radius={[0, 5, 5, 0]}>
                    <LabelList dataKey="value" position="right" fill="#334155" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <span className="text-slate-500">Mayor volumen</span>
              <span className="font-medium text-slate-700">{issuers[0].name} · {issuers[0].value}</span>
            </div>
          </>
        ) : (
          <EmptyChartMessage />
        )}
      </section>

      <section className="surface-card min-w-0 p-5">
        <ChartHeading title="Habilidades acreditadas" description="Distribución de habilidades incluidas en las certificaciones." count={skills.length} />
        {skills.length > 0 && skillTotal > 0 ? (
          <>
            <div className="mt-4 grid min-h-[300px] grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(170px,0.9fr)_minmax(0,1.1fr)]">
              <div className="h-[280px] min-w-0" role="img" aria-label="Distribución de certificaciones por habilidad">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [value, name]} />
                    <Pie data={skills} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="#ffffff" strokeWidth={2}>
                      {skills.map((skill, index) => (
                        <Cell key={skill.name} fill={blueTones[index % blueTones.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 space-y-2" aria-label="Valores por habilidad">
                {skills.map((skill, index) => (
                  <li key={skill.name} className="flex min-w-0 items-center gap-2 text-xs">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: blueTones[index % blueTones.length] }} />
                    <span className="min-w-0 flex-1 truncate text-slate-600" title={skill.name}>{skill.name}</span>
                    <span className="font-medium tabular-nums text-slate-800">{skill.value}</span>
                    <span className="w-9 text-right tabular-nums text-slate-400">{Math.round((skill.value / skillTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <span className="text-slate-500">Mayor volumen</span>
              <span className="font-medium text-slate-700">{skills[0].name} · {skills[0].value}</span>
            </div>
          </>
        ) : (
          <EmptyChartMessage />
        )}
      </section>
    </div>
  );
}

function ChartHeading({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count: number;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <span className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-medium tabular-nums text-slate-700">{count}</span>
    </div>
  );
}

function EmptyChartMessage() {
  return <p className="py-12 text-center text-sm text-slate-500">Sin certificaciones aprobadas para estos filtros.</p>;
}
