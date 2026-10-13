import { expect, test, type Page } from "@playwright/test";

type Role = "ADMIN" | "STUDENT" | "VALIDATOR";

const offer = {
  id: "offer-79",
  course_id: "course-79",
  title: "Formación aplicada en IA",
  cycles: ["V"],
  interest_ids: ["interest-79"],
  relevance: "Profundiza habilidades prácticas de inteligencia artificial.",
  status: "PUBLISHED",
  created_at: "2026-10-01T12:00:00Z",
};

function workshop(id = "workshop-79", status = "OPEN", title = "Prototipado con IA", capacity = 8) {
  return {
    id,
    offer_id: offer.id,
    title,
    capacity,
    requirements: ["Python básico", "Traer una laptop"],
    occupied_places: 1,
    available_places: capacity - 1,
    status,
    created_at: "2026-10-01T12:00:00Z",
  };
}

async function auth(page: Page, role: Role) {
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
        student_id: role === "STUDENT" ? "student-own" : null,
      },
    }),
  );
}

async function mockStudentLearning(
  page: Page,
  empty = false,
  initialApplications: Array<Record<string, unknown>> = [],
) {
  const workshops = empty ? [] : [workshop()];
  const applications = [...initialApplications];
  await page.route("**/api/v1/learning/workshops", (route) =>
    route.fulfill({ json: workshops.filter((item) => item.status === "OPEN") }),
  );
  await page.route("**/api/v1/learning/offers", (route) => route.fulfill({ json: [offer] }));
  await page.route("**/api/v1/learning/me/applications", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: applications });
      return;
    }
    const body = route.request().postDataJSON();
    const application = {
      id: "application-79",
      student_id: "student-own",
      workshop_id: body.workshop_id,
      status: "SUBMITTED",
      comment: null,
      created_at: "2026-10-13T12:00:00Z",
    };
    applications.push(application);
    await route.fulfill({ status: 201, json: application });
  });
}

async function mockAdminLearning(page: Page) {
  const workshops = [workshop()];
  const applications: Array<Record<string, unknown>> = [{
    id: "application-79",
    student_id: "student-private-id",
    workshop_id: "workshop-79",
    status: "SUBMITTED",
    comment: null,
    created_at: "2026-10-13T12:00:00Z",
  }];

  await page.route("**/api/v1/learning/offers", (route) => route.fulfill({ json: [offer] }));
  await page.route("**/api/v1/learning/workshops/*/status", async (route) => {
    const id = route.request().url().split("/").at(-2)!;
    const body = route.request().postDataJSON();
    const updated = { ...workshops.find((item) => item.id === id)!, status: body.status };
    if (body.status === "OPEN" && !workshops.some((item) => item.id === id)) workshops.push(updated);
    else Object.assign(workshops.find((item) => item.id === id)!, updated);
    await route.fulfill({ json: updated });
  });
  await page.route("**/api/v1/learning/workshops", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: workshops });
      return;
    }
    const body = route.request().postDataJSON();
    const created = {
      id: "workshop-new",
      ...body,
      occupied_places: 0,
      available_places: body.capacity,
      status: "DRAFT",
      created_at: "2026-10-13T12:00:00Z",
    };
    workshops.push(created);
    await route.fulfill({ status: 201, json: created });
  });
  await page.route("**/api/v1/learning/admin/applications/*/status", async (route) => {
    const body = route.request().postDataJSON();
    Object.assign(applications[0], { status: body.status, comment: body.reason });
    const occupiedWorkshop = workshops.find((item) => item.id === "workshop-79");
    if (body.status === "ACCEPTED" && occupiedWorkshop) {
      occupiedWorkshop.occupied_places += 1;
      occupiedWorkshop.available_places -= 1;
    }
    await route.fulfill({ json: applications[0] });
  });
  await page.route("**/api/v1/learning/admin/applications", (route) =>
    route.fulfill({ json: applications }),
  );
}

