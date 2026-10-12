import { test, expect, type Page } from "@playwright/test";
import {
  indicatorLink,
  rankedGaps,
  qualityAtCutoff,
} from "../src/features/admin/priorities";
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
    {
      skill: "Python",
      certified_students: 3,
      gap_students: 7,
      coverage_percent: 30,
    },
    {
      skill: "Datos",
      certified_students: 1,
      gap_students: 9,
      coverage_percent: 10,
    },
  ],
};
const run = {
  id: "DEMO-run",
  period_code: "2026-II",
  cutoff_date: "2026-10-01",
  status: "REJECTED",
  total_rows: 6,
  accepted_rows: 0,
  rejected_rows: 2,
};
async function mock(page: Page, role = "ADMIN", local = false) {
  await page.route("**/api/v1/auth/config", (r) =>
    r.fulfill({ json: { provider: local ? "local" : "google" } }),
  );
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      json: {
        id: "DEMO-user",
        email: "demo@example.invalid",
        role,
        permissions: [],
        student_id: role === "STUDENT" ? "DEMO-student" : null,
      },
    }),
  );
  await page.route("**/api/v1/indicators/periods**", (r) =>
    r.fulfill({
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
  await page.route("**/api/v1/indicators/overview**", (r) => {
    const params = new URL(r.request().url()).searchParams;
    const filters = {
      ...overview.filters,
      cycle: params.get("cycle"),
      issuer: params.get("issuer"),
      cohort: params.get("cohort"),
      cutoff_date: params.get("cutoff_date") ?? "2026-10-01",
    };
    return r.fulfill({
      json: {
        ...overview,
        dataset: params.get("dataset") === "demo" ? "demo" : "registered",
        filters,
        kpis: { ...overview.kpis, active_students: filters.cycle ? 5 : 10 },
      },
    });
  });
  await page.route("**/api/v1/etl/runs**", (r) => r.fulfill({ json: [run] }));
}
test("admin conecta indicadores, prioridades y calidad del corte", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/admin");
  await expect(
    page.getByRole("region", { name: "Indicadores institucionales" }),
  ).toContainText("Estudiantes activos");
  await expect(
    page.getByRole("region", { name: "Prioridades institucionales" }),
  ).toContainText("7 de 10");
  await expect(
    page.getByRole("region", { name: "Calidad de datos" }),
  ).toContainText("Proceso rechazado por calidad");
  const modules = page.getByRole("region", { name: "Gestión administrativa" });
  await expect(modules.getByRole("link", { name: /Certificaciones/ }))
    .toHaveAttribute("href", "/tecnologias");
  const radar = modules.getByRole("link", { name: /Radar de cursos/ });
  await expect(radar).toHaveAttribute("href", "/admin/radar");
  await expect(radar).toContainText("Demostración sin persistencia");
  await page.getByText("Fuente y corte", { exact: true }).first().click();
  await expect(page.getByText("GET /api/v1/indicators/overview").first()).toBeVisible();
  await page.getByLabel("Ciclo", { exact: true }).selectOption("VI");
  await expect(
    page.getByRole("region", { name: "Prioridades institucionales" }),
  ).toContainText("2 de 5");
  const link = page.getByRole("link", {
    name: "Analizar cobertura por habilidad",
  });
  await expect(link).toHaveAttribute("href", /cycle=VI/);
  await link.click();
  await expect(page.getByLabel("Ciclo", { exact: true })).toHaveValue("VI");
  await expect(
    page.getByRole("heading", { name: "Brechas de habilidades" }),
  ).toBeVisible();
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
      period_code: "2026-II", cutoff_date: "2026-10-01",
      dataset: "registered", [linked.key]: linked.selected,
    });
    await page.goto(`/brechas?${query}`);
    const select = page.getByLabel(linked.label, { exact: true });
    await expect(select).toHaveValue(linked.selected);
    await expect(select.locator("option")).toHaveText([
      "Todos", linked.selected, linked.alternative,
    ]);
    expect(requests.some((params) =>
      params.get("period_code") === "2026-II" &&
      params.get("cutoff_date") === "2026-10-01" &&
      !params.has("cycle") && !params.has("cohort") && !params.has("issuer") &&
      !params.has("level") && !params.has("dataset"),
    )).toBe(true);
    const updated = page.waitForResponse((response) =>
      response.url().includes("/indicators/overview?") &&
      new URL(response.url()).searchParams.get(linked.key) === linked.alternative,
    );
    await select.selectOption(linked.alternative);
    await updated;
    await expect(select).toHaveValue(linked.alternative);
    await expect(select.locator("option")).toHaveText([
      "Todos", linked.selected, linked.alternative,
    ]);
  });

