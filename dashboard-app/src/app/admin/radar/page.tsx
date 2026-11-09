"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, ChevronDown, ExternalLink, Info, Plus, RefreshCw, X } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import {
  getLearningErrorMessage,
  learningApi,
  splitList,
  type CatalogSourceInput,
  type LearningCatalogSource,
  type CourseInput,
  type LearningCourse,
  type LearningInterest,
  type LearningOffer,
} from "@/shared/api/learning";

const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

const courseLabels: Record<LearningCourse["status"], string> = {
  DETECTED: "Por revisar",
  IN_REVIEW: "En revisión",
  PUBLISHED: "Publicado",
  DISCARDED: "Descartado",
  RETIRED: "Retirado",
};

const offerLabels: Record<LearningOffer["status"], string> = {
  DRAFT: "Borrador de oportunidad",
  PUBLISHED: "Oportunidad publicada",
  RETIRED: "Oportunidad retirada",
};

const cycles = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

type RadarData = {
  courses: LearningCourse[];
  offers: LearningOffer[];
  interests: LearningInterest[];
  sources: LearningCatalogSource[];
};

function RadarAdmin() {
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const [expandedProvider, setExpandedProvider] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [working, setWorking] = useState(false);

  const fetchCatalog = useCallback(async (): Promise<RadarData> => {
    const [courses, offers, interests, sources] = await Promise.all([
      learningApi.courses(),
      learningApi.offers(),
      learningApi.interests(),
      learningApi.sources(),
    ]);
    return { courses, offers, interests, sources };
  }, []);

  useEffect(() => {
    let current = true;
    fetchCatalog()
      .then((nextData) => {
        if (current) setData(nextData);
      })
      .catch((cause: unknown) => {
        if (current) setError(getLearningErrorMessage(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [fetchCatalog]);

  async function reloadCatalog() {
    setLoading(true);
    setError("");
    try {
      setData(await fetchCatalog());
    } catch (cause) {
      setError(getLearningErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  const selectedCourse = data?.courses.find((course) => course.id === selectedCourseId);
  const selectedOffer = data?.offers.find((offer) => offer.course_id === selectedCourseId);
  const visibleCourses = useMemo(
    () => data?.courses.filter((course) => !filter || course.status === filter) ?? [],
    [data, filter],
  );
  const providerGroups = useMemo(() => {
    const groups = new Map<string, LearningCourse[]>();
    for (const course of visibleCourses) {
      const provider = course.provider.trim() || "Proveedor sin identificar";
      groups.set(provider, [...(groups.get(provider) ?? []), course]);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "es"));
  }, [visibleCourses]);

  async function runAction(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await action();
      setData(await fetchCatalog());
      setNotice(success);
      return true;
    } catch (cause) {
      setError(getLearningErrorMessage(cause));
      // A multi-step operation can persist its draft before a later transition fails.
      try {
        setData(await fetchCatalog());
      } catch {
        // Keep the action error visible when the follow-up refresh also fails.
      }
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function registerCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input: CourseInput = {
      title: String(form.get("title")).trim(),
      provider: String(form.get("provider")).trim(),
      source_url: String(form.get("source_url")).trim(),
      checked_on: String(form.get("checked_on")),
      requirements: splitList(String(form.get("requirements"))),
      skills: splitList(String(form.get("skills"))),
    };
    const saved = await runAction(
      () => learningApi.createCourse(input),
      "Fuente registrada. Ya puedes iniciar su revisión.",
    );
    if (saved) formElement.reset();
  }

  async function registerSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input: CatalogSourceInput = {
      provider: String(form.get("provider")).trim(),
      feed_url: String(form.get("feed_url")).trim(),
      format: String(form.get("format")) as "JSON" | "RSS",
      default_skills: splitList(String(form.get("default_skills"))),
      default_requirements: splitList(String(form.get("default_requirements"))),
    };
    const saved = await runAction(() => learningApi.createSource(input), "Fuente automática registrada. Sincronízala para detectar cursos.");
    if (saved) formElement.reset();
  }

  async function saveCourseReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourse) return;
    const form = new FormData(event.currentTarget);
    const input: CourseInput = {
      title: String(form.get("title")).trim(),
      provider: String(form.get("provider")).trim(),
      source_url: String(form.get("source_url")).trim(),
      checked_on: String(form.get("checked_on")),
      requirements: splitList(String(form.get("requirements"))),
      skills: splitList(String(form.get("skills"))),
    };
    await runAction(
      () => learningApi.updateCourse(selectedCourse.id, input),
      "Correcciones del curso guardadas.",
    );
  }

  async function saveOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourse) return;
    const form = new FormData(event.currentTarget);
    const input = {
      course_id: selectedCourse.id,
      title: String(form.get("offer_title")).trim(),
      cycles: form.getAll("cycles").map(String),
      interest_ids: form.getAll("interest_ids").map(String),
      relevance: String(form.get("relevance")).trim(),
    };
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const publish = submitter?.value === "publish";
    await runAction(async () => {
      const offer = selectedOffer
        ? await learningApi.updateOffer(selectedOffer.id, input)
        : await learningApi.createOffer(input);
      if (publish) {
        await learningApi.setStatus<LearningOffer>(
          "offers",
          offer.id,
          "PUBLISHED",
          "Oportunidad revisada y aprobada para estudiantes.",
        );
      }
    }, publish ? "Oportunidad publicada y disponible para estudiantes." : "Borrador de oportunidad guardado.");
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-blue-600">
          Gestión administrativa
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Radar de cursos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Registra fuentes, revisa su contenido y publica oportunidades en el catálogo de estudiantes.
        </p>
      </header>

      <div role="note" className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" />
        <p>Agrega un feed público autorizado o registra una fuente manual. Pulse detecta candidatos, pero cada oportunidad se revisa antes de mostrarse a los estudiantes.</p>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-bold text-slate-950"><Plus size={18} aria-hidden="true" className="text-blue-700" /> Conectar feed de cursos</summary>
        <form onSubmit={registerSource} className="grid gap-4 border-t border-slate-100 p-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">Proveedor<input name="provider" required className={field} placeholder="Cisco, Grafana…" /></label>
          <label className="text-sm font-semibold text-slate-800">Formato<select name="format" defaultValue="JSON" className={field}><option value="JSON">JSON</option><option value="RSS">RSS</option></select></label>
          <label className="text-sm font-semibold text-slate-800 md:col-span-2">URL del feed autorizado<input name="feed_url" type="url" pattern="https://.*" required className={field} placeholder="https://proveedor.example/catalog.json" /></label>
          <label className="text-sm font-semibold text-slate-800">Habilidades por defecto<input name="default_skills" className={field} placeholder="Python, Datos" /></label>
          <label className="text-sm font-semibold text-slate-800">Requisitos por defecto<input name="default_requirements" className={field} placeholder="Programación básica" /></label>
          <div className="md:col-span-2"><button disabled={working} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">Guardar feed</button></div>
        </form>
      </details>

      {data && data.sources.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-950">Fuentes conectadas</h2><div className="mt-4 space-y-3">{data.sources.map((source) => <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-semibold text-slate-900">{source.provider} · {source.format}</p><p className="text-xs text-slate-600">{source.last_sync_summary ?? "Aún no sincronizada"}</p></div><button type="button" disabled={working} onClick={() => void runAction(() => learningApi.syncSource(source.id), `Sincronización completada: ${source.provider}.`)} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50">Sincronizar</button></div>)}</div></section>}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p>{error}</p>
          <button type="button" onClick={() => void reloadCatalog()} className="mt-2 font-bold underline underline-offset-2">
            Reintentar
          </button>
        </div>
      )}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-bold text-slate-950">
          <Plus size={18} aria-hidden="true" className="text-blue-700" /> Registrar fuente de curso
        </summary>
        <form onSubmit={registerCourse} className="grid gap-4 border-t border-slate-100 p-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">
            Nombre del curso
            <input name="title" required minLength={1} maxLength={200} className={field} />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Proveedor
            <input name="provider" required minLength={1} maxLength={150} className={field} />
          </label>
          <label className="text-sm font-semibold text-slate-800 md:col-span-2">
            Fuente HTTPS
            <input name="source_url" type="url" pattern="https://.*" required className={field} placeholder="https://…" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Fecha de consulta
            <input name="checked_on" type="date" required max={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} className={field} />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Habilidades (separadas por coma)
            <input name="skills" required placeholder="Análisis de datos, Python" className={field} />
          </label>
          <label className="text-sm font-semibold text-slate-800 md:col-span-2">
            Requisitos previos (separados por coma)
            <input name="requirements" placeholder="Fundamentos de programación" className={field} />
          </label>
          <div className="md:col-span-2">
            <button disabled={working} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
              {working ? "Guardando…" : "Registrar para revisión"}
            </button>
          </div>
        </form>
      </details>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block max-w-xs text-sm font-semibold text-slate-800">
          Filtrar estado
          <select aria-label="Filtrar estado" value={filter} onChange={(event) => setFilter(event.target.value)} className={field}>
            <option value="">Todos</option>
            {Object.entries(courseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" disabled={loading} onClick={() => void reloadCatalog()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} aria-hidden="true" /> Actualizar
        </button>
      </div>

      {loading ? (
        <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Cargando cursos y oportunidades…</p>
      ) : data ? (
        <>
          {selectedCourse && selectedCourse.status === "IN_REVIEW" && (
            <section className="space-y-6 rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Revisión de contenido</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">{selectedCourse.title}</h2>
                </div>
                <button type="button" aria-label="Cerrar revisión" onClick={() => setSelectedCourseId("")} className="rounded-lg p-2 text-slate-500 hover:bg-white">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={saveCourseReview} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                <h3 className="font-bold text-slate-900 md:col-span-2">Datos del curso</h3>
                <label className="text-sm font-semibold text-slate-800">
                  Título
                  <input name="title" required minLength={1} defaultValue={selectedCourse.title} className={field} />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Proveedor
                  <input name="provider" required defaultValue={selectedCourse.provider} className={field} />
                </label>
                <label className="text-sm font-semibold text-slate-800 md:col-span-2">
                  Fuente HTTPS
                  <input name="source_url" type="url" pattern="https://.*" required defaultValue={selectedCourse.source_url} className={field} />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Fecha de consulta
                  <input name="checked_on" type="date" required max={new Date().toISOString().slice(0, 10)} defaultValue={selectedCourse.checked_on} className={field} />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Habilidades (separadas por coma)
                  <input name="skills" required defaultValue={selectedCourse.skills.join(", ")} className={field} />
                </label>
                <label className="text-sm font-semibold text-slate-800 md:col-span-2">
                  Requisitos previos (separados por coma)
                  <input name="requirements" defaultValue={selectedCourse.requirements.join(", ")} className={field} />
                </label>
                <button disabled={working} className="w-fit rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50">
                  Guardar correcciones
                </button>
              </form>

              {selectedOffer?.status === "PUBLISHED" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  Esta oportunidad ya está publicada. Puedes retirarla desde su tarjeta.
                </div>
              ) : selectedOffer?.status === "RETIRED" ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  La oportunidad asociada fue retirada y no puede volver a publicarse.
                </div>
              ) : (
                <form onSubmit={saveOpportunity} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <h3 className="font-bold text-slate-900">Oportunidad para estudiantes</h3>
                    <p className="mt-1 text-sm text-slate-600">Define a quién está dirigida y por qué es relevante. Solo los estudiantes que cumplan la audiencia podrán verla.</p>
                  </div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Título de la oportunidad
                    <input name="offer_title" required minLength={1} maxLength={200} defaultValue={selectedOffer?.title ?? selectedCourse.title} className={field} />
                  </label>
                  <fieldset>
                    <legend className="text-sm font-semibold text-slate-800">Ciclos objetivo</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cycles.map((cycle) => (
                        <label key={cycle} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <input type="checkbox" name="cycles" value={cycle} defaultChecked={selectedOffer?.cycles.includes(cycle)} />
                          Ciclo {cycle}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-sm font-semibold text-slate-800">Áreas de interés objetivo</legend>
                    {data.interests.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {data.interests.map((interest) => (
                          <label key={interest.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                            <input type="checkbox" name="interest_ids" value={interest.id} defaultChecked={selectedOffer?.interest_ids.includes(interest.id)} />
                            {interest.name}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">No hay áreas activas; selecciona al menos un ciclo.</p>
                    )}
                  </fieldset>
                  <label className="block text-sm font-semibold text-slate-800">
                    Explicación de relevancia
                    <textarea name="relevance" required minLength={10} maxLength={2000} rows={4} defaultValue={selectedOffer?.relevance ?? ""} className={field} />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button name="intent" value="draft" disabled={working} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50">
                      Guardar borrador
                    </button>
                    <button name="intent" value="publish" disabled={working} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
                      {working ? "Publicando…" : "Guardar y publicar"}
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}

          <section aria-label="Cursos por proveedor" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Proveedores de formación</h2>
              <p className="mt-1 text-sm text-slate-600">Selecciona una entidad para consultar y gestionar sus cursos detectados.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {providerGroups.map(([provider, courses]) => {
                const isExpanded = expandedProvider === provider;
                const published = courses.filter((course) => course.status === "PUBLISHED").length;
                return (
                  <button
                    key={provider}
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`provider-${provider.replace(/[^a-zA-Z0-9]/g, "-")}`}
                    onClick={() => setExpandedProvider(isExpanded ? "" : provider)}
                    className={`flex items-center gap-4 rounded-2xl border p-5 text-left shadow-sm transition ${isExpanded ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"}`}
                  >
                    <span className="rounded-xl bg-blue-100 p-3 text-blue-700"><Building2 size={22} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-950">{provider}</span>
                      <span className="mt-1 block text-sm text-slate-600">{courses.length} {courses.length === 1 ? "curso" : "cursos"} · {published} publicados</span>
                    </span>
                    <ChevronDown size={19} aria-hidden="true" className={`shrink-0 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                );
              })}
            </div>
            {providerGroups.map(([provider, courses]) => expandedProvider === provider && (
              <div key={provider} id={`provider-${provider.replace(/[^a-zA-Z0-9]/g, "-")}`} className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Cursos de {provider}</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">{courses.length} oportunidades encontradas</h3>
                  </div>
                  <button type="button" onClick={() => setExpandedProvider("")} className="rounded-lg p-2 text-slate-500 hover:bg-white" aria-label={`Ocultar cursos de ${provider}`}><X size={18} aria-hidden="true" /></button>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {courses.map((course) => {
                    const offer = data.offers.find((item) => item.course_id === course.id);
                    return (
                      <article key={course.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="font-bold text-slate-950">{course.title}</h2>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{courseLabels[course.status]}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{course.provider} · Consultado {course.checked_on}</p>
                  <a href={course.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 break-all text-xs text-blue-700 underline underline-offset-2">
                    Abrir fuente <ExternalLink size={13} aria-hidden="true" />
                  </a>
                  {course.requirements.length > 0 && <p className="mt-3 text-sm text-slate-700">Requisitos: {course.requirements.join(", ")}</p>}
                  <p className="mt-2 text-sm text-slate-700">Habilidades: {course.skills.join(", ")}</p>
                  {offer && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{offerLabels[offer.status]}: <strong>{offer.title}</strong></p>}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {course.status === "DETECTED" && (
                      <button type="button" disabled={working} onClick={() => void runAction(
                        () => learningApi.setStatus<LearningCourse>("courses", course.id, "IN_REVIEW", "Revisión administrativa iniciada."),
                        "Curso enviado a revisión.",
                      ).then(() => setSelectedCourseId(course.id))} className="text-sm font-bold text-blue-700 disabled:opacity-50">
                        Iniciar revisión
                      </button>
                    )}
                    {course.status === "IN_REVIEW" && (
                      <button type="button" onClick={() => setSelectedCourseId(course.id)} className="text-sm font-bold text-blue-700">
                        Revisar y gestionar oportunidad
                      </button>
                    )}
                    {course.status === "IN_REVIEW" && (
                      <button type="button" disabled={working} onClick={() => void runAction(
                        () => learningApi.setStatus<LearningCourse>("courses", course.id, "DISCARDED", "Fuente descartada tras revisión administrativa."),
                        "Fuente descartada.",
                      )} className="text-sm font-semibold text-rose-700 disabled:opacity-50">
                        Descartar
                      </button>
                    )}
                    {offer?.status === "PUBLISHED" && (
                      <button type="button" disabled={working} onClick={() => void runAction(
                        () => learningApi.setStatus<LearningOffer>("offers", offer.id, "RETIRED", "Oportunidad retirada por administración."),
                        "Oportunidad retirada del catálogo.",
                      )} className="text-sm font-semibold text-slate-600 disabled:opacity-50">
                        Retirar oportunidad
                      </button>
                    )}
                    {offer?.status === "DRAFT" && course.status === "IN_REVIEW" && (
                      <button type="button" onClick={() => setSelectedCourseId(course.id)} className="text-sm font-bold text-blue-700">
                        Continuar borrador
                      </button>
                    )}
                  </div>
                </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
          {visibleCourses.length === 0 && (
            <p role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
              {data.courses.length === 0 ? "Aún no hay cursos registrados. Puedes registrar una fuente para iniciar el flujo." : "No hay cursos con este estado."}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function RadarPage() {
  return (
    <RoleGate allow={["ADMIN"]}>
      <RadarAdmin />
    </RoleGate>
  );
}
