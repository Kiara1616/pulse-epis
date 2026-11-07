"use client";

export function AnalyticsSource({
  dataset,
  available,
  onChange,
}: {
  dataset: "registered" | "demo";
  available: boolean;
  onChange: (value: "registered" | "demo") => void;
}) {
  if (!available) return null;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <p className="max-w-3xl text-sm text-slate-600">
        {dataset === "demo"
          ? "Datos de demostración: los estudiantes y las certificaciones son ejemplos, no registros institucionales."
          : "Consulta los registros institucionales publicados."}
      </p>
      <label className="text-xs font-semibold text-slate-600">
        Fuente de datos
        <select
          value={dataset}
          onChange={(event) => onChange(event.target.value as "registered" | "demo")}
          className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          <option value="demo">Demostración</option>
          <option value="registered">Publicados</option>
        </select>
      </label>
    </div>
  );
}
