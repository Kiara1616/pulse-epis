"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const metrics = [
  {
    key: "certifiedStudents",
    label: "Estudiantes certificados",
    color: "#1d4ed8",
  },
  {
    key: "approvedCertifications",
    label: "Certificaciones aprobadas",
    color: "#60a5fa",
  },
] as const;

export function CertificationsChart({
  data,
}: {
  data: {
    semester: string;
    certifiedStudents: number;
    approvedCertifications: number;
  }[];
}) {
  return (
    <div className="h-full min-h-0">
      <div className="mb-2 flex flex-wrap justify-end gap-2" aria-label="Métricas de evolución">
        {metrics.map((metric) => (
          <span
            key={metric.key}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: metric.color }}
            />
            {metric.label}
          </span>
        ))}
      </div>
      <div className="h-[calc(100%-2.25rem)] min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 18, left: -12, bottom: 4 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="semester"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickFormatter={(value: string) =>
                new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" })
                  .format(new Date(`${value}T00:00:00`))
                  .replace(".", "")
              }
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
            />
            <Tooltip
              cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4" }}
              contentStyle={{
                backgroundColor: "#102c52",
                border: "1px solid #1e40af",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgb(15 23 42 / 0.16)",
                color: "#fff",
                padding: "10px 12px",
              }}
              labelStyle={{ color: "#dbeafe", fontSize: 12, marginBottom: 4 }}
              itemStyle={{ color: "#fff", fontSize: 13 }}
              labelFormatter={(value) =>
                `Datos del ${new Intl.DateTimeFormat("es-PE", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                }).format(new Date(`${String(value)}T00:00:00`))}`
              }
              formatter={(value, name) => [value, name]}
            />
            {metrics.map((metric) => (
              <Line
                key={metric.key}
                isAnimationActive={false}
                type="monotone"
                dataKey={metric.key}
                name={metric.label}
                stroke={metric.color}
                strokeWidth={3}
                dot={{ r: 5, fill: metric.color, stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 7, fill: metric.color, stroke: "#fff", strokeWidth: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
