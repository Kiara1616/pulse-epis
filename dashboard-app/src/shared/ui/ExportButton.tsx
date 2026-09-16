"use client";

import { Download } from "lucide-react";
import { useState } from "react";

type ExportValue = string | number | null | undefined;
type ExportRow = Record<string, ExportValue>;

function escapeCsv(value: ExportValue) {
  const normalized = value == null ? "" : String(value);
  return /[",\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

export const ExportButton = ({ filename, rows, metadata = [] }: { filename: string; rows: ExportRow[]; metadata?: string[] }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    try {
      const columns = rows.length ? Object.keys(rows[0]) : [];
      const csv = [
        ...metadata.map((line) => `# ${line}`),
        columns.map(escapeCsv).join(","),
        ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(",")),
      ].join("\n");
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}\n`], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || rows.length === 0}
      aria-busy={isExporting}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
    >
      <Download size={16} />
      {isExporting ? "Generando..." : "Exportar Reporte"}
    </button>
  );
};
