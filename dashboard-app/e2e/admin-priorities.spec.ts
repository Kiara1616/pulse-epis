import { test, expect, type Page } from "@playwright/test";
import { indicatorLink, rankedGaps, qualityAtCutoff } from "../src/features/admin/priorities";

const overview = {
  dataset: "registered" as const,
  filters: {
    period_code: "2026-II",
    cutoff_date: "2026-10-01",
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
    expiring_soon: 1,
  },
  by_issuer: [{ name: "Emisor sintético", value: 4 }],
  by_level: [],
  by_cohort: [{ name: "2024", value: 4 }],
  by_cycle: [{ name: "VI", value: 4 }],
  by_skill: [{ name: "Python", value: 4 }],
  by_credential: [],
  evolution: [],
  skill_gaps: [
    { skill: "Python", certified_students: 3, gap_students: 7, coverage_percent: 30 },
    { skill: "Datos", certified_students: 1, gap_students: 9, coverage_percent: 10 },
  ],
};

const run = {
  id: "run-1",
  period_code: "2026-II",
  cutoff_date: "2026-10-01",
  status: "REJECTED",
  total_rows: 6,
  accepted_rows: 0,
  rejected_rows: 2,
};

async function mock(page: Page, role = "ADMIN") {
  await page.route("**/api/v1/auth/config", (route) =>
    route.fulfill({ json: { provider: "google" } }),
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "user-1",
        email: "user@example.invalid",
        role,
        permissions: [],
        student_id: null,
      },
    }),
  );
  await page.route("**/api/v1/indicators/periods**", (route) =>
    route.fulfill({
      json: [
        {
          code: "2026-II",
          starts_on: "2026-08-01",
          ends_on: "2026-12-31",
          latest_cutoff_date: "2026-10-01",
        },
      ],
    }),
  );
  await page.route("**/api/v1/indicators/overview**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const filters = {
      ...overview.filters,
      cycle: params.get("cycle"),
      issuer: params.get("issuer"),
      cohort: params.get("cohort"),
      cutoff_date: params.get("cutoff_date") ?? "2026-10-01",
    };
    return route.fulfill({
      json: {
        ...overview,
        filters,
        kpis: { ...overview.kpis, active_students: filters.cycle ? 5 : 10 },
      },
    });
  });
}

