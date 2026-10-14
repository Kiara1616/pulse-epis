import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const period = {
  code: "2025-II",
  starts_on: "2025-08-01",
  ends_on: "2025-12-31",
  latest_cutoff_date: "2025-12-31",
};
const latestPeriod = {
  code: "2026-II",
  starts_on: "2026-08-17",
  ends_on: "2026-12-18",
  latest_cutoff_date: "2026-10-10",
};

const directory = {
  dataset: "demo",
  reference_label: "Datos de referencia · no oficiales",
  period_code: "2025-II",
  cutoff_date: "2025-12-31",
  total: 1,
  items: [
    {
      id: "reference-student-kz",
      code: "KZ2023077087",
      display_name: "Cuenta KZ",
      email: "kz2023077087@virtual.upt.pe",
      cycle: "VI",
      cohort: "2023",
      status: "ACTIVE",
      certifications: [
        {
          id: "credential-kz-2025-ii",
          issuer: "AWS",
          credential_name: "AWS Certified Cloud Practitioner",
          issued_on: "2025-09-01",
          expires_on: "2028-09-01",
          status: "APPROVED",
          skills: [{ name: "Cloud Computing", level: "Foundational" }],
          traceability: {
            source: "EXAMPLE",
            student: {
              role: "STUDENT",
              action: "Evento de ejemplo: registro asociado al perfil académico",
              date: "2025-09-01",
            },
            validator: {
              role: "VALIDATOR",
              action: "Evento de ejemplo: certificación aprobada",
              date: "2025-09-08",
            },
            administrator: {
              role: "ADMIN",
              action: "Evento de ejemplo: incluida en el corte de indicadores",
              date: "2025-12-31",
            },
          },
        },
      ],
    },
  ],
};

const overview = {
  dataset: "demo",
  filters: {
    period_code: "2025-II",
    cutoff_date: "2025-12-31",
    cohort: null,
    cycle: null,
    issuer: null,
    level: null,
  },
  kpis: {
    active_students: 342,
    certified_students: 100,
    coverage_percent: 29.24,
    approved_certifications: 120,
    expiring_soon: 4,
  },
  by_issuer: [{ name: "AWS", value: 120 }],
  by_level: [],
  by_cohort: [{ name: "2023", value: 120 }],
  by_cycle: [{ name: "VI", value: 120 }],
  by_skill: [{ name: "Cloud Computing", value: 120 }],
  by_credential: [{ name: "AWS Certified Cloud Practitioner", value: 120 }],
  evolution: [{ cutoff_date: "2025-12-31", certified_students: 100, approved_certifications: 120 }],
  skill_gaps: [{ skill: "Cloud Computing", certified_students: 100, gap_students: 242, coverage_percent: 29.24 }],
};

const validationReferences = {
  dataset: "demo",
  reference_label: "Datos de referencia · no oficiales",
  period_code: "2026-II",
  cutoff_date: "2026-10-10",
  total_students: 360,
  students_with_certifications: 2,
  total_certifications: 2,
  items: [
    {
      student_key: "reference-student-kz",
      student_code: "KZ2023077087",
      display_name: "Cuenta KZ",
      email: "kz2023077087@virtual.upt.pe",
      cycle: "VI",
      cohort: "2023",
      certifications: [
        {
          ...directory.items[0].certifications[0],
          id: "credential-kz-2026-ii",
          issued_on: "2026-09-01",
          expires_on: "2029-09-01",
          traceability: {
            source: "EXAMPLE",
            student: {
              role: "STUDENT",
              action: "Evento de ejemplo: registro asociado al perfil académico",
              date: "2026-09-01",
            },
            validator: {
              role: "VALIDATOR",
              action: "Evento de ejemplo: certificación aprobada",
              date: "2026-09-08",
            },
            administrator: {
              role: "ADMIN",
              action: "Evento de ejemplo: incluida en el corte de indicadores",
              date: "2026-10-10",
            },
          },
        },
      ],
    },
    {
      student_key: "reference-student-vl",
      student_code: "VL2023076796",
      display_name: "Cuenta VL",
      email: "vl2023076796@virtual.upt.pe",
      cycle: "VI",
      cohort: "2023",
      certifications: [
        {
          ...directory.items[0].certifications[0],
          id: "credential-vl-2026-ii",
          credential_name: "Microsoft Certified: Azure Fundamentals",
          issued_on: "2026-09-03",
          expires_on: "2029-09-03",
          traceability: {
            source: "EXAMPLE",
            student: {
              role: "STUDENT",
              action: "Evento de ejemplo: registro asociado al perfil académico",
              date: "2026-09-03",
            },
            validator: {
              role: "VALIDATOR",
              action: "Evento de ejemplo: certificación aprobada",
              date: "2026-09-10",
            },
            administrator: {
              role: "ADMIN",
              action: "Evento de ejemplo: incluida en el corte de indicadores",
              date: "2026-10-10",
            },
          },
        },
      ],
    },
  ],
};

async function mockSession(page: Page, role: "ADMIN" | "VALIDATOR" | "STUDENT") {
  await page.route("**/api/v1/auth/config", (route) =>
    route.fulfill({ json: { provider: "google" } }),
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "reference-user",
        email:
          role === "STUDENT"
            ? "kz2023077087@virtual.upt.pe"
            : role === "VALIDATOR"
              ? "validator@virtual.upt.pe"
              : "admin@virtual.upt.pe",
        role,
        permissions: [],
        student_id: role === "STUDENT" ? "reference-student-kz" : null,
      },
    }),
  );
}

