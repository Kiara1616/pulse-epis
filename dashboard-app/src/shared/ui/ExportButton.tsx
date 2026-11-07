"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { apiUrl } from "@/shared/api/client";
import type { AnalyticsOverview } from "@/shared/api/types";

type ExportValue = string | number | null | undefined;
type ExportRow = Record<string, ExportValue>;
type ExportFormat = "pdf" | "xlsx" | "csv";

function escapeCsv(value: ExportValue) {
  const text = value == null ? "" : String(value);
  const normalized = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return /[";,\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

export const ExportButton = ({
  filename,
  rows,
  metadata = [],
  filters,
  csvFilters,
  dataset = "registered",
}: {
  filename: string;
  rows: ExportRow[];
  metadata?: string[];
  filters?: AnalyticsOverview["filters"];
  csvFilters?: AnalyticsOverview["filters"];
  dataset?: "registered" | "demo";
}) => {
  const [format, setFormat] = useState<ExportFormat>(filters ? "xlsx" : "csv");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportReport(reportFormat: "pdf" | "xlsx") {
    setIsExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("dataset", dataset);
      Object.entries(filters ?? {}).forEach(([key, value]) => {
        if (value && key !== "level") params.set(key, value);
      });
      const response = await fetch(apiUrl(`/indicators/report.${reportFormat}?${params}`), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`No se pudo generar el archivo ${reportFormat.toUpperCase()}. Revisa tu sesión y los filtros.`);
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename.replace(/\.csv$/i, `.${reportFormat}`);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "No se pudo exportar el archivo.");
    } finally {
      setIsExporting(false);
    }
  }

  function exportCsv() {
    setIsExporting(true);
    setError(null);
    try {
      const columns = rows.length ? Object.keys(rows[0]) : [];
      const csv = [
        `# Fuente de datos: ${dataset === "demo" ? "Datos de referencia · no oficiales · indicadores agregados" : "Datos publicados"}`,
        ...metadata.map((line) => `# ${line}`),
        ...Object.entries(csvFilters ?? filters ?? {})
          .filter(([key]) => key !== "level")
          .map(([key, value]) => `# ${key}: ${value || "Todos"}`),
        columns.map(escapeCsv).join(";"),
        ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(";")),
      ].join("\r\n");
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}\n`], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setIsExporting(false);
    }
  }

  function exportSelectedFormat() {
    if (format === "csv") {
      exportCsv();
    } else if (filters) {
      void exportReport(format);
    }
  }

  const disabled = isExporting || (format === "csv" ? rows.length === 0 : !filters?.period_code);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {filters && <label className="flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
          <span className="sr-only">Formato de exportación</span>
          <select
            aria-label="Formato de exportación"
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
            disabled={isExporting}
            className="max-w-64 bg-transparent pr-5 outline-none disabled:opacity-60"
          >
            {filters && <option value="xlsx">Excel (.xlsx) · analizar datos</option>}
            {filters && <option value="pdf">PDF · compartir informe</option>}
            <option value="csv">CSV · evolución por fechas</option>
          </select>
        </label>}
        <button
          onClick={exportSelectedFormat}
          disabled={disabled}
          aria-busy={isExporting}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${filters ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
        >
          <Download aria-hidden="true" size={16} />
          {isExporting ? "Generando…" : filters ? "Descargar informe" : "Descargar CSV"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
};
