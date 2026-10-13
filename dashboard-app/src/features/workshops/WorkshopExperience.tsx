"use client";

import { useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  MapPin,
  UsersRound,
  Laptop2,
  ArrowUpRight,
  ClipboardList,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useRole } from "@/features/access/RoleProvider";
import {
  participationStatusPresentation,
  workshopOffer,
  workshopRequestExamples,
  workshopStatusPresentation,
} from "./demo";
import type { Participation } from "@/shared/contracts/types";

function DemoNotice() {
  return (
    <aside
      role="note"
      className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"
    >
      <Info size={19} aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" />
      <p className="leading-6">
        Prototipo demostrativo con datos sintéticos. Las solicitudes y los cambios
        se muestran solo en esta pantalla: no se guardan ni reservan cupos reales.
      </p>
    </aside>
  );
}

function DemoTag() {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800">
      <Sparkles size={14} aria-hidden="true" />
      Demostración
    </span>
  );
}

function WorkshopFacts() {
  const facts = [
    { icon: CalendarDays, label: "Fecha y horario", value: workshopOffer.schedule },
    { icon: MapPin, label: "Modalidad y lugar", value: workshopOffer.modality },
    { icon: Clock3, label: "Duración", value: workshopOffer.duration },
    { icon: UsersRound, label: "Facilitación", value: workshopOffer.facilitator },
  ];

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {facts.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-start gap-3">
          <span className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
            <Icon size={18} aria-hidden="true" />
          </span>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm font-semibold leading-5 text-slate-900">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function SeatSummary() {
  const availableSeats = workshopOffer.capacity - workshopOffer.occupiedSeats;
  const occupiedPercent = Math.round(
    (workshopOffer.occupiedSeats / workshopOffer.capacity) * 100,
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">Cupos disponibles</p>
          <p className="mt-1 text-sm text-slate-600">
            {workshopOffer.occupiedSeats} de {workshopOffer.capacity} ocupados en el ejemplo
          </p>
        </div>
        <span className="rounded-xl bg-white px-3 py-2 text-lg font-black text-blue-800 shadow-sm">
          {availableSeats}
        </span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="Cupos ocupados en el ejemplo"
        aria-valuemin={0}
        aria-valuemax={workshopOffer.capacity}
        aria-valuenow={workshopOffer.occupiedSeats}
      >
        <div
          className="h-full rounded-full bg-blue-600"
          style={{ width: `${occupiedPercent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Aforo referencial; la inscripción real no está habilitada.
      </p>
    </div>
  );
}

function OfferCard({ children }: { children?: React.ReactNode }) {
  const status = workshopStatusPresentation[workshopOffer.status];

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#102c52] via-blue-900 to-indigo-800 p-6 text-white sm:p-8">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-50">
              Taller práctico
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
              {status.label}
            </span>
          </div>
          <h2 className="mt-5 max-w-3xl text-2xl font-black leading-tight tracking-tight sm:text-3xl">
            {workshopOffer.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
            {workshopOffer.description}
          </p>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-7">
        <WorkshopFacts />

        <div>
          <h3 className="text-sm font-bold text-slate-950">Requisitos de participación</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {workshopOffer.prerequisites.map((prerequisite) => (
              <li
                key={prerequisite}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <Check size={15} aria-hidden="true" className="shrink-0 text-emerald-600" />
                {prerequisite}
              </li>
            ))}
          </ul>
        </div>

        <SeatSummary />
        {children}
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: Participation["status"] }) {
  const presentation = participationStatusPresentation[status];
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${presentation.className}`}>
      {presentation.label}
    </span>
  );
}

function AdminWorkshopView() {
  const statusCounts = workshopRequestExamples.reduce<Record<Participation["status"], number>>(
    (counts, request) => ({ ...counts, [request.status]: counts[request.status] + 1 }),
    { SUBMITTED: 0, ACCEPTED: 0, REJECTED: 0, COMPLETED: 0 },
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
            Formación complementaria
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Gestión de talleres
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Revisa la oferta, los requisitos, los cupos y ejemplos del ciclo de inscripción.
          </p>
        </div>
        <DemoTag />
      </header>

      <DemoNotice />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <OfferCard />
        <aside className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <ClipboardList size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">Resumen de inscripciones</h2>
              <p className="mt-1 text-sm text-slate-600">Estados incluidos en el prototipo.</p>
            </div>
          </div>
          <dl className="space-y-3">
            {(Object.entries(participationStatusPresentation) as Array<[
              Participation["status"],
              (typeof participationStatusPresentation)[Participation["status"]],
            ]>).map(([status, presentation]) => (
              <div key={status} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <dt><StatusPill status={status} /></dt>
                <dd className="text-sm font-bold tabular-nums text-slate-700">
                  {statusCounts[status]} {statusCounts[status] === 1 ? "ejemplo" : "ejemplos"}
                </dd>
                <span className="sr-only">{presentation.label}</span>
              </div>
            ))}
          </dl>
          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-600">
            La oferta también se muestra como <strong className="text-emerald-700">Abierta</strong>.
            Cuando se conecte el backend, aquí se administrarán las solicitudes reales.
          </div>
        </aside>
      </div>

      <section aria-labelledby="workshop-requests-heading" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vista de ejemplo</p>
            <h2 id="workshop-requests-heading" className="mt-1 text-xl font-bold text-slate-950">
              Solicitudes de participación
            </h2>
          </div>
          <span className="text-sm text-slate-500">{workshopRequestExamples.length} registros sintéticos</span>
        </div>
        <div className="mt-5 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="pb-3 pr-4 font-semibold">Referencia</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Enviada</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Estado</th>
                <th scope="col" className="pb-3 font-semibold">Observación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workshopRequestExamples.map((request) => (
                <tr key={request.id}>
                  <th scope="row" className="py-4 pr-4 font-semibold text-slate-900">{request.reference}</th>
                  <td className="py-4 pr-4 text-slate-600">{request.submittedOn}</td>
                  <td className="py-4 pr-4"><StatusPill status={request.status} /></td>
                  <td className="py-4 text-slate-600">{request.comment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul
          aria-label="Solicitudes de participación"
          className="mt-5 space-y-3 md:hidden"
        >
          {workshopRequestExamples.map((request) => (
            <li key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{request.reference}</h3>
                <StatusPill status={request.status} />
              </div>
              <p className="mt-2 text-xs text-slate-500">Enviada el {request.submittedOn}</p>
              <p className="mt-2 text-sm leading-5 text-slate-600">
                {request.comment ?? "Sin observaciones de ejemplo."}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StudentWorkshopView() {
  const [requestStatus, setRequestStatus] = useState<Participation["status"] | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
            Aprende haciendo
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Talleres para ti
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Explora una actividad práctica y conoce los pasos para participar.
          </p>
        </div>
        <DemoTag />
      </header>

      <DemoNotice />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(290px,0.75fr)]">
        <OfferCard>
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-white p-2.5 text-blue-700 shadow-sm">
                {requestStatus ? <CheckCircle2 size={20} aria-hidden="true" /> : <Laptop2 size={20} aria-hidden="true" />}
              </span>
              <div>
                <p className="font-bold text-slate-950">
                  {requestStatus ? "Solicitud de ejemplo" : "¿Te interesa participar?"}
                </p>
                <p aria-live="polite" className="mt-1 text-sm leading-5 text-slate-600">
                  {requestStatus
                    ? "Tu solicitud aparece como enviada en esta demostración. No se registró en el sistema."
                    : "Envía una solicitud de participación para ver cómo cambiaría su estado."}
                </p>
                {requestStatus && <div className="mt-2"><StatusPill status={requestStatus} /></div>}
              </div>
            </div>
            {requestStatus ? (
              <button
                type="button"
                onClick={() => setRequestStatus(null)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <RotateCcw size={16} aria-hidden="true" />
                Reiniciar demo
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRequestStatus("SUBMITTED")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
              >
                Enviar solicitud
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </OfferCard>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-bold text-slate-950">Antes de solicitar</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Revisa el horario y confirma que cumples los requisitos indicados en la oferta.
              La solicitud no garantiza un cupo.
            </p>
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-3 text-sm leading-5 text-amber-950">
              <Info size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700" />
              <span>En esta versión, la disponibilidad y el envío son de muestra.</span>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-bold text-slate-950">Tu proceso</h2>
            <p className="mt-1 text-sm text-slate-600">Una guía rápida de los estados posibles.</p>
            <ol className="mt-4 space-y-3">
              {[
                ["Abierta", "La oferta acepta solicitudes."],
                ["Enviada", "La solicitud espera revisión."],
                ["Aceptada / Rechazada", "El equipo comunica una decisión."],
                ["Finalizada", "El taller concluye."],
              ].map(([status, description], index) => (
                <li key={status} className="flex gap-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${index < (requestStatus ? 2 : 1) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                    {index < (requestStatus ? 2 : 1) ? <Check size={14} aria-hidden="true" /> : index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{status}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-600">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

    </div>
  );
}

export function WorkshopExperience() {
  const { role } = useRole();
  return role === "ADMIN" ? <AdminWorkshopView /> : <StudentWorkshopView />;
}