test("admin puede reintentar la carga inicial de periodos y ver la procedencia", async ({ page }) => {
  await mockSession(page, "ADMIN");
  await page.route("**/api/v1/indicators/config", (route) =>
    route.fulfill({ json: { reference_available: true, default_dataset: "demo" } }),
  );

  let allowPeriodLoad = false;
  let failedPeriodRequests = 0;
  await page.route("**/api/v1/indicators/periods**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("dataset") === "demo" && !allowPeriodLoad) {
      failedPeriodRequests += 1;
      return route.fulfill({
        status: 503,
        json: { detail: { code: "ANALYTICS_UNAVAILABLE", message: "No se pudieron cargar los periodos." } },
      });
    }
    return route.fulfill({ json: [period] });
  });
  await page.route("**/api/v1/indicators/reference/students**", (route) =>
    route.fulfill({ json: directory }),
  );
  await page.route("**/api/v1/indicators/overview**", (route) =>
    route.fulfill({ json: overview }),
  );
  await page.route("**/api/v1/indicators/enrollment-history", (route) =>
    route.fulfill({ json: [{ period_code: "2025-II", active_students: 342, basis: "history" }] }),
  );
  await page.route("**/api/v1/etl/runs**", (route) => route.fulfill({ json: [] }));

  await page.goto("/estudiantes");
  await expect(page.getByRole("heading", { name: "Estudiantes y certificaciones" })).toBeVisible();
  await expect(page.locator('p[role="alert"]')).toContainText("No se pudieron cargar los periodos.");
  expect(failedPeriodRequests).toBeGreaterThan(0);

  allowPeriodLoad = true;
  await page.getByRole("button", { name: "Actualizar" }).click();
  await expect(page.getByText("Cuenta KZ", { exact: true })).toBeVisible();
  await expect(page.getByText("Datos de referencia · no oficiales").first()).toBeVisible();
  await page.getByText("AWS Certified Cloud Practitioner").click();
  await expect(page.getByText("Evento de ejemplo").first()).toBeVisible();
  await expect(page.getByText("certificación aprobada").first()).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("button", { name: "CSV" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("La exportación CSV no produjo un archivo.");
  const csv = await readFile(downloadPath, "utf8");
  expect(csv).toContain("# Fuente de datos: Datos de referencia · no oficiales · indicadores agregados");

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Centro de administración" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Estudiantes y certificaciones" })).toBeVisible();
});

test("el validador consulta las certificaciones KZ y VL con su trazabilidad", async ({ page }) => {
  await mockSession(page, "VALIDATOR");
  await page.route("**/api/v1/indicators/config", (route) =>
    route.fulfill({ json: { reference_available: true, default_dataset: "demo" } }),
  );
  await page.route("**/api/v1/indicators/periods**", (route) =>
    route.fulfill({ json: [latestPeriod, period] }),
  );
  await page.route("**/api/v1/validations", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/validations/reference**", (route) =>
    route.fulfill({ json: validationReferences }),
  );

  await page.goto("/validaciones");
  const referencePanel = page.getByRole("region", {
    name: "Certificaciones de referencia para consulta",
  });
  await expect(referencePanel).toBeVisible();
  await expect(referencePanel.getByLabel("Periodo")).toHaveValue("2026-II");
  await expect(referencePanel.getByText("Cuenta KZ", { exact: true })).toBeVisible();
  await expect(referencePanel.getByText("Cuenta VL", { exact: true })).toBeVisible();
  await expect(referencePanel.getByText("Datos de referencia · no oficiales")).toBeVisible();
  await referencePanel.getByText("AWS Certified Cloud Practitioner").click();
  await expect(referencePanel.getByText("Evento de ejemplo").first()).toBeVisible();
  await expect(referencePanel.getByText("Validador").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprobar" })).toHaveCount(0);
});

test("el validador conserva su bandeja cuando los datos de referencia están deshabilitados", async ({ page }) => {
  await mockSession(page, "VALIDATOR");
  await page.route("**/api/v1/indicators/config", (route) =>
    route.fulfill({ json: { reference_available: false, default_dataset: "registered" } }),
  );

  let demoPeriodRequests = 0;
  let referenceValidationRequests = 0;
  let operationalQueueRequests = 0;
  await page.route("**/api/v1/indicators/periods**", (route) => {
    if (new URL(route.request().url()).searchParams.get("dataset") === "demo") {
      demoPeriodRequests += 1;
    }
    return route.fulfill({ json: [period] });
  });
  await page.route("**/api/v1/validations/reference**", (route) => {
    referenceValidationRequests += 1;
    return route.fulfill({ json: validationReferences });
  });
  await page.route("**/api/v1/validations", (route) => {
    operationalQueueRequests += 1;
    return route.fulfill({
      json: [
        {
          id: "operational-validation-1",
          student_key: "student-2024-001",
          credential_name: "AWS Certified Cloud Practitioner",
          issuer_name: "AWS",
          issued_on: "2026-09-01",
          expires_on: null,
          stored_status: "PENDING",
          status: "PENDING",
          evidences: [],
          latest_comment: null,
          source_url: null,
          updated_at: "2026-09-01T12:00:00Z",
        },
      ],
    });
  });

  await page.goto("/validaciones");

  await expect(page.getByRole("heading", { name: "Bandeja de validaciones" })).toBeVisible();
  await expect(page.getByRole("button", { name: /AWS Certified Cloud Practitioner/ })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Certificaciones de referencia para consulta" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/REFERENCE_DISABLED|Los datos de referencia no están habilitados/),
  ).toHaveCount(0);
  expect(operationalQueueRequests).toBe(1);
  expect(demoPeriodRequests).toBe(0);
  expect(referenceValidationRequests).toBe(0);
});

test("la pantalla nominal de referencia está restringida al rol estudiante en su propio espacio", async ({ page }) => {
  await mockSession(page, "STUDENT");
  await page.goto("/estudiantes");
  await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver a mi espacio" })).toHaveAttribute("href", "/mi-perfil");
});
