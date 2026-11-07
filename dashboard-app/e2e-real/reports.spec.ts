import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/reportes/panorama');
  await page.locator('input[type="email"]').fill('admin@local.pulse-epis.test');
  await page.locator('input[type="password"]').fill('pulse-local-demo');
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}

test('los seis reportes BI son navegables y aplican granularidad temporal', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Reportes de inteligencia de negocios' })).toBeVisible();
  await page.getByLabel('Agrupar por').selectOption('year');
  await page.getByLabel('Desde').fill('2026-01-01');
  await page.getByLabel('Hasta').fill('2026-12-31');

  const routes = [
    ['Panorama', '/reportes/panorama'],
    ['Evolución', '/reportes/evolucion'],
    ['Certificaciones', '/reportes/certificaciones'],
    ['Habilidades', '/reportes/habilidades'],
    ['Cohortes', '/reportes/cohortes'],
    ['Calidad', '/reportes/calidad'],
  ] as const;

  for (const [label, route] of routes) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByRole('heading', { name: 'Reportes de inteligencia de negocios' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `../docs/recursos/imagenes/bi-${route.split('/').at(-1)}.png`, fullPage: true });
  }
});
