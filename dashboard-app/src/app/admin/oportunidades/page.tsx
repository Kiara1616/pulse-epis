"use client";
import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Plus, Search, ExternalLink, RefreshCw } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { apiFetch } from "@/shared/api/client";

type Opportunity = {
  id: string;
  title: string;
  provider: string;
  source_url: string;
  area: string;
  level: string;
  skills: string[];
  prerequisites: string;
  rationale: string;
  cost_pen: number | null;
  checked_on: string;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  history: { status: string; reason: string; at: string }[];
};
const states = {
  DRAFT: "Por revisar",
  PUBLISHED: "Publicada",
  RETIRED: "Retirada",
};
const areas = ["IA", "Datos", "Desarrollo", "Redes", "Nube", "Otros"];
const field =
  "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-blue-600";
const panel = "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm";
const button =
  "rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 hover:bg-blue-700";

function Radar() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [decision, setDecision] = useState<{
    item: Opportunity;
    status: "PUBLISHED" | "RETIRED";
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [targets, setTargets] = useState("");
  const [budget, setBudget] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await apiFetch<Opportunity[]>("/opportunities"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el radar.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<Opportunity[]>("/opportunities", { signal: controller.signal })
      .then(setItems)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el radar.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const item = await apiFetch<Opportunity>("/opportunities", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          skills: String(payload.skills)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          cost_pen: payload.cost_pen === "" ? null : Number(payload.cost_pen),
        }),
      });
      setItems((old) => [...old, item]);
      setShowForm(false);
      setNotice("Fuente registrada. Revisa su contenido antes de publicarla.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar.");
    } finally {
      setBusy(false);
    }
  }
  async function decide(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!decision) return;
    const reason = new FormData(e.currentTarget).get("reason");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiFetch<Opportunity>(
        `/opportunities/${decision.item.id}/decision`,
        {
          method: "POST",
          body: JSON.stringify({ status: decision.status, reason }),
        },
      );
      setItems((old) => old.map((i) => (i.id === updated.id ? updated : i)));
      setDecision(null);
      setNotice("Decisión guardada en el historial.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter(
    (i) =>
      (!area || i.area === area) &&
      (!status || i.status === status) &&
      `${i.title} ${i.provider} ${i.skills.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const chosen = items.filter(
    (i) => selected.includes(i.id) && i.status === "PUBLISHED",
  );
  const requested = [
    ...new Set(
      targets
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const covered = new Set(chosen.flatMap((i) => i.skills));
  const missing = requested.filter((s) => !covered.has(s));
  const knownCost = chosen.reduce((sum, i) => sum + (i.cost_pen ?? 0), 0);
  const unknownCosts = chosen.filter((i) => i.cost_pen === null).length;
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-blue-600">
            Planificación formativa
          </p>
          <h1 className="mt-1 text-3xl font-black text-gray-900">
            Radar de oportunidades
          </h1>
          <p className="mt-2 text-gray-500">
            Revisa fuentes y compara formación para las rutas profesionales de
            EPIS.
          </p>
        </div>
        <button className={button} onClick={() => setShowForm(!showForm)}>
          <Plus size={16} className="mr-2 inline" />
          {showForm ? "Cerrar registro" : "Registrar fuente"}
        </button>
      </header>
      <section className="grid gap-4 sm:grid-cols-3">
        {(["DRAFT", "PUBLISHED", "RETIRED"] as const).map((s) => (
          <div key={s} className={panel}>
            <p className="text-sm text-gray-500">{states[s]}</p>
            <p className="mt-2 text-3xl font-black text-blue-950">
              {items.filter((i) => i.status === s).length}
            </p>
          </div>
        ))}
      </section>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        Fuentes registradas manualmente y revisadas por la escuela. La
        recolección automática aún no está activada. Las competencias describen
        contenidos formativos; no acreditan dominio del estudiante.
      </div>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}
          <button className="ml-3 underline" onClick={() => void load()}>
            Reintentar carga
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">
          {notice}
        </p>
      )}
      {showForm && (
        <form onSubmit={create} className={panel}>
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            Registrar oportunidad
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold">
              Título
              <input
                name="title"
                required
                minLength={3}
                maxLength={200}
                className={field}
              />
            </label>
            <label className="text-sm font-semibold">
              Proveedor
              <input
                name="provider"
                required
                minLength={2}
                maxLength={120}
                className={field}
              />
            </label>
            <label className="text-sm font-semibold">
              Fuente HTTPS
              <input
                name="source_url"
                type="url"
                pattern="https://.*"
                required
                maxLength={2048}
                className={field}
              />
            </label>
            <label className="text-sm font-semibold">
              Fecha de consulta
              <input name="checked_on" type="date" required className={field} />
            </label>
            <label className="text-sm font-semibold">
              Área
              <select name="area" className={field}>
                {areas.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Nivel
              <select name="level" className={field}>
                {["Inicial", "Intermedio", "Avanzado"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Competencias separadas por coma
              <input
                name="skills"
                required
                placeholder="python, evaluación de modelos"
                className={field}
              />
            </label>
            <label className="text-sm font-semibold">
              Costo estimado por participante (S/)
              <input
                name="cost_pen"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                placeholder="Vacío si no se conoce"
                className={field}
              />
            </label>
            <label className="text-sm font-semibold">
              Requisitos
              <textarea
                name="prerequisites"
                required
                maxLength={1000}
                placeholder="Describe los requisitos o indica que no están informados"
                className={field}
              />
            </label>
            <label className="text-sm font-semibold">
              Justificación de relevancia
              <textarea
                name="rationale"
                required
                minLength={10}
                maxLength={1000}
                className={field}
              />
            </label>
          </div>
          <button disabled={busy} className={`${button} mt-4`}>
            {busy ? "Guardando…" : "Guardar borrador"}
          </button>
        </form>
      )}
      {decision && (
        <form onSubmit={decide} className={panel}>
          <h2 className="font-bold">
            {decision.status === "PUBLISHED" ? "Publicar" : "Retirar"}:{" "}
            {decision.item.title}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Confirma el contenido y los requisitos en la fuente antes de
            publicar. El motivo queda registrado.
          </p>
          <label className="mt-4 block text-sm font-semibold">
            Motivo de la decisión
            <textarea
              name="reason"
              required
              minLength={10}
              maxLength={1000}
              className={field}
            />
          </label>
          <div className="mt-4 flex gap-3">
            <button disabled={busy} className={button}>
              Confirmar decisión
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDecision(null)}
              className="text-sm font-bold text-gray-600"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <section className={panel}>
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="mr-auto text-lg font-bold text-gray-900">
            <BookOpen className="mr-2 inline text-blue-600" size={20} />
            Catálogo de formación
          </h2>
          <button
            aria-label="Actualizar catálogo"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="my-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            Buscar
            <Search size={14} className="ml-1 inline" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={field}
              placeholder="Título, proveedor o competencia"
            />
          </label>
          <label className="text-sm">
            Filtrar área
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={field}
            >
              <option value="">Todas</option>
              {areas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Filtrar estado
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={field}
            >
              <option value="">Todos</option>
              {Object.entries(states).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <p role="status">Cargando oportunidades…</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No hay oportunidades para estos filtros. Registra una fuente para
            comenzar.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {visible.map((i) => (
              <article
                key={i.id}
                className="rounded-2xl border border-gray-100 p-5"
              >
                <div className="flex justify-between gap-3">
                  <h3 className="font-bold text-gray-900">{i.title}</h3>
                  <span className="h-fit whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                    {states[i.status]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {i.provider} · {i.area} · {i.level}
                </p>
                <p className="mt-3 text-sm text-gray-700">{i.rationale}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {i.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-lg bg-gray-100 px-2 py-1 text-xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  Requisitos: {i.prerequisites}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Consulta: {i.checked_on} ·{" "}
                  {i.cost_pen === null
                    ? "Costo desconocido"
                    : `S/ ${i.cost_pen.toFixed(2)} por participante`}
                </p>
                <a
                  href={i.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-blue-600"
                >
                  Consultar fuente
                  <ExternalLink size={14} />
                </a>
                <div className="mt-4 flex flex-wrap gap-3">
                  {i.status === "DRAFT" && (
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() =>
                        setDecision({ item: i, status: "PUBLISHED" })
                      }
                    >
                      Revisar y publicar
                    </button>
                  )}
                  {i.status !== "RETIRED" && (
                    <button
                      disabled={busy}
                      className="text-sm font-semibold text-gray-600"
                      onClick={() =>
                        setDecision({ item: i, status: "RETIRED" })
                      }
                    >
                      Retirar
                    </button>
                  )}
                  {i.status === "PUBLISHED" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.includes(i.id)}
                        onChange={(e) =>
                          setSelected((old) =>
                            e.target.checked
                              ? [...old, i.id]
                              : old.filter((id) => id !== i.id),
                          )
                        }
                      />
                      Comparar
                    </label>
                  )}
                </div>
                <details className="mt-4 text-xs text-gray-500">
                  <summary className="cursor-pointer">
                    Historial de revisión
                  </summary>
                  {i.history.map((h, n) => (
                    <p key={n} className="mt-2">
                      {states[h.status as keyof typeof states]} ·{" "}
                      {new Date(h.at).toLocaleString("es-PE")} · {h.reason}
                    </p>
                  ))}
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className={panel}>
        <h2 className="text-lg font-bold text-gray-900">
          Comparar alternativas
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Selecciona oportunidades publicadas y escribe competencias usando los
          mismos nombres del catálogo. Comparación por participante; no estima
          empleabilidad ni estudiantes elegibles.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">
            Competencias objetivo
            <input
              value={targets}
              onChange={(e) => setTargets(e.target.value)}
              placeholder="python, evaluación de modelos"
              className={field}
            />
          </label>
          <label className="text-sm font-semibold">
            Presupuesto por participante (S/)
            <input
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className={field}
            />
          </label>
        </div>
        <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-950">
          <p>
            {chosen.length} oportunidades seleccionadas · {covered.size}{" "}
            competencias distintas
          </p>
          <p className="mt-2">
            Costo conocido: S/ {knownCost.toFixed(2)}
            {unknownCosts > 0 &&
              ` · ${unknownCosts} con costo desconocido; total incompleto`}
          </p>
          {requested.length > 0 && (
            <p className="mt-2">
              Cobertura de objetivos: {requested.length - missing.length}/
              {requested.length}.{" "}
              {missing.length
                ? `Sin cubrir: ${missing.join(", ")}`
                : "Todos los temas objetivo están incluidos."}
            </p>
          )}
          {budget !== "" && (
            <p className="mt-2">
              {knownCost > Number(budget)
                ? "El costo conocido supera el presupuesto."
                : unknownCosts
                  ? "No se puede confirmar el presupuesto con costos desconocidos."
                  : "El costo estimado está dentro del presupuesto."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
export default function OpportunitiesPage() {
  return (
    <RoleGate allow={["ADMIN"]}>
      <Radar />
    </RoleGate>
  );
}
