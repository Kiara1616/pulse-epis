"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import mockData from "@/shared/api/mock-data.json";
import { ExportButton } from "@/shared/ui/ExportButton";

export default function BrechasPage() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Brechas de Habilidades Laborales</h2>
          <p className="text-gray-500 mt-1">Comparativa entre certificaciones de la escuela y demandas del mercado local</p>
        </div>
        <ExportButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart for Skill Gaps */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Alineación de Habilidades (Alumnos vs Mercado)</h3>
          <p className="text-sm text-gray-500 mb-6">Muestra qué áreas están sobre-certificadas y en cuáles hay escasez de talento certificado frente a lo que piden las empresas en Tacna.</p>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={mockData.skillGaps}>
                <PolarGrid stroke="#374151" opacity={0.3} />
                <PolarAngleAxis dataKey="subject" stroke="#6b7280" />
                <PolarRadiusAxis angle={30} domain={[0, 150]} stroke="#9ca3af" />
                
                <Radar name="Alumnos Certificados" dataKey="students" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Radar name="Demanda del Mercado (Puestos)" dataKey="marketDemand" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
                
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
