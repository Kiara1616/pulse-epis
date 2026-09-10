"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import mockData from "@/shared/api/mock-data.json";

export const InteractiveProviderChart = () => {
  const COLORS = ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"];
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  // Handle clicking on a pie slice
  const onPieEnter = (_: unknown, index: number) => {
    setSelectedVendor(mockData.vendorMarketShare[index].name);
  };
  
  const onPieClick = (data: { name?: string }) => {
     if (!data.name) return;
     if (selectedVendor === data.name) {
       setSelectedVendor(null); // toggle off
     } else {
       setSelectedVendor(data.name);
     }
  };

  // Filter bar chart data
  const barData = selectedVendor 
    ? mockData.certificationLevels.filter(item => item.vendor === selectedVendor)
    : mockData.certificationLevels;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row gap-6 w-full">
      {/* Pie Chart Section */}
      <div className="flex-1">
        <h3 className="font-bold text-gray-900 mb-1">Certificadoras (Market Share)</h3>
        <p className="text-xs text-gray-500 mb-4">Haz clic en un segmento para ver los detalles.</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={mockData.vendorMarketShare}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
                onClick={onPieClick}
                onMouseEnter={onPieEnter}
                cursor="pointer"
              >
                {mockData.vendorMarketShare.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    opacity={selectedVendor && selectedVendor !== entry.name ? 0.4 : 1}
                    stroke="#ffffff"
                    strokeWidth={selectedVendor === entry.name ? 4 : 2}
                    className="transition-all duration-300 outline-none"
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="w-px bg-gray-100 hidden md:block"></div>

      {/* Bar Chart Section */}
      <div className="flex-1">
        <h3 className="font-bold text-gray-900 mb-1">
          {selectedVendor ? `Niveles de Certificación: ${selectedVendor}` : "Niveles por Certificadora"}
        </h3>
        <p className="text-xs text-gray-500 mb-4">Cantidad de certificados por complejidad.</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} maxBarSize={60}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="vendor" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="Associate" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
              <Bar dataKey="Fundamentals" stackId="a" fill="#10b981" />
              <Bar dataKey="Professional" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
