"use client";
export function AnalyticsSource({dataset, available, onChange}: {dataset: "registered" | "demo"; available: boolean; onChange: (value: "registered" | "demo") => void}) {
  if (!available) return null;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
    <div><p className="text-sm font-semibold text-slate-800">{dataset === "demo" ? "Datos de referencia · no oficiales" : "Datos publicados"}</p><p className="mt-1 max-w-3xl text-xs text-slate-500">{dataset === "demo" ? "Indicadores agregados para visualizar las gráficas. Los estudiantes, credenciales y eventos no corresponden a registros institucionales publicados." : "Último corte institucional publicado."}</p></div>
    <label className="text-xs font-medium text-slate-600">Fuente de datos<select value={dataset} onChange={(e) => onChange(e.target.value as "registered" | "demo")} className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="demo">Datos de referencia · no oficiales</option><option value="registered">Datos publicados</option></select></label>
  </div>;
}
