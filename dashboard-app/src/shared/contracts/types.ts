/** VA-02 view contracts; provisional entities are not backend endpoints. */
import type {
  AnalyticsOverview,
  Certification,
  CertificationEvidence,
} from "../api/types";
export const certificationStatuses = [
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "OBSERVED",
  "RESUBMITTED",
  "REJECTED",
  "EXPIRED",
] as const;
export type CertificationStatus = (typeof certificationStatuses)[number];
export type DisplayStatus = CertificationStatus | "UNKNOWN";
export const certificationLabels: Record<DisplayStatus, string> = {
  PENDING: "Pendiente",
  UNDER_REVIEW: "En revisión",
  APPROVED: "Aprobada",
  OBSERVED: "Observada",
  RESUBMITTED: "Reenviada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
  UNKNOWN: "Estado no reconocido",
};
export type DataResult<T> = {
  source: "API" | "SYNTHETIC";
  asOf: string;
  data: T;
};
export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string; retryable: boolean }
  | { status: "empty"; message: string }
  | { status: "ready"; result: DataResult<T> };
export type StudentCredential = {
  id: string;
  title: string;
  issuer: string;
  status: DisplayStatus;
  rawStatus: string;
  issuedOn: string;
  expiresOn: string | null;
  comment: string | null;
  canCorrect: boolean;
  evidenceCount: number;
};
export type StudentSummary = {
  asOf: string;
  total: number;
  approved: number;
  pending: number;
  observed: number;
  rejected: number;
  expired: number;
  unknown: number;
  credentials: StudentCredential[];
  correctionIds: string[];
};
export type ValidationQueueItem = {
  id: string;
  student_key: string;
  credential_name: string;
  issuer_name: string;
  issued_on: string;
  expires_on: string | null;
  stored_status: CertificationStatus;
  status: CertificationStatus;
  source_url: string | null;
  evidences: Pick<
    CertificationEvidence,
    "id" | "evidence_type" | "original_filename" | "content_type"
  >[];
  latest_comment: string | null;
  external_id?: string | null;
  issuer_url?: string | null;
  skills: Array<{ name: string; level: string | null }>;
  updated_at: string;
};
export type ValidationCard = {
  id: string;
  title: string;
  issuer: string;
  studentKey: string;
  status: DisplayStatus;
  updatedAt: string;
  comment: string | null;
  evidenceCount: number;
};
export type AdminIndicators = {
  period: string;
  cutoff: string;
  dataset: "registered" | "demo" | "unspecified";
  kpis: AnalyticsOverview["kpis"];
  gaps: AnalyticsOverview["skill_gaps"];
};

// These contracts are provisional until VA-11/VA-12 define persistence and authorization.
export type InterestOption = { id: string; label: string; description: string };
export type InterestProfile = {
  interestIds: string[];
  objectiveId: string | null;
};
export type LearningStep = {
  id: string;
  title: string;
  skillNames: string[];
  prerequisites: string[];
  evidenceRecorded: boolean;
};
export type LearningRoute = {
  id: string;
  title: string;
  description: string;
  steps: LearningStep[];
};
export type CourseStatus =
  | "DETECTED"
  | "IN_REVIEW"
  | "PUBLISHED"
  | "DISCARDED"
  | "RETIRED";
export type CourseCandidate = {
  id: string;
  title: string;
  provider: string;
  sourceUrl: string;
  checkedOn: string;
  requirements: string[];
  skillNames: string[];
  status: CourseStatus;
};
export type Opportunity = {
  id: string;
  courseId: string;
  title: string;
  audience: { cycles: string[]; interestIds: string[] };
  relevance: string;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
};
export type Workshop = {
  id: string;
  title: string;
  capacity: number;
  prerequisites: string[];
  status: "DRAFT" | "OPEN" | "CLOSED" | "COMPLETED";
};
export type Participation = {
  id: string;
  workshopId: string;
  status: "SUBMITTED" | "ACCEPTED" | "REJECTED" | "COMPLETED";
  comment: string | null;
};
export type PrototypeData = {
  interests: InterestOption[];
  profile: InterestProfile;
  routes: LearningRoute[];
  courses: CourseCandidate[];
  opportunities: Opportunity[];
  workshops: Workshop[];
  participations: Participation[];
};
export type ApiCertification = Certification;
