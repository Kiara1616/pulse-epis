import { expect, test, type Page } from "@playwright/test";

type Role = "ADMIN" | "STUDENT" | "VALIDATOR";

async function authenticate(page: Page, role: Role) {
  await page.route("**/api/v1/auth/config", (route) =>
    route.fulfill({ json: { provider: "google" } }),
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: `DEMO-${role}`,
        email: `${role.toLowerCase()}@example.invalid`,
        role,
        permissions: [],
        student_id: role === "STUDENT" ? "DEMO-student" : null,
      },
    }),
  );
}

test("estudiante revisa una oferta y simula una solicitud sin persistirla", async ({
  page,
}) => {
  await authenticate(page, "STUDENT");
  const apiWrites: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/v1/") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())
    ) {
      apiWrites.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto("/talleres");

  await expect(page.getByRole("heading", { name: "Talleres para ti" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Talleres" })).toBeVisible();
  await expect(page.getByRole("article").getByText("Abierta", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Conocimientos básicos de programación", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("6", { exact: true })).toBeVisible();
  await expect(page.getByText("no se guardan ni reservan cupos reales", { exact: false })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({
    path: "../docs/recursos/imagenes/va76-workshops-student-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/recursos/imagenes/va76-workshops-student-mobile.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByRole("article").getByText("Enviada", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Tu solicitud aparece como enviada en esta demostración.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(apiWrites).toEqual([]);

  await page.getByRole("button", { name: "Reiniciar demo" }).click();
  await expect(page.getByRole("button", { name: "Enviar solicitud" })).toBeVisible();
});

test("administración consulta el taller y los estados de ejemplo", async ({ page }) => {
  await authenticate(page, "ADMIN");
  await page.goto("/talleres");

  await expect(page.getByRole("heading", { name: "Gestión de talleres" })).toBeVisible();
  await expect(page.getByRole("article").getByText("Abierta", { exact: true })).toBeVisible();
  await expect(page.getByText("18 de 24 ocupados en el ejemplo")).toBeVisible();
  await expect(
    page.getByText("Traer una laptop con navegador actualizado", { exact: true }),
  ).toBeVisible();
  const requests = page.getByRole("table");
  for (const status of ["Enviada", "Aceptada", "Rechazada", "Finalizada"]) {
    await expect(requests.locator("tbody").getByText(status, { exact: true })).toBeVisible();
  }

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({
    path: "../docs/recursos/imagenes/va76-workshops-admin-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/recursos/imagenes/va76-workshops-admin-mobile.png",
    fullPage: true,
  });
  const mobileRequests = page.getByRole("list", { name: "Solicitudes de participación" });
  for (const status of ["Enviada", "Aceptada", "Rechazada", "Finalizada"]) {
    await expect(mobileRequests.getByText(status, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("no se guardan ni reservan cupos reales", { exact: false })).toBeVisible();
});

test("el validador no puede abrir talleres", async ({ page }) => {
  await authenticate(page, "VALIDATOR");
  await page.goto("/talleres");

  await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Talleres" })).toHaveCount(0);
});
