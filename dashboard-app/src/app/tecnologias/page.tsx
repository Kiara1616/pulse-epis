"use client";

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import mockData from "@/shared/api/mock-data.json";
import { ExportButton } from "@/shared/ui/ExportButton";

export default function TecnologiasPage() {
  const COLORS = ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"];

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Proveedores IT y Niveles</h2>
          <p className="text-gray-500 mt-1 font-medium">Market share de certificaciones y distribución por complejidad</p>
        </div>
        <ExportButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Market Share */}
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Participación por Vendor</h3>
          <p className="text-sm text-gray-500 font-medium mb-6">Proporción de certificaciones obtenidas según la empresa emisora.</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mockData.vendorMarketShare}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                  label
                >
                  {mockData.vendorMarketShare.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Certification Levels */}
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Niveles de Certificación</h3>
          <p className="text-sm text-gray-500 font-medium mb-6">Dificultad de los certificados obtenidos por proveedor.</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockData.certificationLevels}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="vendor" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Legend />
                <Bar dataKey="Fundamentals" stackId="a" fill="#93c5fd" />
                <Bar dataKey="Associate" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Professional" stackId="a" fill="#1d4ed8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
