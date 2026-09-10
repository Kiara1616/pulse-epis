"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface CertificationsChartProps {
  data: Array<{
    semester: string;
    certifications: number;
  }>;
}

export const CertificationsChart = ({ data }: CertificationsChartProps) => {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCerts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="semester" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
          <Tooltip />
          <Area type="monotone" dataKey="certifications" name="Certificaciones Obtenidas" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCerts)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