test("fallo al cargar opciones permite reintentar sin perder el ciclo enlazado", async ({ page }) => {
  await mock(page);
  let fail = true;
  await page.route("**/api/v1/indicators/overview**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill(!params.has("cycle") && fail
      ? { status: 503, json: { error: { message: "Opciones no disponibles" } } }
      : { json: { ...overview, by_cycle: [{ name: "VI", value: 4 }, { name: "VII", value: 2 }] } });
  });
  await page.goto("/brechas?period_code=2026-II&cycle=VI");
  await expect(page.getByText("Opciones no disponibles")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByLabel("Ciclo", { exact: true })).toHaveValue("VI");
  await expect(page.getByLabel("Ciclo", { exact: true }).locator("option")).toHaveText(["Todos", "VI", "VII"]);
});
test("calidad sin informe no inventa un resultado aprobado", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/v1/etl/runs**", (r) =>
    r.fulfill({ json: [{ ...run, cutoff_date: "2026-11-01" }] }),
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("region", { name: "Calidad de datos" }),
  ).toContainText("La calidad no está evaluada");
});
test("error de calidad permite reintento independiente", async ({ page }) => {
  await mock(page);
  let fail = true;
  await page.route("**/api/v1/etl/runs**", (r) =>
    r.fulfill(
      fail
        ? {
            status: 503,
            json: {
              error: { code: "UNAVAILABLE", message: "Error sintético" },
            },
          }
        : {
            json: [
              { ...run, status: "APPLIED", rejected_rows: 0, accepted_rows: 6 },
            ],
          },
    ),
  );
  await page.goto("/admin");
  await expect(page.getByText("Error sintético")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Reintentar calidad" }).click();
  await expect(
    page.getByRole("region", { name: "Calidad de datos" }),
  ).toContainText("Proceso aplicado");
});
test("demo no consulta ni atribuye calidad institucional", async ({ page }) => {
  await mock(page, "ADMIN", true);
  let requests = 0;
  await page.route("**/api/v1/etl/runs**", (r) => {
    requests++;
    return r.fulfill({ json: [run] });
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("region", { name: "Calidad de datos" }),
  ).toContainText("Datos sintéticos");
  expect(requests).toBe(0);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({
    path: "../docs/recursos/imagenes/va72-admin-demo.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/recursos/imagenes/va72-admin-mobile-demo.png",
    fullPage: true,
  });
});
for (const role of ["STUDENT", "VALIDATOR"])
  test(`${role} no obtiene gestión administrativa`, async ({ page }) => {
    await mock(page, role);
    let requests = 0;
    await page.route("**/api/v1/etl/runs**", (r) => {
      requests++;
      return r.fulfill({ json: [] });
    });
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Acceso restringido" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Indicadores institucionales" }),
    ).toHaveCount(0);
    expect(requests).toBe(0);
  });
test("error de indicadores no muestra prioridades anteriores ni cifras de cero", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/v1/indicators/overview**", (r) =>
    r.fulfill({
      status: 503,
      json: { error: { code: "UNAVAILABLE", message: "No disponible" } },
    }),
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "No se pudo cargar la información" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Prioridades institucionales" }),
  ).toHaveCount(0);
});
test("ranking y enlaces conservan alcance y calidad requiere corte exacto", () => {
  const original = JSON.stringify(overview);
  expect(rankedGaps(overview).map((i) => i.skill)).toEqual(["Datos", "Python"]);
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
