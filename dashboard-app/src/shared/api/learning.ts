import { apiFetch } from "./client";

export type LearningInterest = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
};

export type LearningStep = {
  id: string;
  route_id: string;
  position: number;
  title: string;
  skills: string[];
  prerequisites: string[];
  created_at: string;
};

export type LearningRoute = {
  id: string;
  title: string;
  description: string;
  steps: LearningStep[];
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  created_at: string;
};

export type LearningCourse = {
  id: string;
  title: string;
  provider: string;
  source_url: string;
  checked_on: string;
  requirements: string[];
  skills: string[];
  status: "DETECTED" | "IN_REVIEW" | "PUBLISHED" | "DISCARDED" | "RETIRED";
  created_at: string;
};

export type LearningOffer = {
  id: string;
  course_id: string;
  title: string;
  cycles: string[];
  interest_ids: string[];
  relevance: string;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  created_at: string;
};

export type LearningWorkshop = {
  id: string;
  offer_id: string;
  title: string;
  capacity: number;
  requirements: string[];
  occupied_places: number;
  available_places: number;
  status: "DRAFT" | "OPEN" | "CLOSED" | "COMPLETED";
  created_at: string;
};

export type LearningApplication = {
  id: string;
  student_id: string;
  workshop_id: string;
  status: "SUBMITTED" | "ACCEPTED" | "REJECTED" | "COMPLETED";
  comment: string | null;
  created_at: string;
};

export type LearningProfile = {
  route_id: string | null;
  interest_ids: string[];
};

export type LearningAuditEntry = {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  sequence: number;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  reason: string;
  created_at: string;
};

export type CourseInput = Omit<LearningCourse, "id" | "status" | "created_at">;
export type OfferInput = Pick<
  LearningOffer,
  "course_id" | "title" | "cycles" | "interest_ids" | "relevance"
>;
export type WorkshopInput = Pick<
  LearningWorkshop,
  "offer_id" | "title" | "capacity" | "requirements"
>;
export type DecisionStatus =
  | LearningRoute["status"]
  | LearningCourse["status"]
  | LearningOffer["status"]
  | LearningWorkshop["status"]
  | LearningApplication["status"];

export const learningApi = {
  interests: () => apiFetch<LearningInterest[]>("/learning/interests"),
  routes: () => apiFetch<LearningRoute[]>("/learning/routes"),
  courses: () => apiFetch<LearningCourse[]>("/learning/courses"),
  offers: () => apiFetch<LearningOffer[]>("/learning/offers"),
  workshops: () => apiFetch<LearningWorkshop[]>("/learning/workshops"),
  profile: () => apiFetch<LearningProfile>("/learning/me/profile"),
  saveProfile: (profile: LearningProfile) =>
    apiFetch<LearningProfile>("/learning/me/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    }),
  myApplications: () =>
    apiFetch<LearningApplication[]>("/learning/me/applications"),
  apply: (workshop_id: string) =>
    apiFetch<LearningApplication>("/learning/me/applications", {
      method: "POST",
      body: JSON.stringify({ workshop_id, requirements_acknowledged: true }),
    }),
  adminApplications: () =>
    apiFetch<LearningApplication[]>("/learning/admin/applications"),
  audit: () => apiFetch<LearningAuditEntry[]>("/learning/admin/audit"),
  createCourse: (course: CourseInput) =>
    apiFetch<LearningCourse>("/learning/courses", {
      method: "POST",
      body: JSON.stringify(course),
    }),
  updateCourse: (id: string, course: CourseInput) =>
    apiFetch<LearningCourse>(`/learning/courses/${id}`, {
      method: "PUT",
      body: JSON.stringify(course),
    }),
  createOffer: (offer: OfferInput) =>
    apiFetch<LearningOffer>("/learning/offers", {
      method: "POST",
      body: JSON.stringify(offer),
    }),
  updateOffer: (id: string, offer: OfferInput) =>
    apiFetch<LearningOffer>(`/learning/offers/${id}`, {
      method: "PUT",
      body: JSON.stringify(offer),
    }),
  createWorkshop: (workshop: WorkshopInput) =>
    apiFetch<LearningWorkshop>("/learning/workshops", {
      method: "POST",
      body: JSON.stringify(workshop),
    }),
  setStatus: <T>(kind: "courses" | "offers" | "workshops", id: string, status: DecisionStatus, reason: string) =>
    apiFetch<T>(`/learning/${kind}/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    }),
  decideApplication: (id: string, status: LearningApplication["status"], reason: string) =>
    apiFetch<LearningApplication>(`/learning/admin/applications/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    }),
};

export function getLearningErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }
  return "No se pudo conectar con el servicio de formación. Inténtalo nuevamente.";
}

export function splitList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function formatLearningDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
