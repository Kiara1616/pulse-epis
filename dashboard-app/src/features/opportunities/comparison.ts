export type ComparisonCourse = {
  id: string;
  skills: string[];
  cost_pen: number | null;
};
export function compareCourses(
  courses: ComparisonCourse[],
  objectives: string[],
  participants: string,
  budget: string,
) {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("es-PE");
  const requested = [...new Set(objectives.map(normalize).filter(Boolean))];
  const frequencies = new Map<string, number>();
  for (const course of courses)
    for (const skill of new Set(course.skills.map(normalize)))
      frequencies.set(skill, (frequencies.get(skill) ?? 0) + 1);
  const missing = requested.filter((skill) => !frequencies.has(skill));
  const overlap = [...frequencies]
    .filter(([, count]) => count > 1)
    .map(([skill]) => skill);
  const knownPerPerson =
    Math.round(
      courses.reduce((sum, course) => sum + (course.cost_pen ?? 0), 0) * 100,
    ) / 100;
  const unknownCosts = courses.filter(
    (course) => course.cost_pen === null,
  ).length;
  const count = Number(participants);
  const validCount =
    participants.trim() !== "" &&
    Number.isSafeInteger(count) &&
    count > 0 &&
    count <= 10000;
  const limit = Number(budget);
  const validBudget =
    budget.trim() !== "" &&
    Number.isFinite(limit) &&
    limit >= 0 &&
    limit <= 10000000000;
  const subtotal =
    courses.length && validCount
      ? Math.round(knownPerPerson * count * 100) / 100
      : null;
  const total = unknownCosts ? null : subtotal;
  const budgetState =
    subtotal === null || !validBudget
      ? "UNSET"
      : subtotal > limit
        ? "OVER"
        : unknownCosts
          ? "UNKNOWN"
          : "WITHIN";
  return {
    requested,
    missing,
    overlap,
    skills: [...frequencies.keys()],
    knownPerPerson,
    unknownCosts,
    validCount,
    validBudget,
    subtotal,
    total,
    budgetState,
  };
}