test("admin muestra el resumen publicado y módulos sin secciones demo", async ({ page }) => {
  await mock(page);
  await page.goto("/admin");

  await expect(
    page.getByRole("region", { name: "Indicadores institucionales" }),
  ).toContainText("Estudiantes activos");
  await expect(page.getByRole("region", { name: "Prioridades institucionales" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Calidad de datos" })).toHaveCount(0);
  await expect(page.getByText("Fuente y corte", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Datos de demostración|Datos de referencia/)).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Periodo", exact: true })).toHaveValue("2026-II");
  await expect(page.getByLabel("Fecha de los datos", { exact: true })).toHaveValue("2026-10-01");

  const modules = page.getByRole("region", { name: "Gestión administrativa" });
  await expect(modules.getByRole("link", { name: /Certificaciones/ })).toHaveAttribute(
    "href",
    "/tecnologias",
  );
  const radar = modules.getByRole("link", { name: /Radar de cursos/ });
  await expect(radar).toHaveAttribute("href", "/admin/radar");
  await expect(radar).toContainText("Catálogo de cursos");
});

for (const linked of [
  { key: "cycle", label: "Ciclo", selected: "VI", alternative: "VII", field: "by_cycle" },
  { key: "cohort", label: "Año de ingreso", selected: "2024", alternative: "2025", field: "by_cohort" },
  { key: "issuer", label: "Proveedor", selected: "Emisor sintético", alternative: "Otro emisor sintético", field: "by_issuer" },
])
  test(`enlace con ${linked.key} conserva selección y permite otra opción`, async ({ page }) => {
    await mock(page);
    const requests: URLSearchParams[] = [];
    await page.route("**/api/v1/indicators/overview**", (route) => {
      const params = new URL(route.request().url()).searchParams;
      requests.push(params);
      const selection = params.get(linked.key);
      return route.fulfill({
        json: {
          ...overview,
          filters: { ...overview.filters, [linked.key]: selection },
          [linked.field]: selection
            ? [{ name: selection, value: 4 }]
            : [
                { name: linked.selected, value: 4 },
                { name: linked.alternative, value: 2 },
              ],
        },
      });
    });
    const query = new URLSearchParams({
      period_code: "2026-II",
      cutoff_date: "2026-10-01",
      dataset: "registered",
      [linked.key]: linked.selected,
    });
    await page.goto(`/brechas?${query}`);
    const select = page.getByLabel(linked.label, { exact: true });
    await expect(select).toHaveValue(linked.selected);
    await expect(select.locator("option")).toHaveText([
      "Todos",
      linked.selected,
      linked.alternative,
    ]);
    expect(
      requests.some(
        (params) =>
          params.get("period_code") === "2026-II" &&
          params.get("cutoff_date") === "2026-10-01" &&
          !params.has("dataset"),
      ),
    ).toBe(true);
    const updated = page.waitForResponse((response) =>
      response.url().includes("/indicators/overview?") &&
      new URL(response.url()).searchParams.get(linked.key) === linked.alternative,
    );
    await select.selectOption(linked.alternative);
    await updated;
    await expect(select).toHaveValue(linked.alternative);
  });

test("fallo al cargar opciones permite reintentar sin perder el ciclo enlazado", async ({ page }) => {
  await mock(page);
  let fail = true;
  await page.route("**/api/v1/indicators/overview**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill(
      !params.has("cycle") && fail
        ? { status: 503, json: { error: { message: "Opciones no disponibles" } } }
        : {
            json: {
              ...overview,
              by_cycle: [
                { name: "VI", value: 4 },
                { name: "VII", value: 2 },
              ],
            },
          },
    );
  });
  await page.goto("/brechas?period_code=2026-II&cycle=VI");
  await expect(page.getByText("Opciones no disponibles")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByLabel("Ciclo", { exact: true })).toHaveValue("VI");
  await expect(page.getByLabel("Ciclo", { exact: true }).locator("option")).toHaveText([
    "Todos",
    "VI",
    "VII",
  ]);
});

for (const role of ["STUDENT", "VALIDATOR"])
  test(`${role} no obtiene gestión administrativa`, async ({ page }) => {
    await mock(page, role);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Indicadores institucionales" }),
    ).toHaveCount(0);
  });

test("error de indicadores no muestra contenido anterior", async ({ page }) => {
  await mock(page);
  await page.route("**/api/v1/indicators/overview**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "UNAVAILABLE", message: "No disponible" } },
    }),
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "No se pudo cargar la información" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Prioridades institucionales" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Calidad de datos" })).toHaveCount(0);
});

test("los cálculos de alcance y corte siguen siendo deterministas", () => {
  const original = JSON.stringify(overview);
  expect(rankedGaps(overview).map((item) => item.skill)).toEqual(["Datos", "Python"]);
  expect(JSON.stringify(overview)).toBe(original);
  const linked = indicatorLink("/brechas", {
    ...overview,
    filters: { ...overview.filters, cycle: "VI", issuer: "Emisor sintético" },
  });
  const query = new URL(linked, "http://localhost").searchParams;
  expect(query.get("cycle")).toBe("VI");
  expect(query.get("issuer")).toBe("Emisor sintético");
  expect(query.get("dataset")).toBe("registered");
  expect(
    qualityAtCutoff(
      [{ ...run, cutoff_date: "2026-11-01" }, run],
      "2026-II",
      "2026-10-01",
    ),
  ).toEqual(run);
  expect(qualityAtCutoff([run], "2025-II", "2026-10-01")).toBeNull();
});
