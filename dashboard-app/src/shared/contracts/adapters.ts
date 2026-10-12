import type { AnalyticsOverview, Certification } from "../api/types";
import {
  certificationStatuses,
  type DisplayStatus,
  type StudentSummary,
  type ValidationQueueItem,
  type ValidationCard,
  type AdminIndicators,
} from "./types";

export function displayStatus(value: string): DisplayStatus {
  return certificationStatuses.find((status) => status === value) ?? "UNKNOWN";
}
/** status and correction_allowed come from the API; do not recalculate permission or expiry. */
export function studentSummary(
  items: Certification[],
  asOf: string,
): StudentSummary {
  const credentials = items.map((item) => ({
    id: item.id,
    title: item.credential_name,
    issuer: item.issuer_name,
    status: displayStatus(item.status),
    rawStatus: item.status,
    issuedOn: item.issued_on,
    expiresOn: item.expires_on,
    comment: item.latest_comment ?? null,
    canCorrect:
      item.correction_allowed &&
      ["PENDING", "OBSERVED", "RESUBMITTED"].includes(item.status),
    evidenceCount: item.evidences.length,
  }));
  const count = (...statuses: DisplayStatus[]) =>
    credentials.filter((item) => statuses.includes(item.status)).length;
  return {
    asOf,
    total: credentials.length,
    approved: count("APPROVED"),
    pending: count("PENDING", "UNDER_REVIEW", "RESUBMITTED"),
    observed: count("OBSERVED"),
    rejected: count("REJECTED"),
    expired: count("EXPIRED"),
    unknown: count("UNKNOWN"),
    credentials,
    correctionIds: credentials
      .filter((item) => item.status === "OBSERVED" && item.canCorrect)
      .map((item) => item.id),
  };
}
export function validationCards(
  items: ValidationQueueItem[],
): ValidationCard[] {
  return items.map((item) => ({
    id: item.id,
    title: item.credential_name,
    issuer: item.issuer_name,
    studentKey: item.student_key,
    status: displayStatus(item.status),
    updatedAt: item.updated_at,
    comment: item.latest_comment,
    evidenceCount: item.evidences.length,
  }));
}
export function adminIndicators(overview: AnalyticsOverview): AdminIndicators {
  return {
    period: overview.filters.period_code,
    cutoff: overview.filters.cutoff_date,
    dataset: overview.dataset ?? "unspecified",
    kpis: { ...overview.kpis },
    gaps: overview.skill_gaps.map((item) => ({ ...item })),
  };
}
