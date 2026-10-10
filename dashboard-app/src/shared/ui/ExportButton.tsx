"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { apiUrl } from "@/shared/api/client";
import type { AnalyticsOverview } from "@/shared/api/types";

type ExportValue = string | number | null | undefined;
type ExportRow = Record<string, ExportValue>;

function escapeCsv(value: ExportValue) {
  const text = value == null ? "" : String(value);
  const normalized = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return /[";,\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

export const ExportButton = ({ filename, rows, metadata = [], filters, dataset = "registered" }: { filename: string; rows: ExportRow[]; metadata?: string[]; filters?: AnalyticsOverview["filters"]; dataset?: "registered" | "demo" }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function exportFile(format: "pdf" | "xlsx") {
    setIsExporting(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.set("dataset", dataset);
      Object.entries(filters ?? {}).forEach(([key, value]) => { if (value && key !== "level") params.set(key, value); });
      const response = await fetch(apiUrl(`/indicators/report.${format}?${params}`), { credentials: "include" });
      if (!response.ok) throw new Error("No se pudo generar el PDF. Revisa tu sesión y los filtros.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = filename.replace(/\.csv$/, `.${format}`); link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo exportar."); }
    finally { setIsExporting(false); }
  }

  const handleExport = () => {
    setIsExporting(true);
    try {
      const columns = rows.length ? Object.keys(rows[0]) : [];
      const csv = [
        `# Fuente de datos: ${dataset === "demo" ? "DEMOSTRACIÓN LOCAL - datos sintéticos" : "Datos registrados"}`,
        ...metadata.map((line) => `# ${line}`),
        ...Object.entries(filters ?? {}).filter(([key]) => key !== "level").map(([key, value]) => `# ${key}: ${value || "Todos"}`),
        columns.map(escapeCsv).join(";"),
        ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(";")),
      ].join("\r\n");
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
    <div><div className="flex flex-wrap gap-2"><button
      onClick={() => filters ? void exportFile("xlsx") : handleExport()}
      disabled={isExporting || (!filters && rows.length === 0)}
      aria-busy={isExporting}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
    >
      <Download size={16} />
      {isExporting ? "Generando..." : "Exportar Excel"}
    </button>
    {filters && <button onClick={() => void exportFile("pdf")} disabled={isExporting || !filters.period_code} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Exportar PDF</button>}
    {filters && <button onClick={handleExport} disabled={isExporting || !rows.length} className="px-2 py-2 text-xs font-medium text-slate-500 disabled:opacity-40">CSV</button>}
    </div>{error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}</div>
  );
};
