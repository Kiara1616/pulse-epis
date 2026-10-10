"use client";
export function AnalyticsSource({dataset, local, onChange}: {dataset: "registered" | "demo"; local: boolean; onChange: (value: "registered" | "demo") => void}) {
  if (!local) return null;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
    <div><p className="text-sm font-semibold text-slate-800">{dataset === "demo" ? "Datos de demostración" : "Datos registrados"}</p><p className="mt-1 text-xs text-slate-500">{dataset === "demo" ? "Datos sintéticos; separados del padrón real." : "Último corte publicado del sistema."}</p></div>
    <label className="text-xs font-medium text-slate-600">Fuente de datos<select value={dataset} onChange={(e) => onChange(e.target.value as "registered" | "demo")} className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="demo">Demostración local</option><option value="registered">Datos registrados</option></select></label>
  </div>;
}
