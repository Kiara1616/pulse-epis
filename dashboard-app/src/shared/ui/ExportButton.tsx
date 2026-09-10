"use client";

import { Download } from "lucide-react";
import { useState } from "react";

export const ExportButton = () => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    // Simulate export delay
    setTimeout(() => {
      setIsExporting(false);
      alert("Reporte PDF generado exitosamente.");
    }, 1500);
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
    >
      <Download size={16} />
      {isExporting ? "Generando..." : "Exportar Reporte"}
    </button>
  );
};
