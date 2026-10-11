import { test, expect } from "@playwright/test";

test("admin registra, publica y compara una fuente", async ({ page }) => {
  await page.route("**/api/v1/auth/config", (r) =>
    r.fulfill({ json: { provider: "google" } }),
  );
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      json: {
        id: "demo-admin",
        email: "admin@local.pulse-epis.test",
        role: "ADMIN",
        permissions: [],
      },
    }),
  );
  const items: Record<string, unknown>[] = [];
  await page.route("**/api/v1/opportunities", async (r) => {
    if (r.request().method() === "POST") {
      const item = {
        ...r.request().postDataJSON(),
        id: "course-1",
        status: "DRAFT",
        history: [],
      };
      items.push(item);
      return r.fulfill({ status: 201, json: item });
    }
    return r.fulfill({ json: items });
  });
  await page.route("**/api/v1/opportunities/course-1/decision", (r) => {
    const update = r.request().postDataJSON();
    items[0] = {
      ...items[0],
      status: update.status,
      history: [{ ...update, at: "2026-01-01T12:00:00Z" }],
    };
    return r.fulfill({ json: items[0] });
  });
  await page.goto("/admin/oportunidades");
  await expect(
    page.getByRole("heading", { name: "Radar de oportunidades" }),
  ).toBeVisible();
  await expect(
    page.getByText("Selecciona al menos una oportunidad del catálogo."),
  ).toBeVisible();
  await expect(page.getByText("Costo conocido: S/ 0.00")).toHaveCount(0);
  await page.getByRole("button", { name: "Registrar fuente" }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("IA aplicada — demostración");
  await page
    .getByLabel("Proveedor", { exact: true })
    .fill("Proveedor sintético");
  await page.getByLabel("Fuente HTTPS").fill("https://example.org/ia");
  await page.getByLabel("Fecha de consulta").fill("2026-01-01");
  await page
    .getByLabel("Competencias separadas por coma")
    .fill("python, evaluación de modelos");
  await page.getByLabel("Requisitos", { exact: true }).fill("Python básico");
  await page
    .getByLabel("Justificación de relevancia")
    .fill("Formación introductoria para la ruta de desarrollo con IA.");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await page.route("**/api/v1/opportunities/course-1", (r) => {
    const update = r.request().postDataJSON();
    items[0] = { ...items[0], ...update };
    return r.fulfill({ json: items[0] });
  });
  await page.getByRole("button", { name: "Editar borrador" }).click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
    "IA aplicada — demostración",
  );
  await page
    .getByLabel("Requisitos", { exact: true })
    .fill("Python y programación básica");
  await page
    .getByLabel("Motivo de la corrección")
    .fill("Se precisaron los requisitos de la fuente.");
  await page.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(
    page.getByText("Requisitos: Python y programación básica"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revisar y publicar" }).click();
  await page
    .getByLabel("Motivo de la decisión")
    .fill("Fuente revisada por el administrador en esta demostración.");
  await page.getByRole("button", { name: "Confirmar decisión" }).click();
  await page.getByLabel("Comparar", { exact: true }).check();
  await page.getByLabel("Competencias objetivo").fill("python, estadística");
  await page.getByLabel("Estimar costo para un grupo").check();
  await page.getByLabel("Participantes previstos").fill("10");
  await page
    .getByLabel("Presupuesto total del grupo", { exact: false })
    .fill("100");
  await expect(
    page.getByText("Sin cubrir: estadística", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("No se puede confirmar el presupuesto", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../docs/recursos/imagenes/admin-radar-demo.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "IA aplicada — demostración" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retirar", exact: true }).click();
  await page
    .getByLabel("Motivo de la decisión")
    .fill("Curso retirado al terminar la demostración.");
  await page.getByRole("button", { name: "Confirmar decisión" }).click();
  await expect(page.getByLabel("Comparar", { exact: true })).toHaveCount(0);
});

test("estudiante no puede acceder al radar", async ({ page }) => {
  await page.route("**/api/v1/auth/config", (r) =>
    r.fulfill({ json: { provider: "google" } }),
  );
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      json: {
        id: "demo-student",
        email: "student@local.pulse-epis.test",
        role: "STUDENT",
        permissions: [],
      },
    }),
  );
  await page.goto("/admin/oportunidades");
  await expect(
    page.getByRole("heading", { name: "Radar de oportunidades" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Radar formativo" })).toHaveCount(
    0,
  );
});
