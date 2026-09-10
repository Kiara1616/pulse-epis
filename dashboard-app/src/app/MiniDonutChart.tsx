"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface MiniDonutChartProps {
  value: number;
  color: string;
}

export const MiniDonutChart = ({ value, color }: MiniDonutChartProps) => {
  const data = [
    { name: "Value", value: value },
    { name: "Empty", value: 100 - value },
  ];

  return (
    <div className="w-16 h-16 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={20}
            outerRadius={28}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="rgba(156, 163, 175, 0.1)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
