import type { AnalyticsOverview } from "@/shared/api/types";
export function indicatorLink(path: string, overview: AnalyticsOverview) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(overview.filters))
    if (value !== null && value !== "") query.set(key, value);
  if (overview.dataset) query.set("dataset", overview.dataset);
  return `${path}?${query.toString()}`;
}
export function rankedGaps(overview: AnalyticsOverview) {
  return overview.skill_gaps
    .filter((item) => item.gap_students > 0)
    .toSorted(
      (a, b) =>
        a.coverage_percent - b.coverage_percent ||
        b.gap_students - a.gap_students ||
        a.skill.localeCompare(b.skill, "es"),
    )
    .slice(0, 3);
}
export type QualityRun = {
  id: string;
  period_code: string;
  cutoff_date: string;
  status: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  duplicate_rows?: number;
};
/** API history is ordered by creation descending: first matching cutoff is latest attempt for that cutoff. */
export function qualityAtCutoff(
  runs: QualityRun[],
  period: string,
  cutoff: string,
) {
  return (
    runs.find(
      (run) => run.period_code === period && run.cutoff_date === cutoff,
    ) ?? null
  );
}
