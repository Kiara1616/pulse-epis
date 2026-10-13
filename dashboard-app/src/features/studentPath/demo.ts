export const pathInterests = [
  { id: "cloud", label: "Cloud e infraestructura" },
  { id: "data", label: "Datos e inteligencia artificial" },
  { id: "software", label: "Desarrollo de software" },
  { id: "security", label: "Ciberseguridad" },
] as const;

export type PathInterestId = (typeof pathInterests)[number]["id"];

export const pathObjectives = [
  { id: "internship", label: "Prepararme para prácticas" },
  { id: "certification", label: "Obtener una certificación" },
  { id: "specialize", label: "Especializarme en el área" },
] as const;

export type PathObjectiveId = (typeof pathObjectives)[number]["id"];

export type PathRequirement = {
  id: string;
  title: string;
  detail: string;
  evidenceExample: string | null;
};

export type PathStep = {
  id: string;
  title: string;
  detail: string;
  duration: string;
  state: "DEMO_EVIDENCE" | "NEXT" | "UPCOMING";
};

export type StudentPath = {
  title: string;
  summary: string;
  objective: string;
  target: string;
  focusAreas: string[];
  progress: { supported: number; total: number };
  requirements: PathRequirement[];
  steps: PathStep[];
};

type InterestTemplate = {
  area: string;
  focus: string;
  target: string;
  requirements: Array<{ title: string; detail: string }>;
  exampleEvidence: string;
  project: string;
};

const interestTemplates: Record<PathInterestId, InterestTemplate> = {
  cloud: {
    area: "Cloud e infraestructura",
    focus: "servicios en la nube",
    target: "AWS Cloud Practitioner",
    requirements: [
      { title: "Fundamentos de cloud", detail: "Conceptos de nube, regiones y modelos de servicio." },
      { title: "Redes", detail: "Direcciones IP, DNS, subredes y conectividad." },
      { title: "Seguridad básica", detail: "Identidad, permisos y prácticas de protección." },
      { title: "Despliegue", detail: "Publicación y monitoreo de una aplicación sencilla." },
    ],
    exampleEvidence: "Cloud Essentials (credencial sintética)",
    project: "Despliega una aplicación web de ejemplo",
  },
  data: {
    area: "Datos e inteligencia artificial",
    focus: "análisis de datos",
    target: "certificación inicial de análisis de datos",
    requirements: [
      { title: "Consulta de datos", detail: "Consultas SQL, filtros y agrupaciones." },
      { title: "Preparación", detail: "Limpieza, transformación y validación de datos." },
      { title: "Análisis", detail: "Estadística descriptiva e interpretación de resultados." },
      { title: "Comunicación", detail: "Visualización y presentación de hallazgos." },
    ],
    exampleEvidence: "Introducción a SQL (credencial sintética)",
    project: "Analiza un conjunto de datos público de ejemplo",
  },
  software: {
    area: "Desarrollo de software",
    focus: "construcción de aplicaciones",
    target: "certificación inicial de desarrollo de software",
    requirements: [
      { title: "Fundamentos de programación", detail: "Estructuras, funciones y resolución de problemas." },
      { title: "Control de versiones", detail: "Git, ramas y colaboración mediante revisiones." },
      { title: "Pruebas", detail: "Pruebas automatizadas y depuración básica." },
      { title: "Despliegue", detail: "Publicación de una aplicación y documentación." },
    ],
    exampleEvidence: "Fundamentos de programación (credencial sintética)",
    project: "Construye una aplicación pequeña y publícala",
  },
  security: {
    area: "Ciberseguridad",
    focus: "seguridad informática",
    target: "certificación inicial de ciberseguridad",
    requirements: [
      { title: "Redes y sistemas", detail: "Protocolos, sistemas operativos y controles básicos." },
      { title: "Gestión de riesgos", detail: "Identificación de activos, amenazas y vulnerabilidades." },
      { title: "Protección", detail: "Control de acceso, cifrado y buenas prácticas." },
      { title: "Respuesta", detail: "Registro, análisis y comunicación de incidentes." },
    ],
    exampleEvidence: "Fundamentos de redes (credencial sintética)",
    project: "Documenta un laboratorio seguro de práctica",
  },
};

const objectiveTemplates: Record<
  PathObjectiveId,
  { label: string; finalStep: string; finalDetail: string }
> = {
  internship: {
    label: "Prepararme para prácticas",
    finalStep: "Prepara una presentación de tu proyecto",
    finalDetail: "Resume el problema, tu solución y lo que aprendiste.",
  },
  certification: {
    label: "Obtener una certificación",
    finalStep: "Resuelve una práctica de evaluación",
    finalDetail: "Identifica los temas que quieres repasar antes del examen.",
  },
  specialize: {
    label: "Especializarme en el área",
    finalStep: "Amplía el proyecto con un caso aplicado",
    finalDetail: "Elige un problema del área y documenta tu propuesta.",
  },
};

/** Demo adapter shape that can later be replaced by the student-path API. */
export function buildDemoStudentPath(
  primaryInterest: PathInterestId,
  additionalInterests: PathInterestId[],
  objectiveId: PathObjectiveId,
): StudentPath {
  const template = interestTemplates[primaryInterest];
  const objective = objectiveTemplates[objectiveId];
  const selectedAreas = [primaryInterest, ...additionalInterests];
  const complementaryRequirements = additionalInterests.map((interestId) => {
    const complementary = interestTemplates[interestId];
    return {
      id: `${interestId}-complementary-requirement`,
      title: `Explora la conexión con ${complementary.area.toLowerCase()}`,
      detail: complementary.requirements[0].detail,
      evidenceExample: null,
    };
  });
  const requirements: PathRequirement[] = [
    ...template.requirements.map((requirement, index) => ({
      id: `${primaryInterest}-requirement-${index + 1}`,
      ...requirement,
      evidenceExample: index === 0 ? template.exampleEvidence : null,
    })),
    ...complementaryRequirements,
  ];
  const complementaryLabels = additionalInterests.map(
    (interestId) => interestTemplates[interestId].area,
  );

  return {
    title: `Ruta de ${template.area.toLowerCase()}`,
    summary: complementaryLabels.length
      ? `Una secuencia de ejemplo para avanzar en ${template.focus} y explorar ${complementaryLabels.join(" y ").toLowerCase()}.`
      : `Una secuencia de ejemplo para avanzar en ${template.focus}.`,
    objective: objective.label,
    target: template.target,
    focusAreas: selectedAreas.map((id) => interestTemplates[id].area),
    progress: { supported: 1, total: requirements.length },
    requirements,
    steps: [
      {
        id: "foundation",
        title: `Revisa los fundamentos de ${template.focus}`,
        detail: "La evidencia mostrada es un ejemplo ficticio incluido en esta demostración.",
        duration: "1 semana",
        state: "DEMO_EVIDENCE",
      },
      {
        id: "practice",
        title: template.project,
        detail: "Aplica los conceptos y guarda el resultado como parte de tu portafolio.",
        duration: "2–3 semanas",
        state: "NEXT",
      },
      {
        id: "credential",
        title: `Explora ${template.target}`,
        detail: "Revisa los requisitos de referencia y los temas que cubre.",
        duration: "3 semanas",
        state: "UPCOMING",
      },
      {
        id: "goal",
        title: objective.finalStep,
        detail: objective.finalDetail,
        duration: "1 semana",
        state: "UPCOMING",
      },
    ],
  };
}
