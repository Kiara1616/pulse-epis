import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const output = path.resolve("../artifacts/local-validation");
await mkdir(output, {recursive: true});
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width:1440, height:960}});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = "http://127.0.0.1:3100";
try {
  await page.goto(base);
  await page.getByLabel("Correo demo").fill("admin@local.pulse-epis.test");
  await page.getByRole("button", {name:"Ingresar con cuenta local"}).click();
  await expect(page.getByLabel("Fuente de datos")).toHaveValue("demo");
  await expect(page.getByRole("heading", {name:"Certificaciones registradas en el corte"})).toBeVisible();
  await expect(page.getByText("AWS Cloud Practitioner", {exact:true})).toBeVisible();
  await expect(page.getByLabel("Nivel", {exact:true})).toHaveCount(0);
  await expect(page.getByRole("combobox", {name:/Año de ingreso/})).toBeVisible();
  const registered = await (await page.request.get(base+"/api/v1/indicators/overview?period_code=2025-II")).json();
  expect(registered.kpis.active_students).toBe(342);
  expect(registered.kpis.approved_certifications).toBe(0);
  const periods = await (await page.request.get(base+"/api/v1/indicators/periods?dataset=demo")).json();
  expect(periods.length).toBe(14);
  await page.screenshot({path:path.join(output,"demo-resumen.png"),fullPage:true});
  const excelDownload = page.waitForEvent("download");
  await page.getByRole("button",{name:"Exportar Excel"}).click();
  await (await excelDownload).saveAs(path.join(output,"reporte-demo-2026-II.xlsx"));
  for (const route of ["/","/tecnologias","/brechas"]) {
    await page.goto(base+route);
    await expect(page.getByLabel("Fuente de datos")).toHaveValue("demo");
    for (const period of ["2020-I", "2026-II"]) {
      await page.getByRole("combobox",{name:"Periodo",exact:true}).selectOption(period);
      await expect(page.getByRole("button",{name:"Exportar PDF"})).toBeVisible();
      await expect(page.locator(".recharts-surface").first()).toBeVisible();
    }
  }
  await page.goto(base+"/tecnologias");
  await expect(page.getByText("Oracle Database SQL",{exact:true})).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button",{name:"Exportar PDF"}).click();
  await (await download).saveAs(path.join(output,"reporte-demo-2026-II.pdf"));
  await page.screenshot({path:path.join(output,"demo-tecnologias.png"),fullPage:true});
  await page.goto(base);
  await page.getByLabel("Fuente de datos").selectOption("registered");
  await expect(page.getByText("No hay registros aprobados en este corte.")).toBeVisible();
  await page.goto(base+"/tecnologias");
  await expect(page.getByLabel("Fuente de datos")).toHaveValue("registered");
  await page.getByLabel("Fuente de datos").selectOption("demo");
  await expect(page.getByText("CCNA",{exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:path.join(output,"demo-mobile.png"),fullPage:true});
  const directory = await (await page.request.get(base+"/api/v1/padron/students")).json();
  expect(directory.total).toBe(342);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({periods:periods.length,realRoster:directory.total,realCertifications:registered.kpis.approved_certifications, demoRoutes:3, pdf:true, mobile:true, errors}));
} finally {await browser.close();}
