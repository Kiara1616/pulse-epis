"use client";
import { useState, type FormEvent } from "react";
import { RoleGate } from "@/features/access/RoleGate";
import {
  demoCourses,
  labels,
  type CourseDemo,
} from "@/features/courseRadar/demo";
const field =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
function RadarDemo() {
  const [items, setItems] = useState(demoCourses);
  const [selected, setSelected] = useState<CourseDemo | null>(null);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState("");
  function change(id: string, status: CourseDemo["status"]) {
    setItems((old) =>
      old.map((i) =>
        i.id === id
          ? {
              ...i,
              status,
              history: [...i.history, `${labels[status]}: decisión simulada.`],
            }
          : i,
      ),
    );
    setSelected(null);
    setNotice("Cambio simulado; se perderá al recargar.");
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const d = new FormData(e.currentTarget);
    const publish =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "publish";
    const audience = String(d.get("audience"))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const relevance = String(d.get("relevance")).trim();
    if (publish && (!audience.length || relevance.length < 10)) {
      setNotice(
        "Define una audiencia y explica la relevancia (mínimo 10 caracteres).",
      );
      return;
    }
    setItems((old) =>
      old.map((i) =>
        i.id === selected.id
          ? {
              ...i,
              title: String(d.get("title")).trim(),
              requirements: String(d.get("requirements"))
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              audience,
              relevance,
              status: publish ? "PUBLISHED" : "IN_REVIEW",
              history: [
                ...i.history,
                publish
                  ? "Publicación simulada tras revisión de contenido y audiencia."
                  : "Corrección simulada del borrador.",
              ],
            }
          : i,
      ),
    );
    setSelected(null);
    setNotice(
      publish
        ? "Oportunidad publicada solo en la demostración."
        : "Corrección simulada guardada en memoria.",
    );
  }
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-blue-600">
          Prototipo administrativo
        </p>
        <h1 className="mt-1 text-3xl font-black text-slate-900">
          Radar de cursos
        </h1>
      </header>
      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        Demostración sintética. No guarda cambios, no publica a estudiantes y no
        realiza scraping. Las fuentes example.invalid son ejemplos sin oferta
        real.
      </div>
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900"
        >
          {notice}
        </p>
      )}
      <label className="block text-sm font-semibold">
        Filtrar estado
        <select
          aria-label="Filtrar estado"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={field}
        >
          <option value="">Todos</option>
          {Object.entries(labels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <form
          key={selected.id}
          onSubmit={save}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="font-bold">Revisar curso</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              Título
              <input
                name="title"
                aria-label="Título"
                required
                minLength={3}
                defaultValue={selected.title}
                className={field}
              />
            </label>
            <label>
              Requisitos
              <textarea
                name="requirements"
                aria-label="Requisitos"
                required
                defaultValue={selected.requirements.join(", ")}
                className={field}
              />
            </label>
            <label>
              Audiencia
              <input
                name="audience"
                aria-label="Audiencia"
                defaultValue={selected.audience.join(", ")}
                placeholder="Ciclo V, interés en IA"
                className={field}
              />
            </label>
            <label>
              Explicación de relevancia
              <textarea
                name="relevance"
                aria-label="Explicación de relevancia"
                defaultValue={selected.relevance}
                maxLength={1000}
                className={field}
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              value="save"
              className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700"
            >
              Guardar corrección
            </button>
            <button
              value="publish"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"
            >
              Publicar oportunidad
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-sm font-semibold text-slate-500"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <section className="grid gap-4 lg:grid-cols-2">
        {items
          .filter((i) => !filter || i.status === filter)
          .map((i) => (
            <article
              key={i.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="font-bold">{i.title}</h2>
              <span className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {labels[i.status]}
              </span>
              <p className="mt-2 text-sm text-slate-500">
                {i.provider} · Consulta {i.checkedOn}
              </p>
              <p className="mt-3 break-all text-xs text-slate-500">
                Fuente de ejemplo: {i.sourceUrl}
              </p>
              <p className="mt-3 text-sm">
                Requisitos: {i.requirements.join(", ")}
              </p>
              {i.status === "PUBLISHED" && (
                <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm">
                  <p>Audiencia: {i.audience.join(", ")}</p>
                  <p className="mt-2">{i.relevance}</p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                {i.status === "DETECTED" && (
                  <button
                    onClick={() => {
                      change(i.id, "IN_REVIEW");
                      setSelected({ ...i, status: "IN_REVIEW" });
                    }}
                    className="text-sm font-bold text-blue-600"
                  >
                    Iniciar revisión
                  </button>
                )}
                {i.status === "IN_REVIEW" && (
                  <button
                    onClick={() => setSelected(i)}
                    className="text-sm font-bold text-blue-600"
                  >
                    Revisar y corregir
                  </button>
                )}
                {["DETECTED", "IN_REVIEW"].includes(i.status) && (
                  <button
                    onClick={() => change(i.id, "DISCARDED")}
                    className="text-sm font-semibold text-rose-600"
                  >
                    Descartar
                  </button>
                )}
                {i.status === "PUBLISHED" && (
                  <button
                    onClick={() => change(i.id, "RETIRED")}
                    className="text-sm font-semibold text-slate-500"
                  >
                    Retirar
                  </button>
                )}
              </div>
              <details className="mt-4 text-xs text-slate-500">
                <summary>Historial de la simulación</summary>
                {i.history.map((h, n) => (
                  <p className="mt-2" key={n}>
                    {h}
                  </p>
                ))}
              </details>
            </article>
          ))}
      </section>
      {items.filter((i) => !filter || i.status === filter).length === 0 && (
        <p
          role="status"
          className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500"
        >
          No hay cursos en este estado.
        </p>
      )}
    </div>
  );
}
export default function RadarPage() {
  return (
    <RoleGate allow={["ADMIN"]}>
      <RadarDemo />
    </RoleGate>
  );
}
