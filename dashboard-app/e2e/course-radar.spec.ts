import { test, expect } from "@playwright/test";
async function auth(page: import("@playwright/test").Page, role = "ADMIN") {
  await page.route("**/api/v1/auth/config", (r) =>
    r.fulfill({ json: { provider: "google" } }),
  );
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      json: {
        id: "DEMO",
        email: "demo@example.invalid",
        role,
        permissions: [],
        student_id: null,
      },
    }),
  );
}
test("radar exige revisión, audiencia y relevancia; permite corrección y retiro", async ({
  page,
}) => {
  await auth(page);
  await page.goto("/admin/radar");
  await expect(
    page.getByText("Demostración sintética.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("article").getByText("Detectado", { exact: true })).toHaveCount(3);
  await page.getByRole("button", { name: "Iniciar revisión" }).first().click();
  await page.getByRole("button", { name: "Publicar oportunidad" }).click();
  await expect(
    page.getByText("Define una audiencia", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Fundamentos de IA corregido");
  await page
    .getByLabel("Audiencia", { exact: true })
    .fill("Ciclo V, interés en IA");
  await page
    .getByLabel("Explicación de relevancia")
    .fill("Ejemplo para profundizar fundamentos en la ruta de IA.");
  await page.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(page.getByRole("article").getByText("En revisión", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Revisar y corregir" }).click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
    "Fundamentos de IA corregido",
  );
  await page.getByRole("button", { name: "Publicar oportunidad" }).click();
  await expect(page.getByRole("article").getByText("Publicado", { exact: true })).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({
    path: "../docs/recursos/imagenes/va75-radar-demo.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Retirar", exact: true }).click();
  await expect(page.getByRole("article").getByText("Retirado", { exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("article").getByText("Detectado", { exact: true })).toHaveCount(3);
});
test("descarte y filtro vacío son explícitos", async ({ page }) => {
  await auth(page);
  await page.goto("/admin/radar");
  await page.getByRole("button", { name: "Descartar" }).first().click();
  await page
    .getByLabel("Filtrar estado", { exact: true })
    .selectOption("DISCARDED");
  await expect(page.getByRole("article").getByText("Descartado", { exact: true })).toHaveCount(1);
  await page
    .getByLabel("Filtrar estado", { exact: true })
    .selectOption("RETIRED");
  await expect(page.getByText("No hay cursos en este estado.")).toBeVisible();
});
for (const role of ["STUDENT", "VALIDATOR"])
  test(`${role} no accede al prototipo`, async ({ page }) => {
    await auth(page, role);
    await page.goto("/admin/radar");
    await expect(
      page.getByRole("heading", { name: "Acceso restringido" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Radar de cursos" }),
    ).toHaveCount(0);
  });
