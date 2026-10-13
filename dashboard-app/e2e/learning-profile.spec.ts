import { expect, test } from "@playwright/test";

test("mi ruta carga el catálogo real y persiste las preferencias del estudiante", async ({ page }) => {
  const interestId = "interest-data";
  const routeId = "route-79";
  let profile = { route_id: null as string | null, interest_ids: [interestId] };

  await page.route("**/api/v1/auth/config", (route) => route.fulfill({ json: { provider: "google" } }));
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({
    json: { id: "student-user", email: "student@example.invalid", role: "STUDENT", permissions: [], student_id: "student-own" },
  }));
  await page.route("**/api/v1/learning/interests", (route) => route.fulfill({ json: [
    { id: interestId, name: "Datos", active: true, created_at: "2026-10-01T12:00:00Z" },
    { id: "interest-ai", name: "Inteligencia artificial", active: true, created_at: "2026-10-01T12:00:00Z" },
  ] }));
  await page.route("**/api/v1/learning/routes", (route) => route.fulfill({ json: [{
    id: routeId,
    title: "Ruta de analítica",
    description: "Pasos para fortalecer competencias de análisis y visualización de datos.",
    steps: [{ id: "step-79", route_id: routeId, position: 1, title: "Preparar conjuntos de datos", skills: ["SQL"], prerequisites: ["Lógica básica"], created_at: "2026-10-01T12:00:00Z" }],
    status: "PUBLISHED",
    created_at: "2026-10-01T12:00:00Z",
  }] }));
  await page.route("**/api/v1/learning/courses", (route) => route.fulfill({ json: [{
    id: "course-79",
    title: "Analítica aplicada",
    provider: "Instituto EPIS",
    source_url: "https://example.org/analitica",
    checked_on: "2026-10-01",
    requirements: [],
    skills: ["Datos"],
    status: "PUBLISHED",
    created_at: "2026-10-01T12:00:00Z",
  }] }));
  await page.route("**/api/v1/learning/offers", (route) => route.fulfill({ json: [{
    id: "offer-79",
    course_id: "course-79",
    title: "Oportunidad de analítica",
    cycles: ["V"],
    interest_ids: [interestId],
    relevance: "Amplía las competencias de análisis de información.",
    status: "PUBLISHED",
    created_at: "2026-10-01T12:00:00Z",
  }] }));
  await page.route("**/api/v1/learning/me/profile", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: profile });
      return;
    }
    profile = route.request().postDataJSON();
    await route.fulfill({ json: profile });
  });

  await page.goto("/mi-ruta");
  await expect(page.getByRole("heading", { name: "Mi ruta" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Oportunidades publicadas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Oportunidad de analítica" })).toBeVisible();
  await expect(page.getByText("no una recomendación personalizada", { exact: false })).toBeVisible();

  await page.locator("fieldset").first().getByText("Inteligencia artificial", { exact: true }).click();
  await page.getByLabel("Ruta de formación").selectOption(routeId);
  await page.getByRole("button", { name: "Guardar preferencias" }).click();
  await expect(page.getByRole("status")).toContainText("Tus preferencias quedaron guardadas.");
  expect(profile).toEqual({ route_id: routeId, interest_ids: [interestId, "interest-ai"] });
  await expect(page.getByRole("heading", { name: "Preparar conjuntos de datos" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Ruta de formación")).toHaveValue(routeId);
  await expect(page.getByLabel("Datos", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Inteligencia artificial", { exact: true })).toBeChecked();
});
