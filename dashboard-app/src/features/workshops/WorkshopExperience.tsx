"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Info,
  Plus,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { useRole } from "@/features/access/RoleProvider";
import {
  formatLearningDate,
  getLearningErrorMessage,
  learningApi,
  splitList,
  type LearningApplication,
  type LearningOffer,
  type LearningWorkshop,
  type WorkshopInput,
} from "@/shared/api/learning";

const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

const applicationStatusPresentation: Record<LearningApplication["status"], { label: string; className: string }> = {
  SUBMITTED: { label: "Enviada", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  ACCEPTED: { label: "Aceptada", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  REJECTED: { label: "Rechazada", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  COMPLETED: { label: "Finalizada", className: "bg-violet-50 text-violet-700 ring-violet-200" },
};

const workshopStatusPresentation: Record<LearningWorkshop["status"], { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  OPEN: { label: "Abierto", className: "bg-emerald-50 text-emerald-700" },
  CLOSED: { label: "Cerrado", className: "bg-amber-50 text-amber-800" },
  COMPLETED: { label: "Finalizado", className: "bg-violet-50 text-violet-700" },
};

function StatusPill({ status }: { status: LearningApplication["status"] }) {
  const presentation = applicationStatusPresentation[status];
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${presentation.className}`}>
      {presentation.label}
    </span>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">{label}</p>;
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      <p>{message}</p>
      <button type="button" onClick={retry} className="mt-2 font-bold underline underline-offset-2">Reintentar</button>
    </div>
  );
}

function StudentWorkshopView() {
  const [workshops, setWorkshops] = useState<LearningWorkshop[]>([]);
  const [offers, setOffers] = useState<LearningOffer[]>([]);
  const [applications, setApplications] = useState<LearningApplication[]>([]);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const fetchStudentData = useCallback(async () => {
    const [nextWorkshops, nextOffers, nextApplications] = await Promise.all([
      learningApi.workshops(),
      learningApi.offers(),
      learningApi.myApplications(),
    ]);
    return { workshops: nextWorkshops, offers: nextOffers, applications: nextApplications };
  }, []);

  const applyStudentData = useCallback((next: Awaited<ReturnType<typeof fetchStudentData>>) => {
    setWorkshops(next.workshops);
    setOffers(next.offers);
    setApplications(next.applications);
  }, []);

  useEffect(() => {
    let current = true;
    fetchStudentData()
      .then((next) => {
        if (current) applyStudentData(next);
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
  }, [applyStudentData, fetchStudentData, retryKey]);

  function retryStudentLoad() {
    setLoading(true);
    setError("");
    setRetryKey((key) => key + 1);
  }

  const offerNames = useMemo(() => new Map(offers.map((offer) => [offer.id, offer.title])), [offers]);
  const applicationByWorkshop = useMemo(
    () => new Map(applications.map((application) => [application.workshop_id, application])),
    [applications],
  );

  async function apply(workshopId: string) {
    setWorkingId(workshopId);
    setError("");
    setNotice("");
    try {
      await learningApi.apply(workshopId);
      applyStudentData(await fetchStudentData());
      setNotice("Tu solicitud quedó registrada y está pendiente de revisión.");
    } catch (cause) {
      setError(getLearningErrorMessage(cause));
      await fetchStudentData().then(applyStudentData).catch(() => undefined);
    } finally {
      setWorkingId("");
    }
  }

  function toggleAcknowledgement(id: string) {
    setAcknowledged((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">Aprende haciendo</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Talleres para ti</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Consulta talleres abiertos y envía una solicitud guardada en el sistema.
          </p>
        </div>
        <Link href="/mi-ruta" className="text-sm font-bold text-blue-700 hover:text-blue-900">Volver a oportunidades</Link>
      </header>

      <aside role="note" className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        <Info size={19} aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" />
        <p>Solo verás tus solicitudes. Confirmar que leíste los requisitos no significa que acredites cumplirlos ni reserva un cupo; la decisión se registra en el sistema.</p>
      </aside>
      {error && <ErrorPanel message={error} retry={retryStudentLoad} />}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}

      {loading ? <LoadingPanel label="Cargando talleres y tus solicitudes…" /> : !error ? (
        <>
          {workshops.length === 0 ? (
            <p role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
              No hay talleres abiertos disponibles por ahora.
            </p>
          ) : (
            <section aria-label="Talleres abiertos" className="grid gap-5 xl:grid-cols-2">
              {workshops.map((workshop) => {
                const application = applicationByWorkshop.get(workshop.id);
                const confirmed = acknowledged.includes(workshop.id);
                const full = workshop.available_places <= 0;
                return (
                  <article key={workshop.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="bg-gradient-to-br from-[#102c52] via-blue-900 to-indigo-800 p-6 text-white">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-50">Taller</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${workshopStatusPresentation[workshop.status].className}`}>
                          {workshopStatusPresentation[workshop.status].label}
                        </span>
                      </div>
                      <h2 className="mt-4 text-2xl font-black leading-tight">{workshop.title}</h2>
                      <p className="mt-2 text-sm text-blue-100">Oportunidad: {offerNames.get(workshop.offer_id) ?? "Formación publicada"}</p>
                    </div>
                    <div className="space-y-5 p-5 sm:p-6">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span className="rounded-xl bg-white p-2.5 text-blue-700 shadow-sm"><UsersRound size={19} aria-hidden="true" /></span>
                            <div>
                              <h3 className="text-sm font-bold text-slate-950">Cupos disponibles</h3>
                              <p className="mt-1 text-sm text-slate-600">{workshop.occupied_places} de {workshop.capacity} ocupados</p>
                            </div>
                          </div>
                          <span className="rounded-xl bg-white px-3 py-2 text-lg font-black text-blue-800 shadow-sm">{workshop.available_places}</span>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-950">Requisitos de participación</h3>
                        {workshop.requirements.length > 0 ? (
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {workshop.requirements.map((requirement) => (
                              <li key={requirement} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                <Check size={15} aria-hidden="true" className="shrink-0 text-emerald-600" /> {requirement}
                              </li>
                            ))}
                          </ul>
                        ) : <p className="mt-2 text-sm text-slate-600">No se indicaron requisitos previos.</p>}
                      </div>
                      {application ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 size={20} aria-hidden="true" className="text-emerald-700" />
                            <div>
                              <p className="font-bold text-slate-950">Solicitud registrada</p>
                              <p className="mt-1 text-xs text-slate-600">{formatLearningDate(application.created_at)}</p>
                            </div>
                          </div>
                          <StatusPill status={application.status} />
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                          <label className="flex items-start gap-3 text-sm leading-5 text-slate-800">
                            <input type="checkbox" checked={confirmed} onChange={() => toggleAcknowledgement(workshop.id)} className="mt-0.5 accent-blue-700" />
                            <span>Confirmo que leí los requisitos de participación.</span>
                          </label>
                          <button
                            type="button"
                            disabled={!confirmed || full || Boolean(workingId)}
                            onClick={() => void apply(workshop.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {workingId === workshop.id ? "Enviando…" : full ? "Sin cupos disponibles" : "Enviar solicitud"}
                            {workingId !== workshop.id && <ArrowUpRight size={16} aria-hidden="true" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          <section aria-labelledby="my-applications-heading" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><ClipboardList size={20} aria-hidden="true" /></span>
              <div>
                <h2 id="my-applications-heading" className="font-bold text-slate-950">Mis solicitudes</h2>
                <p className="mt-1 text-sm text-slate-600">Estados obtenidos de tu perfil autenticado.</p>
              </div>
            </div>
            {applications.length > 0 ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {applications.map((application) => {
                  const workshop = workshops.find((item) => item.id === application.workshop_id);
                  return (
                    <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold text-slate-900">{workshop?.title ?? "Taller ya no disponible"}</p>
                        <p className="mt-1 text-xs text-slate-500">Enviada {formatLearningDate(application.created_at)}</p>
                      </div>
                      <StatusPill status={application.status} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aún no has enviado solicitudes.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function AdminWorkshopView() {
  const [workshops, setWorkshops] = useState<LearningWorkshop[]>([]);
  const [offers, setOffers] = useState<LearningOffer[]>([]);
  const [applications, setApplications] = useState<LearningApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const fetchAdminData = useCallback(async () => {
    const [nextWorkshops, nextOffers, nextApplications] = await Promise.all([
      learningApi.workshops(),
      learningApi.offers(),
      learningApi.adminApplications(),
    ]);
    return { workshops: nextWorkshops, offers: nextOffers, applications: nextApplications };
  }, []);

  const applyAdminData = useCallback((next: Awaited<ReturnType<typeof fetchAdminData>>) => {
    setWorkshops(next.workshops);
    setOffers(next.offers);
    setApplications(next.applications);
  }, []);

  useEffect(() => {
    let current = true;
    fetchAdminData()
      .then((next) => {
        if (current) applyAdminData(next);
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
  }, [applyAdminData, fetchAdminData, retryKey]);

  function retryAdminLoad() {
    setLoading(true);
    setError("");
    setRetryKey((key) => key + 1);
  }

  const offerNames = useMemo(() => new Map(offers.map((offer) => [offer.id, offer.title])), [offers]);
  const publishedOffers = offers.filter((offer) => offer.status === "PUBLISHED");

  async function perform(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await action();
      applyAdminData(await fetchAdminData());
      setNotice(success);
      return true;
    } catch (cause) {
      setError(getLearningErrorMessage(cause));
      await fetchAdminData().then(applyAdminData).catch(() => undefined);
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function createWorkshop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input: WorkshopInput = {
      offer_id: String(form.get("offer_id")),
      title: String(form.get("title")).trim(),
      capacity: Number(form.get("capacity")),
      requirements: splitList(String(form.get("requirements"))),
    };
    const published = await perform(async () => {
      const workshop = await learningApi.createWorkshop(input);
      await learningApi.setStatus<LearningWorkshop>(
        "workshops",
        workshop.id,
        "OPEN",
        "Taller publicado para recibir solicitudes.",
      );
    }, "Taller publicado y visible para estudiantes.");
    if (published) formElement.reset();
  }

  async function decide(application: LearningApplication, status: LearningApplication["status"]) {
    const reason = reasons[application.id]?.trim() ?? "";
    if (reason.length < 10) {
      setError("Escribe un motivo de al menos 10 caracteres para registrar la decisión.");
      return;
    }
    await perform(
      () => learningApi.decideApplication(application.id, status, reason),
      `Solicitud actualizada: ${applicationStatusPresentation[status].label.toLowerCase()}.`,
    );
  }

  async function changeWorkshopStatus(workshop: LearningWorkshop, status: LearningWorkshop["status"]) {
    const reasonByStatus: Record<LearningWorkshop["status"], string> = {
      DRAFT: "Taller guardado como borrador administrativo.",
      OPEN: "Taller publicado para recibir solicitudes.",
      CLOSED: "Inscripciones cerradas por administración.",
      COMPLETED: "Taller marcado como finalizado por administración.",
    };
    await perform(
      () => learningApi.setStatus<LearningWorkshop>("workshops", workshop.id, status, reasonByStatus[status]),
      `Taller actualizado: ${workshopStatusPresentation[status].label.toLowerCase()}.`,
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">Formación complementaria</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Gestión de talleres</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Publica talleres vinculados a oportunidades vigentes y revisa las solicitudes persistidas.</p>
      </header>

      <aside role="note" className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        <Info size={19} aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" />
        <p>Las solicitudes pertenecen a cada estudiante. La aceptación consume cupo; el backend controla los límites y registra cada decisión.</p>
      </aside>
      {error && <ErrorPanel message={error} retry={retryAdminLoad} />}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}

      {loading ? <LoadingPanel label="Cargando talleres y solicitudes…" /> : !error || workshops.length > 0 ? (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Plus size={20} aria-hidden="true" /></span>
              <div>
                <h2 className="font-bold text-slate-950">Publicar un taller</h2>
                <p className="mt-1 text-sm text-slate-600">Elige una oportunidad ya publicada. El taller se abrirá para solicitudes después de guardarse.</p>
              </div>
            </div>
            {publishedOffers.length > 0 ? (
              <form onSubmit={createWorkshop} className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-800 md:col-span-2">
                  Oportunidad publicada
                  <select name="offer_id" required className={field} defaultValue="">
                    <option value="" disabled>Selecciona una oportunidad</option>
                    {publishedOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.title}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Nombre del taller
                  <input name="title" required maxLength={200} className={field} />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Capacidad
                  <input name="capacity" type="number" min={1} max={10000} required className={field} />
                </label>
                <label className="text-sm font-semibold text-slate-800 md:col-span-2">
                  Requisitos (separados por coma)
                  <input name="requirements" placeholder="Conocimientos básicos de programación" className={field} />
                </label>
                <button disabled={working} className="w-fit rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
                  {working ? "Publicando…" : "Crear y abrir taller"}
                </button>
              </form>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                No hay oportunidades publicadas para asociar un taller. <Link href="/admin/radar" className="font-bold text-blue-700 underline">Revisar oportunidades</Link>
              </p>
            )}
          </section>

          <section aria-labelledby="admin-workshops-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Catálogo persistido</p>
                <h2 id="admin-workshops-heading" className="mt-1 text-xl font-bold text-slate-950">Talleres</h2>
              </div>
              <button type="button" disabled={working} onClick={() => void perform(async () => applyAdminData(await fetchAdminData()), "Datos actualizados.")} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={15} aria-hidden="true" /> Actualizar
              </button>
            </div>
            {workshops.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {workshops.map((workshop) => (
                  <article key={workshop.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-950">{workshop.title}</h3>
                        <p className="mt-1 text-sm text-slate-600">Oportunidad: {offerNames.get(workshop.offer_id) ?? "No disponible"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${workshopStatusPresentation[workshop.status].className}`}>{workshopStatusPresentation[workshop.status].label}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{workshop.occupied_places} de {workshop.capacity} cupos ocupados · {workshop.available_places} disponibles</p>
                    {workshop.requirements.length > 0 && <p className="mt-2 text-sm text-slate-600">Requisitos: {workshop.requirements.join(", ")}</p>}
                    <div className="mt-4 flex flex-wrap gap-3">
                      {workshop.status === "DRAFT" && <button type="button" disabled={working} onClick={() => void changeWorkshopStatus(workshop, "OPEN")} className="text-sm font-bold text-blue-700">Abrir solicitudes</button>}
                      {workshop.status === "OPEN" && <button type="button" disabled={working} onClick={() => void changeWorkshopStatus(workshop, "CLOSED")} className="text-sm font-bold text-amber-800">Cerrar solicitudes</button>}
                      {workshop.status === "CLOSED" && <button type="button" disabled={working} onClick={() => void changeWorkshopStatus(workshop, "COMPLETED")} className="text-sm font-bold text-violet-800">Marcar finalizado</button>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">Aún no hay talleres registrados.</p>
            )}
          </section>

          <section aria-labelledby="admin-requests-heading" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><ClipboardList size={20} aria-hidden="true" /></span>
              <div>
                <h2 id="admin-requests-heading" className="font-bold text-slate-950">Solicitudes de participación</h2>
                <p className="mt-1 text-sm text-slate-600">{applications.length} {applications.length === 1 ? "solicitud" : "solicitudes"} registradas.</p>
              </div>
            </div>
            {applications.length > 0 ? (
              <ul className="mt-5 space-y-3">
                {applications.map((application) => {
                  const workshop = workshops.find((item) => item.id === application.workshop_id);
                  const reason = reasons[application.id] ?? "";
                  return (
                    <li key={application.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-950">{workshop?.title ?? "Taller no disponible"}</h3>
                          <p className="mt-1 text-xs text-slate-500">Solicitud {application.id.slice(0, 8)} · Enviada {formatLearningDate(application.created_at)}</p>
                        </div>
                        <StatusPill status={application.status} />
                      </div>
                      {application.comment && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Motivo registrado: {application.comment}</p>}
                      {application.status === "SUBMITTED" || application.status === "ACCEPTED" ? (
                        <div className="mt-4 space-y-3">
                          <label className="block text-sm font-semibold text-slate-800">
                            Motivo de decisión (mínimo 10 caracteres)
                            <textarea value={reason} onChange={(event) => setReasons((current) => ({ ...current, [application.id]: event.target.value }))} minLength={10} maxLength={2000} rows={2} className={field} />
                          </label>
                          <div className="flex flex-wrap gap-3">
                            {application.status === "SUBMITTED" && (
                              <>
                                <button type="button" disabled={working || reason.trim().length < 10} onClick={() => void decide(application, "ACCEPTED")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Aceptar</button>
                                <button type="button" disabled={working || reason.trim().length < 10} onClick={() => void decide(application, "REJECTED")} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">Rechazar</button>
                              </>
                            )}
                            {application.status === "ACCEPTED" && <button type="button" disabled={working || reason.trim().length < 10} onClick={() => void decide(application, "COMPLETED")} className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Marcar finalizada</button>}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p role="status" className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aún no hay solicitudes de participación.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

export function WorkshopExperience() {
  const { role } = useRole();
  return role === "ADMIN" ? <AdminWorkshopView /> : <StudentWorkshopView />;
}
