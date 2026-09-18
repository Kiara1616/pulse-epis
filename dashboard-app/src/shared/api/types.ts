export type AppRole = "ADMIN" | "VALIDATOR" | "STUDENT";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: AppRole;
  student_id: string | null;
  permissions: string[];
};

export type AnalyticsMetric = {
  name: string;
  value: number;
};

export type AnalyticsPeriod = {
  code: string;
  starts_on: string;
  ends_on: string;
  latest_cutoff_date: string;
};

export type AnalyticsFilters = {
  period_code: string;
  cutoff_date: string;
  cohort: string;
  cycle: string;
  issuer: string;
  level: string;
};

export type AnalyticsOverview = {
  filters: {
    period_code: string;
    cutoff_date: string;
    cohort: string | null;
    cycle: string | null;
    issuer: string | null;
    level: string | null;
  };
  kpis: {
    active_students: number;
    certified_students: number;
    coverage_percent: number;
    approved_certifications: number;
    expiring_soon: number;
  };
  by_issuer: AnalyticsMetric[];
  by_level: AnalyticsMetric[];
  by_cohort: AnalyticsMetric[];
  by_cycle: AnalyticsMetric[];
  by_skill: AnalyticsMetric[];
  evolution: Array<{
    cutoff_date: string;
    certified_students: number;
    approved_certifications: number;
  }>;
  skill_gaps: Array<{
    skill: string;
    certified_students: number;
    gap_students: number;
    coverage_percent: number;
  }>;
};

export type CertificationEvidence = {
  id: string;
  evidence_type: "URL" | "FILE";
  source_url: string | null;
  original_filename: string | null;
  content_type: string | null;
  byte_size: number | null;
  sha256: string;
  retention_until: string;
  uploaded_at: string;
};

export type Certification = {
  id: string;
  issuer_id: string;
  issuer_name: string;
  issuer_url: string | null;
  credential_name: string;
  external_id: string | null;
  issued_on: string;
  expires_on: string | null;
  status: string;
  source_url: string | null;
  skills: Array<{ id: string; name: string; level: string | null }>;
  evidences: CertificationEvidence[];
  created_at: string;
  updated_at: string;
  correction_allowed: boolean;
};

export type RosterImport = {
  id: string;
  period_code: string;
  status: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  created_at: string;
  completed_at: string | null;
};
