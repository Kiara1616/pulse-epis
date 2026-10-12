import { test, expect } from "@playwright/test";
import { statusLabel, statusClass } from "../src/shared/ui/status";
test("etiquetas coherentes y estado desconocido neutral", () => {
  expect(statusLabel("APPROVED")).toBe("Aprobada");
  expect(statusLabel("FUTURE")).toBe("Estado no reconocido");
  expect(statusClass("FUTURE")).toContain("gray");
});
for (const role of ["STUDENT", "ADMIN"])
  test(`${role} no inicia consultas de validación`, async ({ page }) => {
    let calls = 0;
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
    await page.route("**/api/v1/validations", (r) => {
      calls++;
      return r.fulfill({ json: [] });
    });
    await page.goto("/validaciones");
    await expect(
      page.getByRole("heading", { name: "Acceso restringido" }),
    ).toBeVisible();
    expect(calls).toBe(0);
  });
test("error, reintento y vacío accesibles para validador", async ({ page }) => {
  await page.route("**/api/v1/auth/config", (r) =>
    r.fulfill({ json: { provider: "google" } }),
  );
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      json: {
        id: "DEMO",
        email: "demo@example.invalid",
        role: "VALIDATOR",
        permissions: [],
        student_id: null,
      },
    }),
  );
  let fail = true;
  await page.route("**/api/v1/validations", (r) =>
    r.fulfill(
      fail
        ? {
            status: 503,
            json: { error: { code: "TEST", message: "Error sintético" } },
          }
        : { json: [] },
    ),
  );
  await page.goto("/validaciones");
  await expect(
    page.getByRole("heading", { name: "No se pudo cargar la información" }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    page.getByText("No hay certificaciones para revisar."),
  ).toBeVisible();
  await expect(
    page.getByText("Revisión académica", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/recursos/imagenes/va73-feedback-demo.png",
    fullPage: true,
  });
});
test("sesión expirada no presenta navegación ni selector de rol", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/config", (r) =>
    r.fulfill({ json: { provider: "google" } }),
  );
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      status: 401,
      json: { error: { code: "UNAUTHENTICATED", message: "Sesión expirada" } },
    }),
  );
  await page.goto("/validaciones");
  await expect(
    page.getByRole("heading", { name: "Ingresa a Pulse EPIS" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /rol/i })).toHaveCount(0);
});
