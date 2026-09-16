import { test, expect, type Page } from "@playwright/test";

type Role = "ADMIN" | "VALIDATOR" | "STUDENT";

const overview = {
  filters: {
    period_code: "2026-II",
    cutoff_date: "2026-09-13",
    cohort: null,
    cycle: null,
    issuer: null,
    level: null,
  },
  kpis: {
    active_students: 120,
    certified_students: 42,
    coverage_percent: 35,
    approved_certifications: 58,
    expiring_soon: 4,
  },
  by_issuer: [{ name: "AWS", value: 30 }],
  by_level: [{ name: "Associate", value: 58 }],
  by_cohort: [{ name: "2023", value: 20 }],
  by_cycle: [{ name: "VIII", value: 18 }],
  by_skill: [{ name: "Cloud", value: 30 }],
  evolution: [{ cutoff_date: "2026-09-13", certified_students: 42, approved_certifications: 58 }],
  skill_gaps: [{ skill: "Cloud", certified_students: 30, gap_students: 90, coverage_percent: 25 }],
};

async function mockApi(page: Page, role: Role) {
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: `user-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@virtual.upt.pe`,
      role,
      student_id: role === "STUDENT" ? "student-1" : null,
      permissions: [],
    }),
  }));
  await page.route("**/api/v1/indicators/periods", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ code: "2026-II", starts_on: "2026-08-01", ends_on: "2026-12-31", latest_cutoff_date: "2026-09-13" }]),
  }));
  await page.route("**/api/v1/indicators/overview**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(overview),
  }));
  await page.route("**/api/v1/certifications", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([]),
  }));
  await page.route("**/api/v1/validations", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([]),
  }));
}

test.describe("navegación por rol", () => {
  test("ADMIN puede abrir administración e indicadores agregados", async ({ page }) => {
    await mockApi(page, "ADMIN");
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Panorama de certificaciones" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administrar" })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Centro de administración" })).toBeVisible();
    await expect(page.getByText("Indicadores agregados")).toBeVisible();
  });

  test("VALIDATOR puede abrir la bandeja y no recibe navegación administrativa", async ({ page }) => {
    await mockApi(page, "VALIDATOR");
    await page.goto("/validaciones");

    await expect(page.getByRole("heading", { name: "Bandeja de validaciones" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Validar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administrar" })).toHaveCount(0);
    await expect(page.getByText("No hay certificaciones para revisar.")).toBeVisible();
  });

  test("STUDENT puede abrir su perfil y ve datos provenientes de la API", async ({ page }) => {
    await mockApi(page, "STUDENT");
    await page.goto("/mi-perfil");

    await expect(page.getByRole("heading", { name: "Mis certificaciones" })).toBeVisible();
    await expect(page.getByText("Todavía no tienes certificaciones registradas.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Credenciales" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administrar" })).toHaveCount(0);
  });
});
