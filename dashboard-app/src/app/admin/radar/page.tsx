"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink, Plus, RefreshCw, X } from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { ContextNote, PageHeader } from "@/shared/ui/DashboardPrimitives";
import {
  getLearningErrorMessage,
  learningApi,
  splitList,
  type CourseInput,
  type LearningCourse,
  type LearningInterest,
  type LearningOffer,
  type DiscoverySource,
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
  sources: DiscoverySource[];
};

function RadarAdmin() {
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [working, setWorking] = useState(false);
  const sources = data?.sources ?? [];

  const fetchCatalog = useCallback(async (): Promise<RadarData> => {
    const [courses, offers, interests, discoverySources] = await Promise.all([
      learningApi.courses(),
      learningApi.offers(),
      learningApi.interests(),
      learningApi.discoverySources(),
    ]);
    return { courses, offers, interests, sources: discoverySources };
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

  async function registerDiscoverySource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const saved = await runAction(() => learningApi.addDiscoverySource({
      name: String(form.get("name")).trim(),
      url: String(form.get("url")).trim(),
      kind: String(form.get("kind")) as DiscoverySource["kind"],
      terms_reviewed: form.get("terms_reviewed") === "on",
    }), "Fuente autorizada registrada. Explórala para encontrar cursos pendientes de revisión.");
    if (saved) element.reset();
  }

  async function scanSource(id: string) {
    setWorking(true);
    setError("");
    try {
      const result = await learningApi.scanDiscoverySource(id);
      if (result.error) throw new Error(result.error);
      setData(await fetchCatalog());
      setNotice(`${result.detected} cursos nuevos; ${result.updated} actualizados. Revisa cada hallazgo antes de publicarlo.`);
    } catch (cause) {
      setError(getLearningErrorMessage(cause));
    } finally {
      setWorking(false);
    }
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
      <PageHeader title="Radar de cursos" description="Registra fuentes y publica oportunidades para estudiantes." />
      <ContextNote>Los cursos externos se publican en Mi ruta tras revisión; los talleres de EPIS se gestionan en Talleres.</ContextNote>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p>{error}</p>
          <button type="button" onClick={() => void reloadCatalog()} className="mt-2 font-semibold underline underline-offset-2">
            Reintentar
          </button>
        </div>
      )}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}

      <section className="surface-card space-y-4 p-5 sm:p-6" aria-label="Fuentes autorizadas para descubrir cursos">
        <div><h2 className="section-title">Explorar fuentes autorizadas</h2><p className="mt-1 text-sm text-slate-600">Consulta RSS o enlaces de un sitio público autorizado. Cada curso encontrado queda pendiente de revisión.</p></div>
        <form onSubmit={registerDiscoverySource} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
          <label className="text-sm font-medium">Proveedor o fuente<input name="name" required minLength={3} maxLength={150} className={field} /></label>
          <label className="text-sm font-medium">URL HTTPS<input name="url" type="url" pattern="https://.*" required className={field} /></label>
          <label className="text-sm font-medium">Formato<select name="kind" className={field}><option value="RSS">RSS/Atom</option><option value="HTML_LINKS">Enlaces HTML</option></select></label>
          <label className="flex items-center gap-2 text-sm md:col-span-3"><input name="terms_reviewed" type="checkbox" required /> He comprobado que las condiciones del sitio permiten esta consulta.</label>
          <button disabled={working} className="w-fit rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Agregar fuente</button>
        </form>
        {sources.length > 0 && <div className="divide-y divide-slate-200 border-t border-slate-200">{sources.map((source) => <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong>{source.name}</strong><p className="break-all text-slate-600">{source.url}</p><p className="text-xs text-slate-500">{source.last_checked_at ? `Última consulta: ${new Date(source.last_checked_at).toLocaleString("es-PE")}` : "Sin consultar"}{source.last_error ? ` · Error: ${source.last_error}` : ""}</p></div><div className="flex gap-3"><button type="button" disabled={working || !source.active} onClick={() => void scanSource(source.id)} className="font-semibold text-blue-700 disabled:opacity-50">Explorar ahora</button><button type="button" disabled={working} onClick={() => void runAction(() => learningApi.setDiscoverySourceActive(source.id, !source.active), source.active ? "Fuente pausada." : "Fuente activada.")} className="text-slate-600">{source.active ? "Pausar" : "Activar"}</button></div></div>)}</div>}
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="card-title flex cursor-pointer list-none items-center gap-2 p-5">
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
            <button disabled={working} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
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
        <button type="button" disabled={loading} onClick={() => void reloadCatalog()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} aria-hidden="true" /> Actualizar
        </button>
      </div>

      {loading ? (
        <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Cargando cursos y oportunidades…</p>
      ) : data ? (
        <>
          {selectedCourse && selectedCourse.status === "IN_REVIEW" && (
            <section className="surface-card space-y-6 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="section-title">Revisar: {selectedCourse.title}</h2>
                </div>
                <button type="button" aria-label="Cerrar revisión" onClick={() => setSelectedCourseId("")} className="rounded-lg p-2 text-slate-500 hover:bg-white">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={saveCourseReview} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                <h3 className="font-semibold text-slate-900 md:col-span-2">Datos del curso</h3>
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
                <button disabled={working} className="w-fit rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50">
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
                    <h3 className="font-semibold text-slate-900">Oportunidad para estudiantes</h3>
                    <p className="mt-1 text-sm text-slate-600">Declara a quién está dirigida y por qué es relevante. No se filtra el acceso al catálogo por audiencia.</p>
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
                    <button name="intent" value="draft" disabled={working} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50">
                      Guardar borrador
                    </button>
                    <button name="intent" value="publish" disabled={working} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                      {working ? "Publicando…" : "Guardar y publicar"}
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}

          <section aria-label="Cursos registrados" className="grid gap-4 lg:grid-cols-2">
            {visibleCourses.map((course) => {
              const offer = data.offers.find((item) => item.course_id === course.id);
              return (
                <article key={course.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="card-title">{course.title}</h2>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{courseLabels[course.status]}</span>
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
                      ).then(() => setSelectedCourseId(course.id))} className="text-sm font-semibold text-blue-700 disabled:opacity-50">
                        Iniciar revisión
                      </button>
                    )}
                    {course.status === "IN_REVIEW" && (
                      <button type="button" onClick={() => setSelectedCourseId(course.id)} className="text-sm font-semibold text-blue-700">
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
                      <button type="button" onClick={() => setSelectedCourseId(course.id)} className="text-sm font-semibold text-blue-700">
                        Continuar borrador
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
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
