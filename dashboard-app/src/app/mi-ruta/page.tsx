"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Cloud,
  Code2,
  Compass,
  Database,
  ShieldCheck,
  Target,
} from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import { ContextNote, PageHeader } from "@/shared/ui/DashboardPrimitives";
import {
  getLearningErrorMessage,
  learningApi,
  type LearningCourse,
  type LearningInterest,
  type LearningOffer,
  type LearningProfile,
  type LearningRoute,
} from "@/shared/api/learning";

const interestIcons = [Cloud, Database, Code2, ShieldCheck];

function StudentPathContent() {
  const [interests, setInterests] = useState<LearningInterest[]>([]);
  const [routes, setRoutes] = useState<LearningRoute[]>([]);
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [offers, setOffers] = useState<LearningOffer[]>([]);
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let current = true;
    Promise.all([
      learningApi.interests(),
      learningApi.routes(),
      learningApi.courses(),
      learningApi.offers(),
      learningApi.profile(),
    ])
      .then(([nextInterests, nextRoutes, nextCourses, nextOffers, nextProfile]) => {
        if (!current) return;
        setInterests(nextInterests);
        setRoutes(nextRoutes);
        setCourses(nextCourses);
        setOffers(nextOffers);
        setProfile(nextProfile);
        setSelectedInterestIds(nextProfile.interest_ids);
        setSelectedRouteId(
          nextRoutes.some((route) => route.id === nextProfile.route_id)
            ? nextProfile.route_id ?? ""
            : "",
        );
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
  }, [retryKey]);

  function retryLoad() {
    setLoading(true);
    setError("");
    setRetryKey((key) => key + 1);
  }

  const selectedRoute = routes.find((route) => route.id === selectedRouteId);
  const interestNames = useMemo(
    () => new Map(interests.map((interest) => [interest.id, interest.name])),
    [interests],
  );
  const courseNames = useMemo(
    () => new Map(courses.map((course) => [course.id, course.title])),
    [courses],
  );
  const coursesById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);

  function toggleInterest(id: string) {
    setSelectedInterestIds((current) =>
      current.includes(id)
        ? current.filter((interestId) => interestId !== id)
        : [...current, id],
    );
    setNotice("");
  }

  async function savePreferences() {
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const saved = await learningApi.saveProfile({
        route_id: selectedRouteId || null,
        interest_ids: selectedInterestIds,
      });
      setProfile(saved);
      setSelectedInterestIds(saved.interest_ids);
      setSelectedRouteId(saved.route_id ?? "");
      setNotice("Tus preferencias quedaron guardadas.");
    } catch (cause) {
      setError(getLearningErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  const hasUnsavedChanges = Boolean(
    profile &&
      (selectedRouteId !== (profile.route_id ?? "") ||
        selectedInterestIds.length !== profile.interest_ids.length ||
        selectedInterestIds.some((id) => !profile.interest_ids.includes(id))),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Mi ruta" description="Elige tus intereses y consulta las oportunidades vigentes." />
      <ContextNote>Las oportunidades son un catálogo general; tus preferencias no evalúan conocimientos ni generan recomendaciones personalizadas.</ContextNote>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p>{error}</p>
          {!loading && (
            <button
              type="button"
              onClick={retryLoad}
              className="mt-2 font-semibold underline underline-offset-2"
            >
              Reintentar carga
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Cargando tus preferencias y el catálogo…
        </p>
      ) : !error ? (
        <>
          <section
            aria-labelledby="path-preferences-heading"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                <Compass size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 id="path-preferences-heading" className="section-title">
                  Tus preferencias de formación
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Selecciona las áreas que te interesan y guarda los cambios en tu perfil.
                </p>
              </div>
            </div>

            {interests.length > 0 ? (
              <fieldset className="mt-6">
                <legend className="text-sm font-semibold text-slate-900">
                  Áreas de interés
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {interests.map((interest, index) => {
                    const Icon = interestIcons[index % interestIcons.length];
                    const checked = selectedInterestIds.includes(interest.id);
                    return (
                      <label
                        key={interest.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                          checked
                            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                            : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          className="sr-only"
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInterest(interest.id)}
                        />
                        <span className={`rounded-lg p-2 ${checked ? "bg-white text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <span className="text-sm font-semibold text-slate-900">{interest.name}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                Todavía no hay áreas de interés activas.
              </p>
            )}

            <div className="mt-5">
              <label htmlFor="learning-route" className="text-sm font-semibold text-slate-900">
                Ruta de formación
              </label>
              <select
                id="learning-route"
                value={selectedRouteId}
                onChange={(event) => {
                  setSelectedRouteId(event.target.value);
                  setNotice("");
                }}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:max-w-xl"
              >
                <option value="">Sin ruta seleccionada</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>{route.title}</option>
                ))}
              </select>
              {profile?.route_id && !routes.some((route) => route.id === profile.route_id) && (
                <p className="mt-2 text-xs text-amber-800">
                  La ruta que tenías seleccionada ya no está publicada; elige otra o guarda sin ruta.
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={saving || !hasUnsavedChanges}
                onClick={savePreferences}
                className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar preferencias"}
              </button>
              {notice && <p role="status" className="text-sm font-medium text-blue-800">{notice}</p>}
            </div>
          </section>

          <section aria-labelledby="selected-route-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                <BookOpen size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 id="selected-route-heading" className="section-title">
                  {selectedRoute ? selectedRoute.title : "Rutas publicadas"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {selectedRoute
                    ? selectedRoute.description
                    : "Las rutas las prepara y publica el equipo administrador."}
                </p>
              </div>
            </div>
            {selectedRoute ? (
              <ol className="mt-5 space-y-3">
                {selectedRoute.steps.map((step) => (
                  <li key={step.id} className="flex gap-3 rounded-xl border border-slate-200 p-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-semibold text-blue-800">
                      {step.position}
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-950">{step.title}</h3>
                      {step.skills.length > 0 && (
                        <p className="mt-1 text-sm text-slate-600">
                          Habilidades: {step.skills.join(", ")}
                        </p>
                      )}
                      {step.prerequisites.length > 0 && (
                        <p className="mt-1 text-sm text-slate-600">
                          Requisitos: {step.prerequisites.join(", ")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : routes.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
                No hay rutas publicadas disponibles por ahora.
              </p>
            ) : (
              <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
                <Target size={17} aria-hidden="true" />
                Selecciona y guarda una ruta para consultar sus pasos.
              </div>
            )}
          </section>

          <section aria-labelledby="opportunities-heading" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
              <h2 id="opportunities-heading" className="section-title">
                Oportunidades publicadas
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Cursos externos revisados por la escuela. La inscripción se realiza con cada proveedor.
              </p>
              </div>
              <Link href="/talleres" className="text-sm font-semibold text-blue-700 hover:text-blue-900">Ver talleres EPIS →</Link>
            </div>
            {offers.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {offers.map((offer) => (
                  <article key={offer.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                      <CheckCircle2 size={14} aria-hidden="true" /> Publicada
                    </span>
                    <h3 className="card-title mt-3">{offer.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">Curso: {courseNames.get(offer.course_id) ?? "Curso publicado"}</p>
                    {coursesById.get(offer.course_id) && <p className="mt-1 text-sm text-slate-600">Proveedor: {coursesById.get(offer.course_id)?.provider}</p>}
                    <p className="mt-3 text-sm leading-6 text-slate-700">{offer.relevance}</p>
                    {(offer.cycles.length > 0 || offer.interest_ids.length > 0) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {offer.cycles.map((cycle) => (
                          <span key={`cycle-${cycle}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Ciclo {cycle}
                          </span>
                        ))}
                        {offer.interest_ids.map((id) => (
                          <span key={`interest-${id}`} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                            {interestNames.get(id) ?? "Área de interés"}
                          </span>
                        ))}
                      </div>
                    )}
                    {coursesById.get(offer.course_id)?.source_url && (
                      <a href={coursesById.get(offer.course_id)?.source_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
                        Ver curso e inscripción en el sitio del proveedor <ExternalLink size={16} aria-hidden="true" />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                Aún no hay oportunidades publicadas.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function StudentPathPage() {
  return (
    <RoleGate allow={["STUDENT"]}>
      <StudentPathContent />
    </RoleGate>
  );
}
