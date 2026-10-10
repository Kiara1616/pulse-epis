import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("../artifacts/local-validation");
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
const summary = { imports: null, publication: null, routes: [], errors: failures };
const base = "http://127.0.0.1:3100";
async function login(role) {
  await page.goto(base);
  await page.locator("aside, #local-email").first().waitFor();
  if (await page.getByRole("button", { name: "Cerrar sesión" }).count()) await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByLabel("Correo demo").fill(`${role}@local.pulse-epis.test`);
  await page.getByRole("button", { name: "Ingresar con cuenta local" }).click();
  await expect(page.locator("aside")).toBeVisible();
}
try {
  await login("admin");
  const csv = process.env.PULSE_SMOKE_CSV;
  if (csv) {
    await page.goto(`${base}/admin/estudiantes`);
    await page.getByLabel("CSV del padrón").setInputFiles(csv);
    await expect(page.getByRole("combobox", { name: "Periodo", exact: true })).toHaveValue("2025-II");
    await expect(page.getByText("Se importarán únicamente 342 filas de 2025-II.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Resultado de importación" })).toBeVisible();
    await expect(page.getByText("Aceptados:")).toContainText("342");
    await expect(page.getByText("Rechazados:")).toContainText("0");
    await page.screenshot({ path: path.join(output, "padron.png"), fullPage: true });
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Resultado de importación (repetida, sin cambios)" })).toBeVisible();
    summary.imports = { period: "2025-II", accepted: 342, rejected: 0, repeatedWithoutDuplicates: true };
    await page.goto(`${base}/estudiantes`);
    await expect(page.getByText("1–25 de 342 estudiantes", {exact: true})).toBeVisible();
    const code = await page.locator("tbody tr").first().locator("td").first().innerText();
    expect(code).not.toBe("No registrado");
    await page.getByRole("button", {name: "Siguiente", exact: true}).click();
    await expect(page.getByText("26–50 de 342 estudiantes", {exact: true})).toBeVisible();
    await page.getByLabel("Buscar estudiante").fill(code);
    await expect(page.getByText("1–1 de 1 estudiantes", {exact: true})).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByLabel("Buscar estudiante").fill("");
    await expect(page.getByText("1–25 de 342 estudiantes", {exact: true})).toBeVisible();
    await page.setViewportSize({width: 390, height: 844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({width: 1440, height: 960});
    await page.goto(`${base}/admin/publicaciones`);
    await page.getByRole("combobox", { name: "Periodo", exact: true }).selectOption("2025-II");
    await page.getByLabel("Fecha de corte").fill("2025-12-05");
    await page.getByRole("button", { name: "Publicar indicadores", exact: true }).click();
    await expect(page.getByText(/^Indicadores publicados/)).toBeVisible();
    summary.publication = { period: "2025-II", cutoff: "2025-12-05" };
    await page.screenshot({ path: path.join(output, "publicacion.png"), fullPage: true });
    await page.goto(base);
    if (await page.getByLabel("Fuente de datos").count()) await page.getByLabel("Fuente de datos").selectOption("registered");
    await expect(page.getByRole("button", { name: "Exportar PDF" })).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar PDF" }).click();
    await (await downloaded).saveAs(path.join(output, "reporte-2025-II.pdf"));
  }
  const routes = ["/", "/tecnologias", "/estudiantes", "/brechas", "/admin", "/admin/estudiantes", "/admin/publicaciones", "/validaciones", "/mi-perfil"];
  const allowed = {
    admin: new Set(routes.filter((r) => !["/validaciones", "/mi-perfil"].includes(r))),
    validator: new Set(["/", "/tecnologias", "/estudiantes", "/validaciones"]),
    student: new Set(["/", "/mi-perfil"]),
  };
  for (const role of ["admin", "validator", "student"]) {
    await login(role);
    for (const route of routes) {
      await page.goto(base + route);
      await expect(page.locator("aside")).toBeVisible();
      if (allowed[role].has(route)) {
        await expect(page.getByRole("heading", { name: "Acceso restringido" })).toHaveCount(0);
        await expect(page.locator("main h1, main h2").first()).toBeVisible();
      } else await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
      summary.routes.push({ role, route, access: allowed[role].has(route) ? "allowed" : "restricted" });
    }
  }
  expect(failures).toEqual([]);
  await writeFile(path.join(output, "resultados.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, routes: summary.routes.length }));
} finally { await browser.close(); }
