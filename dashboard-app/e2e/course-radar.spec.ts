import { expect, test, type Page } from "@playwright/test";

const courseId = "course-79";
const offerId = "offer-79";
const interestId = "interest-79";

function course(status: string, title = "Fundamentos de IA") {
  return {
    id: courseId,
    title,
    provider: "Universidad de ejemplo",
    source_url: "https://example.org/curso-ia",
    checked_on: "2026-10-01",
    requirements: ["Python básico"],
    skills: ["Inteligencia artificial"],
    status,
    created_at: "2026-10-01T12:00:00Z",
  };
}

async function auth(page: Page, role = "ADMIN") {
  await page.route("**/api/v1/auth/config", (route) =>
    route.fulfill({ json: { provider: "google" } }),
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: `USER-${role}`,
        email: `${role.toLowerCase()}@example.invalid`,
        role,
        permissions: [],
        student_id: null,
      },
    }),
  );
}

async function mockRadarApi(page: Page, initialStatus = "DETECTED") {
  let currentCourse = course(initialStatus);
  let courseExists = initialStatus !== "EMPTY";
  let currentOffer: Record<string, unknown> | null = null;

  await page.route("**/api/v1/learning/courses", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: courseExists ? [currentCourse] : [] });
      return;
    }
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      currentCourse = { ...course("DETECTED", body.title), ...body, id: courseId };
      courseExists = true;
      await route.fulfill({ status: 201, json: currentCourse });
      return;
    }
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      currentCourse = { ...currentCourse, ...body };
      await route.fulfill({ json: currentCourse });
      return;
    }
    await route.continue();
  });

  await page.route("**/api/v1/learning/courses/*", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      currentCourse = { ...currentCourse, ...body };
      await route.fulfill({ json: currentCourse });
      return;
    }
    await route.continue();
  });

  await page.route("**/api/v1/learning/courses/*/status", async (route) => {
    const body = route.request().postDataJSON();
    currentCourse = { ...currentCourse, status: body.status };
    await route.fulfill({ json: currentCourse });
  });

  await page.route("**/api/v1/learning/offers", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: currentOffer ? [currentOffer] : [] });
      return;
    }
    const body = route.request().postDataJSON();
    currentOffer = {
      id: offerId,
      ...body,
      status: "DRAFT",
      created_at: "2026-10-01T12:00:00Z",
    };
    await route.fulfill({ status: 201, json: currentOffer });
  });

  await page.route("**/api/v1/learning/offers/*/status", async (route) => {
    const body = route.request().postDataJSON();
    currentOffer = { ...currentOffer, status: body.status };
    currentCourse = {
      ...currentCourse,
      status: body.status === "PUBLISHED" ? "PUBLISHED" : "RETIRED",
    };
    await route.fulfill({ json: currentOffer });
  });

  await page.route("**/api/v1/learning/interests", (route) =>
    route.fulfill({
      json: [{ id: interestId, name: "Inteligencia artificial", active: true, created_at: "2026-10-01T12:00:00Z" }],
    }),
  );
}

test("admin revisa un curso y publica una oportunidad persistida", async ({ page }) => {
  await auth(page);
  await mockRadarApi(page);
  const writes: Array<{ method: string; url: string; body: unknown }> = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/learning/") && request.method() !== "GET") {
      writes.push({ method: request.method(), url: request.url(), body: request.postDataJSON() });
    }
  });

  await page.goto("/admin/radar");
  await expect(page.getByRole("heading", { name: "Radar de cursos" })).toBeVisible();
  await expect(page.getByRole("article").getByText("Por revisar", { exact: true })).toBeVisible();
  await expect(page.getByText("Las fuentes se registran manualmente.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Iniciar revisión" }).click();
  await expect(page.getByText("Revisión de contenido", { exact: true })).toBeVisible();
  await page.getByLabel("Título", { exact: true }).fill("Fundamentos de IA revisado");
  await page.getByRole("button", { name: "Guardar correcciones" }).click();
  await expect(page.getByRole("status")).toContainText("Correcciones del curso guardadas.");

  await page.getByLabel("Título de la oportunidad").fill("Formación aplicada en IA");
  await page.getByRole("checkbox", { name: "Ciclo V", exact: true }).check();
  await page.getByLabel("Inteligencia artificial", { exact: true }).check();
  await page.getByLabel("Explicación de relevancia").fill("Profundiza habilidades prácticas de inteligencia artificial.");
  await page.getByRole("button", { name: "Guardar y publicar" }).click();
  await expect(page.getByRole("status")).toContainText("Oportunidad publicada y disponible para estudiantes.");
  await expect(page.getByRole("article").getByText("Publicado", { exact: true })).toBeVisible();

  expect(writes.map(({ method, url }) => `${method} ${url.split("/api/v1")[1]}`)).toEqual([
    `POST /learning/courses/${courseId}/status`,
    `PUT /learning/courses/${courseId}`,
    "POST /learning/offers",
    `POST /learning/offers/${offerId}/status`,
  ]);
  expect((writes[3].body as { status: string; reason: string }).status).toBe("PUBLISHED");

  await page.getByRole("button", { name: "Retirar oportunidad" }).click();
  await expect(page.getByRole("article").getByText("Retirado", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article").getByText("Retirado", { exact: true })).toBeVisible();
});

test("el radar muestra carga vacía real y registra una fuente manual", async ({ page }) => {
  await auth(page);
  await mockRadarApi(page, "EMPTY");
  await page.goto("/admin/radar");
  await expect(page.getByText("Aún no hay cursos registrados.")).toBeVisible();
  await page.getByText("Registrar fuente de curso").click();
  await page.getByLabel("Nombre del curso").fill("Fundamentos de datos");
  await page.getByLabel("Proveedor").fill("Instituto EPIS");
  await page.getByLabel("Fuente HTTPS").fill("https://example.org/datos");
  await page.getByLabel("Habilidades (separadas por coma)").fill("SQL, análisis");
  await page.getByRole("button", { name: "Registrar para revisión" }).click();
  await expect(page.getByRole("status")).toContainText("Fuente registrada.");
  await expect(page.getByRole("article").getByText("Fundamentos de datos")).toBeVisible();
});

test("los cambios de estado tienen respuesta vacía y error recuperable", async ({ page }) => {
  await auth(page);
  await mockRadarApi(page, "DETECTED");
  await page.route("**/api/v1/learning/courses/*/status", (route) =>
    route.fulfill({ status: 503, json: { detail: { code: "LEARNING_UNAVAILABLE", message: "Servicio temporalmente no disponible." } } }),
  );
  await page.goto("/admin/radar");
  await page.getByRole("button", { name: "Iniciar revisión" }).click();
  await expect(page.getByText("Servicio temporalmente no disponible.", { exact: true })).toBeVisible();
  await expect(page.getByRole("article").getByText("Por revisar", { exact: true })).toBeVisible();
});

for (const role of ["STUDENT", "VALIDATOR"])
  test(`${role} no accede al radar administrativo`, async ({ page }) => {
    await auth(page, role);
    await page.goto("/admin/radar");
    await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Radar de cursos" })).toHaveCount(0);
  });
