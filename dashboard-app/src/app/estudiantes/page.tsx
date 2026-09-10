"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import mockData from "@/shared/api/mock-data.json";
import { ExportButton } from "@/shared/ui/ExportButton";

export default function EstudiantesPage() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ranking y Alumnado</h2>
          <p className="text-gray-500 mt-1">Estudiantes top certificados y distribución por semestre</p>
        </div>
        <ExportButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Students Table */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Estudiantes</h3>
          <p className="text-sm text-gray-500 mb-6">Alumnos con mayor cantidad de insignias digitales.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3 rounded-tl-lg">Estudiante</th>
                  <th className="px-6 py-3">Semestre</th>
                  <th className="px-6 py-3">Total Certs.</th>
                  <th className="px-6 py-3 rounded-tr-lg">Vendor Principal</th>
                </tr>
              </thead>
              <tbody>
                {mockData.topStudents.map((student, idx) => (
                  <tr key={idx} className="bg-white border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4">{student.semester}</td>
                    <td className="px-6 py-4 text-emerald-600 font-bold">{student.certs}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {student.topVendor}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Certifications by Semester */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Año de Estudio</h3>
          <p className="text-sm text-gray-500 mb-6">Cantidad de certificaciones agrupadas por el ciclo del estudiante.</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockData.certificationsBySemester} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis dataKey="name" type="category" width={100} stroke="#9ca3af" />
                <Tooltip cursor={{ fill: '#374151', opacity: 0.1 }} />
                <Bar dataKey="certifications" name="Certificaciones" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
