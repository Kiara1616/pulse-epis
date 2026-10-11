export type CourseDemo = {
  id: string;
  title: string;
  provider: string;
  sourceUrl: string;
  checkedOn: string;
  requirements: string[];
  status: "DETECTED" | "IN_REVIEW" | "PUBLISHED" | "DISCARDED" | "RETIRED";
  audience: string[];
  relevance: string;
  history: string[];
};
export const labels = {
  DETECTED: "Detectado",
  IN_REVIEW: "En revisión",
  PUBLISHED: "Publicado",
  DISCARDED: "Descartado",
  RETIRED: "Retirado",
};
export function demoCourses(): CourseDemo[] {
  return ["Fundamentos de IA", "Aplicaciones con IA", "Análisis de datos"].map(
    (title, n) => ({
      id: `DEMO-course-${n}`,
      title: `${title} — ejemplo`,
      provider: "Proveedor sintético",
      sourceUrl: `https://example.invalid/course/${n}`,
      checkedOn: "2026-10-01",
      requirements: [n ? "Python básico" : "Sin requisitos previos"],
      status: "DETECTED",
      audience: [],
      relevance: "",
      history: ["Detección sintética; no se realizó recolección externa."],
    }),
  );
}