test("estudiante envía una solicitud persistida y solo consulta sus datos", async ({ page }) => {
  await auth(page, "STUDENT");
  await mockStudentLearning(page);
  const writes: Array<{ method: string; body: unknown }> = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/learning/") && request.method() !== "GET") {
      writes.push({ method: request.method(), body: request.postDataJSON() });
    }
  });

  await page.goto("/talleres");
  await expect(page.getByRole("heading", { name: "Talleres para ti" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prototipado con IA" })).toBeVisible();
  await expect(page.getByText("Formación aplicada en IA", { exact: false })).toBeVisible();
  await expect(page.getByText("1 de 8 ocupados")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar solicitud" })).toBeDisabled();
  await expect(page.getByText("ni reserva un cupo", { exact: false })).toBeVisible();
  await expect(page.getByText("student-private-id", { exact: true })).toHaveCount(0);
  await expect(page.getByText("other-student", { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: "../docs/recursos/imagenes/va79-workshops-student-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../docs/recursos/imagenes/va79-workshops-student-mobile.png", fullPage: true });

  await page.getByText("Confirmo que leí los requisitos de participación.").click();
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByText("Solicitud registrada")).toBeVisible();
  await expect(page.getByRole("list").getByText("Enviada", { exact: true })).toBeVisible();
  expect(writes).toEqual([{
    method: "POST",
    body: { workshop_id: "workshop-79", requirements_acknowledged: true },
  }]);
});

test("estudiante conserva estado vacío y error del API", async ({ page }) => {
  await auth(page, "STUDENT");
  await mockStudentLearning(page, true);
  await page.goto("/talleres");
  await expect(page.getByText("No hay talleres abiertos disponibles por ahora.")).toBeVisible();
  await expect(page.getByText("Aún no has enviado solicitudes.")).toBeVisible();
});

test("estudiante ve el motivo de una decisión persistida después de recargar", async ({ page }) => {
  await auth(page, "STUDENT");
  await mockStudentLearning(page, false, [{
    id: "application-79",
    student_id: "student-own",
    workshop_id: "workshop-79",
    status: "REJECTED",
    comment: "No cumple los requisitos del taller.",
    created_at: "2026-10-13T12:00:00Z",
  }]);

  await page.goto("/talleres");
  const applications = page.getByRole("region", { name: "Mis solicitudes" });
  await expect(applications.getByText("Motivo registrado: No cumple los requisitos del taller.", { exact: true })).toBeVisible();
  await expect(applications.getByText("Rechazada", { exact: true })).toBeVisible();

  await page.reload();
  await expect(applications.getByText("Motivo registrado: No cumple los requisitos del taller.", { exact: true })).toBeVisible();
  await expect(applications.getByText("Rechazada", { exact: true })).toBeVisible();
});

test("admin publica talleres y revisa solicitudes reales", async ({ page }) => {
  await auth(page, "ADMIN");
  await mockAdminLearning(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/learning/") && request.method() !== "GET") {
      writes.push(`${request.method()} ${request.url().split("/api/v1")[1]}`);
    }
  });

  await page.goto("/talleres");
  await expect(page.getByRole("heading", { name: "Gestión de talleres" })).toBeVisible();
  await expect(page.getByText("1 de 8 cupos ocupados")).toBeVisible();
  await expect(page.getByText("Solicitud application-79", { exact: false })).toHaveCount(0);
  await expect(page.getByText("student-private-id", { exact: true })).toHaveCount(0);

  await page.getByLabel("Oportunidad publicada").selectOption("offer-79");
  await page.getByLabel("Nombre del taller").fill("Taller de prototipado");
  await page.getByLabel("Capacidad").fill("12");
  await page.getByLabel("Requisitos (separados por coma)").fill("Python, navegador");
  await page.getByRole("button", { name: "Crear y abrir taller" }).click();
  await expect(page.getByRole("status")).toContainText("Taller publicado y visible para estudiantes.");
  await expect(page.getByRole("article").getByText("Taller de prototipado")).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: "../docs/recursos/imagenes/va79-workshops-admin-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../docs/recursos/imagenes/va79-workshops-admin-mobile.png", fullPage: true });

  await page.getByLabel("Motivo de decisión (mínimo 10 caracteres)").fill("Requisitos revisados y cupo disponible.");
  await page.getByRole("button", { name: "Aceptar" }).click();
  await expect(page.getByText("Aceptada", { exact: true })).toBeVisible();
  await expect(page.getByText("2 de 8 cupos ocupados")).toBeVisible();
  expect(writes).toEqual([
    "POST /learning/workshops",
    "POST /learning/workshops/workshop-new/status",
    "POST /learning/admin/applications/application-79/status",
  ]);
});

test("el validador no puede abrir talleres", async ({ page }) => {
  await auth(page, "VALIDATOR");
  await page.goto("/talleres");
  await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Talleres" })).toHaveCount(0);
});
