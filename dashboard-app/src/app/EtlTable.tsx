"use client";

import etlData from "@/shared/api/etl_data.json";
import { Database, Clock, DownloadCloud } from "lucide-react";

export const EtlTable = () => {
  const lastUpdated = etlData.last_updated.replace("T", " ").slice(0, 16);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Database size={18} className="text-blue-500" />
            Registro de certificaciones procesadas
          </h3>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Clock size={12} /> Última sincronización: {lastUpdated}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-blue-50 text-blue-600 font-bold text-xs rounded-full border border-blue-100 flex items-center gap-1">
            <DownloadCloud size={14} /> Total Procesado: {etlData.total_records_processed}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50/80">
            <tr>
              <th className="px-6 py-3 font-semibold">Estudiante anonimizado</th>
              <th className="px-6 py-3 font-semibold">Año Ingreso</th>
              <th className="px-6 py-3 font-semibold">Certificadora</th>
              <th className="px-6 py-3 font-semibold">Nivel</th>
              <th className="px-6 py-3 font-semibold">Nombre del Certificado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {etlData.raw_transformed.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">
                  {`EPIS-${String(idx + 1).padStart(4, "0")}`}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                    {row.entry_year}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                    row.vendor === 'AWS' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                    row.vendor === 'Microsoft' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                    'bg-emerald-50 text-emerald-600 border-emerald-100'
                  }`}>
                    {row.vendor}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600 font-medium">{row.level}</td>
                <td className="px-6 py-4 text-gray-800">{row.badge}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {etlData.raw_transformed.length === 0 && (
         <div className="text-center py-8 text-gray-400 text-sm">No hay registros extraídos.</div>
      )}
    </div>
  );
};
