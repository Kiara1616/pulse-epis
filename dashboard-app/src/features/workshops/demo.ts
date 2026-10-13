import { prototypeFixtures } from "@/shared/contracts/fixtures";
import type { Participation, Workshop } from "@/shared/contracts/types";

export type WorkshopOffer = Workshop & {
  description: string;
  facilitator: string;
  schedule: string;
  modality: string;
  duration: string;
  occupiedSeats: number;
};

const prototypes = prototypeFixtures();

export const workshopOffer: WorkshopOffer = {
  ...prototypes.workshops[0],
  title: "Prototipado de soluciones con inteligencia artificial",
  capacity: 24,
  prerequisites: [
    "Conocimientos básicos de programación",
    "Traer una laptop con navegador actualizado",
  ],
  status: "OPEN",
  description:
    "Diseña y presenta un prototipo funcional mientras exploras herramientas de IA generativa y buenas prácticas de evaluación.",
  facilitator: "Equipo académico EPIS (ejemplo)",
  schedule: "Sábado, 24 de octubre · 9:00 a. m. – 1:00 p. m.",
  modality: "Presencial · Laboratorio de cómputo",
  duration: "4 horas",
  occupiedSeats: 18,
};

export type WorkshopRequestExample = Participation & {
  reference: string;
  submittedOn: string;
};

const requestReferences = ["Solicitud de ejemplo 01", "Solicitud de ejemplo 02", "Solicitud de ejemplo 03", "Solicitud de ejemplo 04"];
const requestDates = ["02 oct 2026", "03 oct 2026", "04 oct 2026", "05 oct 2026"];

export const workshopRequestExamples: WorkshopRequestExample[] =
  prototypes.participations.map((participation, index) => ({
    ...participation,
    reference: requestReferences[index],
    submittedOn: requestDates[index],
  }));

export const participationStatusPresentation: Record<
  Participation["status"],
  { label: string; className: string }
> = {
  SUBMITTED: { label: "Enviada", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  ACCEPTED: { label: "Aceptada", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  REJECTED: { label: "Rechazada", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  COMPLETED: { label: "Finalizada", className: "bg-violet-50 text-violet-700 ring-violet-200" },
};

export const workshopStatusPresentation: Record<
  Workshop["status"],
  { label: string; className: string }
> = {
  DRAFT: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  OPEN: { label: "Abierta", className: "bg-emerald-50 text-emerald-700" },
  CLOSED: { label: "Cerrada", className: "bg-amber-50 text-amber-700" },
  COMPLETED: { label: "Finalizada", className: "bg-violet-50 text-violet-700" },
};
