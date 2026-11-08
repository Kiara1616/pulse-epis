import { expect, test } from "@playwright/test";

test("seis reportes BI muestran filtros de año, mes y día", async ({ page }) => {
  await page.route("**/api/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/auth/config", (route) => route.fulfill({ json: { provider: "google" } }));
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ json: {
    id: "ADMIN-DEMO", email: "admin@example.invalid", role: "ADMIN", permissions: [], student_id: null,
  } }));

  const routes = ["panorama", "evolucion", "certificaciones", "habilidades", "cohortes", "calidad"];
  for (const route of routes) {
    await page.goto(`/reportes/${route}`);
    await expect(page.getByRole("heading", { name: "Reportes de inteligencia de negocios" })).toBeVisible();
    const granularity = page.getByLabel("Agrupar por");
    for (const value of ["year", "month", "day"]) {
      await granularity.selectOption(value);
      await expect(granularity).toHaveValue(value);
    }
  }
});
