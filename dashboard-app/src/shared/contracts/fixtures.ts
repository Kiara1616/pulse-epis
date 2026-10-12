/** Synthetic examples only. No identity, session, permissions or evidence-access URL fixtures. */
import type { AnalyticsOverview, Certification } from "../api/types";
import { studentSummary } from "./adapters";
import {
  certificationStatuses,
  type PrototypeData,
  type ValidationQueueItem,
  type LoadState,
  type StudentSummary,
} from "./types";
export const fixtureAsOf = "2026-10-01";
export function certificationFixtures(): Certification[] {
  return certificationStatuses.map((status, index) => ({
    id: `DEMO-credential-${index}`,
    issuer_id: "DEMO-issuer",
    issuer_name: "Emisor sintético",
    issuer_url: null,
    credential_name: `Credencial sintética ${index + 1}`,
    external_id: null,
    issued_on: "2026-01-10",
    expires_on: status === "EXPIRED" ? "2026-09-01" : null,
    status,
    source_url: null,
    skills: [
      { id: "DEMO-skill", name: "Python (ejemplo)", level: "Fundamentals" },
    ],
    evidences:
      status === "UNDER_REVIEW"
        ? [
            {
              id: "DEMO-evidence",
              evidence_type: "FILE",
              source_url: null,
              original_filename: "evidencia-sintetica.pdf",
              content_type: "application/pdf",
              byte_size: 128,
              sha256: "0".repeat(64),
              retention_until: "2027-01-10T12:00:00Z",
              uploaded_at: "2026-09-25T12:00:00Z",
            },
          ]
        : [],
    created_at: "2026-01-10T12:00:00Z",
    updated_at: "2026-09-25T12:00:00Z",
    correction_allowed:
      status === "PENDING" || status === "OBSERVED" || status === "RESUBMITTED",
    latest_comment:
      status === "OBSERVED" ? "Ejemplo: adjunta una evidencia legible." : null,
  }));
}
export function validationFixtures(): ValidationQueueItem[] {
  return certificationFixtures()
    .filter((item) =>
      ["PENDING", "UNDER_REVIEW", "OBSERVED", "RESUBMITTED"].includes(
        item.status,
      ),
    )
    .map((item) => ({
      id: item.id,
      student_key: "DEMO-student-key",
      credential_name: item.credential_name,
      issuer_name: item.issuer_name,
      issued_on: item.issued_on,
      expires_on: item.expires_on,
      stored_status: item.status as ValidationQueueItem["status"],
      status: item.status as ValidationQueueItem["status"],
      source_url: null,
      evidences: item.evidences.map((e) => ({
        id: e.id,
        evidence_type: e.evidence_type,
        original_filename: e.original_filename,
        content_type: e.content_type,
      })),
      latest_comment: item.latest_comment ?? null,
      skills: item.skills.map((skill) => ({
        name: skill.name,
        level: skill.level,
      })),
      updated_at: item.updated_at,
    }));
}
export function analyticsFixture(): AnalyticsOverview {
  return {
    dataset: "demo",
    filters: {
      period_code: "2026-II",
      cutoff_date: fixtureAsOf,
      cohort: null,
      cycle: null,
      issuer: null,
      level: null,
    },
    kpis: {
      active_students: 10,
      certified_students: 3,
      coverage_percent: 30,
      approved_certifications: 4,
      expiring_soon: 0,
    },
    by_issuer: [{ name: "Emisor sintético", value: 4 }],
    by_level: [],
    by_cohort: [],
    by_cycle: [],
    by_skill: [{ name: "Python (ejemplo)", value: 4 }],
    by_credential: [],
    evolution: [
      {
        cutoff_date: fixtureAsOf,
        certified_students: 3,
        approved_certifications: 4,
      },
    ],
    skill_gaps: [
      {
        skill: "Python (ejemplo)",
        certified_students: 3,
        gap_students: 7,
        coverage_percent: 30,
      },
    ],
  };
}
export function prototypeFixtures(): PrototypeData {
  const courses: PrototypeData["courses"] = (
    ["DETECTED", "IN_REVIEW", "PUBLISHED", "DISCARDED", "RETIRED"] as const
  ).map((status, n) => ({
    id: `DEMO-course-${n}`,
    title: `Curso sintético ${n + 1}`,
    provider: "Proveedor de ejemplo",
    sourceUrl: `https://example.invalid/courses/${n}`,
    checkedOn: fixtureAsOf,
    requirements: ["Python básico (ejemplo)"],
    skillNames: ["Evaluación de modelos (ejemplo)"],
    status,
  }));
  return {
    interests: [
      {
        id: "DEMO-interest-ia",
        label: "Inteligencia artificial (ejemplo)",
        description: "Interés declarado; no acredita conocimientos.",
      },
    ],
    profile: {
      interestIds: ["DEMO-interest-ia"],
      objectiveId: "DEMO-route-ia",
    },
    routes: [
      {
        id: "DEMO-route-ia",
        title: "Desarrollo con IA (ejemplo)",
        description:
          "Ruta sintética; ausencia de evidencia no demuestra falta de conocimientos.",
        steps: [
          {
            id: "DEMO-step-1",
            title: "Fundamentos",
            skillNames: ["Python (ejemplo)"],
            prerequisites: [],
            evidenceRecorded: true,
          },
          {
            id: "DEMO-step-2",
            title: "Evaluación",
            skillNames: ["Evaluación de modelos (ejemplo)"],
            prerequisites: ["Fundamentos"],
            evidenceRecorded: false,
          },
        ],
      },
    ],
    courses,
    opportunities: [
      {
        id: "DEMO-opportunity",
        courseId: "DEMO-course-2",
        title: "Oportunidad sintética",
        audience: { cycles: ["V", "VI"], interestIds: ["DEMO-interest-ia"] },
        relevance:
          "Ejemplo para una ruta de IA; no es una recomendación institucional.",
        status: "PUBLISHED",
      },
    ],
    workshops: [
      {
        id: "DEMO-workshop",
        title: "Taller sintético",
        capacity: 20,
        prerequisites: ["Python básico"],
        status: "OPEN",
      },
    ],
    participations: (
      ["SUBMITTED", "ACCEPTED", "REJECTED", "COMPLETED"] as const
    ).map((status, index) => ({
      id: `DEMO-participation-${index}`,
      workshopId: "DEMO-workshop",
      status,
      comment:
        status === "REJECTED" ? "Ejemplo: revisar los requisitos." : null,
    })),
  };
}

/** UI scenarios for prototypes; never replace authentication or a real network error. */
export function studentStateFixtures(): Record<
  "loading" | "error" | "empty" | "ready",
  LoadState<StudentSummary>
> {
  return {
    loading: { status: "loading" },
    error: {
      status: "error",
      message: "Error sintético de carga",
      retryable: true,
    },
    empty: {
      status: "empty",
      message: "Ejemplo: aún no hay certificaciones registradas.",
    },
    ready: {
      status: "ready",
      result: {
        source: "SYNTHETIC",
        asOf: fixtureAsOf,
        data: studentSummary(certificationFixtures(), fixtureAsOf),
      },
    },
  };
}
