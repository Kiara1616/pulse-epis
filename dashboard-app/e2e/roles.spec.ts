import { test, expect, type Page } from "@playwright/test";

type Role = "ADMIN" | "VALIDATOR" | "STUDENT";

const overview = {
  filters: {
    period_code: "2026-II",
    cutoff_date: "2026-09-13",
    cohort: null,
    cycle: null,
    issuer: null,
    level: null,
  },
  kpis: {
    active_students: 120,
    certified_students: 42,
    coverage_percent: 35,
    approved_certifications: 58,
    expiring_soon: 4,
  },
  by_issuer: [{ name: "AWS", value: 30 }],
  by_level: [{ name: "Associate", value: 58 }],
  by_cohort: [{ name: "2023", value: 20 }],
  by_cycle: [{ name: "VIII", value: 18 }],
  by_skill: [{ name: "Cloud", value: 30 }],
  evolution: [{ cutoff_date: "2026-09-13", certified_students: 42, approved_certifications: 58 }],
  skill_gaps: [{ skill: "Cloud", certified_students: 30, gap_students: 90, coverage_percent: 25 }],
};

async function mockApi(page: Page, role: Role) {
  await page.route("**/api/v1/etl/runs**", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/auth/config", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ provider: "google" }),
  }));
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: `user-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@virtual.upt.pe`,
      role,
      student_id: role === "STUDENT" ? "student-1" : null,
      permissions: [],
    }),
  }));
  await page.route("**/api/v1/indicators/periods", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ code: "2026-II", starts_on: "2026-08-01", ends_on: "2026-12-31", latest_cutoff_date: "2026-09-13" }]),
  }));
  await page.route("**/api/v1/indicators/overview**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(overview),
  }));
  await page.route("**/api/v1/certifications", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([]),
  }));
  await page.route("**/api/v1/validations", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([]),
  }));
}

test.describe("navegación por rol", () => {
  test("estudiante puede corregir una observación conservando habilidades", async ({ page }) => {
    await mockApi(page, "STUDENT");
    let item = { id: "observada", credential_name: "Cloud", issuer_name: "AWS", issued_on: "2026-09-01", expires_on: null, source_url: null, status: "OBSERVED", correction_allowed: true, evidences: [], skills: [{ name: "Cloud Computing", level: "Fundamentals" }], latest_comment: "Completa el nombre de la certificación" };
    let patchCalls = 0;
    await page.route("**/api/v1/certifications", (route) => route.fulfill({ json: [item] }));
    await page.route("**/api/v1/certifications/observada", (route) => {
      patchCalls += 1;
      const update = route.request().postDataJSON();
      expect(update.skills).toEqual([{ name: "Cloud Computing", level: "Fundamentals" }]);
      expect(update.source_url).toBe(null);
      item = { ...item, ...update, status: "RESUBMITTED" };
      return route.fulfill({ json: item });
    });
    await page.goto("/mi-perfil");
    await page.getByRole("button", { name: "Ver detalle" }).click();
    const detail = page.getByRole("region", { name: "Detalle de certificación" });
    await expect(detail.getByText("Completa el nombre de la certificación")).toBeVisible();
    await detail.getByLabel("Nombre de la certificación").fill("AWS Cloud Fundamentals");
    await detail.getByLabel("URL de verificación (opcional)").fill("https:example.com");
    await detail.getByRole("button", { name: "Reenviar corrección" }).click();
    await expect(detail.getByText("Usa una URL HTTP(S) válida", { exact: false })).toBeVisible();
    expect(patchCalls).toBe(0);

    await detail.getByLabel("URL de verificación (opcional)").fill("https:///example.com");
    await detail.getByRole("button", { name: "Reenviar corrección" }).click();
    await expect(detail.getByText("Usa una URL HTTP(S) válida", { exact: false })).toBeVisible();
    expect(patchCalls).toBe(0);

    await detail.getByLabel("URL de verificación (opcional)").fill("   ");
    await detail.getByRole("button", { name: "Reenviar corrección" }).click();
    await expect(detail.getByText("Corrección reenviada al validador.")).toBeVisible();
    expect(patchCalls).toBe(1);
    await expect(page.getByRole("article").getByText("Reenviada", { exact: true })).toBeVisible();
  });

  test("administrador publica indicadores y ve el historial", async ({ page }) => {
    await mockApi(page, "ADMIN");
    await page.route("**/api/v1/padron/periods", (route) => route.fulfill({ json: [{ code: "2025-II", starts_on: "2025-08-04", ends_on: "2025-12-05" }] }));
    let run: object | null = null;
    await page.route("**/api/v1/etl/runs**", (route) => {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        expect(payload).toEqual({ period_code: "2025-II", cutoff_date: "2025-12-05" });
        run = { id: "published", ...payload, status: "APPLIED", accepted_rows: 0, rejected_rows: 0, idempotent: false, rejections: [] };
        return route.fulfill({ status: 201, json: run });
      }
      return route.fulfill({ json: run ? [run] : [] });
    });
    await page.goto("/admin/publicaciones");
    await page.getByRole("combobox", { name: "Periodo", exact: true }).selectOption("2025-II");
    await page.getByLabel("Fecha de corte").fill("2025-12-05");
    await page.getByRole("button", { name: "Publicar indicadores", exact: true }).click();
    await expect(page.getByText("Indicadores publicados", { exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Publicada", exact: true })).toBeVisible();
  });

  test("padrón permite registrar periodos y cargar un CSV de varios periodos por separado", async ({ page }) => {
    await mockApi(page, "ADMIN");
    const periods: Array<{code: string; starts_on: string; ends_on: string}> = [];
    await page.route("**/api/v1/padron/periods", async (route) => {
      if (route.request().method() === "POST") {
        const period = route.request().postDataJSON(); periods.push(period);
        await route.fulfill({ status: 201, json: period });
      } else await route.fulfill({ json: periods });
    });
    await page.route("**/api/v1/padron/preview", (route) => route.fulfill({ json: [
      { code: "2026-II", rows: 1 }, { code: "2025-II", rows: 2 }, { code: "2025-I", rows: 1 },
    ] }));
    const imported: string[] = [];
    await page.route("**/api/v1/padron/imports?**", (route) => {
      if (route.request().method() === "POST") {
        const url = new URL(route.request().url());
        expect(url.searchParams.get("selected_period_only")).toBe("true");
        const code = url.searchParams.get("period_code")!; imported.push(code);
        return route.fulfill({ status: 201, json: { id: code, period_code: code, status: "APPLIED", total_rows: 2, accepted_rows: 2, rejected_rows: 0, rejections: [], idempotent: false } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/estudiantes");
    await expect(page.getByText("No hay periodos registrados.", { exact: false })).toBeVisible();
    await page.getByLabel("CSV del padrón").setInputFiles({ name: "varios.csv", mimeType: "text/csv", buffer: Buffer.from("code,email,school,plan,cycle,status,period\n") });
    await page.getByRole("button", { name: "2025-II · 2 filas · Registrar" }).click();
    await page.getByLabel("Inicio del periodo").fill("2025-08-01");
    await page.getByLabel("Fin del periodo").fill("2025-12-31");
    await page.getByRole("button", { name: "Guardar periodo" }).click();
    await expect(page.getByRole("combobox", { name: "Periodo", exact: true })).toHaveValue("2025-II");
    await expect(page.getByText("Se importarán únicamente 2 filas de 2025-II.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Resultado de importación" })).toBeVisible();
    expect(imported).toEqual(["2025-II"]);
    await expect(page.getByRole("button", { name: "Importar", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "2025-I · 1 filas · Registrar" }).click();
    await expect(page.getByLabel("Código del periodo")).toHaveValue("2025-I");
  });

  test("el estudiante entra a su espacio, filtra el historial y tiene una sola salida", async ({ page }) => {
    await mockApi(page, "STUDENT");
    await page.route("**/api/v1/certifications", (route) => route.fulfill({
      json: [
        { id: "1", credential_name: "Oracle I", issuer_name: "Oracle", issued_on: "2026-09-10", status: "PENDING", evidences: [] },
        { id: "2", credential_name: "Computación en la nube", issuer_name: "AWS", issued_on: "2026-08-01", status: "APPROVED", evidences: [] },
      ],
    }));
    await page.goto("/");
    await expect(page).toHaveURL(/\/mi-perfil$/, { timeout: 15000 });
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: "Buscar en el panel" })).toHaveCount(0);
    await page.getByRole("textbox", { name: "Buscar certificaciones" }).fill("computacion");
    await expect(page.getByText("Computación en la nube", { exact: true })).toBeVisible();
    await expect(page.getByText("Oracle I", { exact: true })).toHaveCount(0);
    await page.getByRole("combobox", { name: "Filtrar por estado" }).selectOption("PENDING");
    await expect(page.getByText("No hay certificaciones que coincidan con tu búsqueda.")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.getByText("Oracle I", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Pulse EPIS", exact: true }).click();
    await expect(page).toHaveURL(/\/mi-perfil$/);
    await page.screenshot({ path: "test-results/dashboard-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Nueva certificación" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "test-results/dashboard-mobile.png", fullPage: true });
    await page.route("**/api/v1/auth/logout", (route) => route.fulfill({ status: 204 }));
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("heading", { name: "Ingresa a Pulse EPIS" })).toBeVisible();
    await page.screenshot({ path: "test-results/login-mobile.png", fullPage: true });
  });

  test("ADMIN puede abrir administración e indicadores agregados", async ({ page }) => {
    await mockApi(page, "ADMIN");
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Panorama de certificaciones" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administrar" })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Centro de administración" })).toBeVisible();
    await expect(page.getByText("Indicadores agregados")).toBeVisible();
  });

  test("VALIDATOR puede abrir la bandeja y no recibe navegación administrativa", async ({ page }) => {
    await mockApi(page, "VALIDATOR");
    await page.goto("/validaciones");

    await expect(page.getByRole("heading", { name: "Bandeja de validaciones" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Validar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administrar" })).toHaveCount(0);
    await expect(page.getByText("No hay certificaciones para revisar.")).toBeVisible();
  });

  test("STUDENT puede abrir su perfil y ve datos provenientes de la API", async ({ page }) => {
    await mockApi(page, "STUDENT");
    await page.goto("/mi-perfil");

    await expect(page.getByRole("heading", { name: "Mi avance" })).toBeVisible();
    await expect(page.getByText("Todavía no tienes certificaciones registradas.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Credenciales" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administrar" })).toHaveCount(0);
  });

  test("el estudiante ve estados resumidos y abre una corrección desde su siguiente acción", async ({ page }) => {
    await mockApi(page, "STUDENT");
    await page.route("**/api/v1/certifications", (route) => route.fulfill({
      json: [
        {
          id: "approved",
          issuer_id: "aws",
          issuer_name: "AWS",
          issuer_url: null,
          credential_name: "AWS Cloud Practitioner",
          external_id: null,
          issued_on: "2026-09-10",
          expires_on: null,
          status: "APPROVED",
          source_url: null,
          skills: [],
          evidences: [],
          created_at: "2026-09-10T00:00:00Z",
          updated_at: "2026-09-10T00:00:00Z",
          correction_allowed: false,
        },
        {
          id: "pending",
          issuer_id: "oracle",
          issuer_name: "Oracle",
          issuer_url: null,
          credential_name: "Oracle Foundations",
          external_id: null,
          issued_on: "2026-09-09",
          expires_on: null,
          status: "PENDING",
          source_url: null,
          skills: [],
          evidences: [],
          created_at: "2026-09-09T00:00:00Z",
          updated_at: "2026-09-09T00:00:00Z",
          correction_allowed: false,
        },
        {
          id: "observed",
          issuer_id: "datacamp",
          issuer_name: "DataCamp",
          issuer_url: null,
          credential_name: "Cloud Fundamentals",
          external_id: null,
          issued_on: "2026-09-08",
          expires_on: null,
          status: "OBSERVED",
          source_url: null,
          skills: [{ id: "skill-1", name: "Cloud", level: "Fundamentals" }],
          evidences: [],
          created_at: "2026-09-08T00:00:00Z",
          updated_at: "2026-09-08T00:00:00Z",
          correction_allowed: true,
          latest_comment: "Completa la evidencia de la certificación.",
        },
        {
          id: "expired",
          issuer_id: "microsoft",
          issuer_name: "Microsoft",
          issuer_url: null,
          credential_name: "Azure Fundamentals",
          external_id: null,
          issued_on: "2025-09-08",
          expires_on: "2026-09-08",
          status: "EXPIRED",
          source_url: null,
          skills: [],
          evidences: [],
          created_at: "2025-09-08T00:00:00Z",
          updated_at: "2026-09-08T00:00:00Z",
          correction_allowed: false,
        },
      ],
    }));

    await page.goto("/mi-perfil");
    await expect(page.getByRole("heading", { name: "Mi avance" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Aprobadas: 1" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Pendientes: 1" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Observadas: 1" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Vencidas: 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir corrección" })).toBeVisible();

    await page.getByRole("button", { name: "Corregir ahora" }).click();
    await expect(page.getByRole("heading", { name: "Detalle de certificación" })).toBeVisible();
    await expect(page.getByLabel("Nombre de la certificación")).toHaveValue("Cloud Fundamentals");
  });

  test("el estudiante puede abrir y cerrar el formulario desde el botón principal", async ({ page }) => {
    await mockApi(page, "STUDENT");
    await page.goto("/mi-perfil");

    await page.getByRole("button", { name: "Nueva certificación", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Registrar certificación" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar formulario", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Cerrar formulario", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Registrar certificación" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nueva certificación", exact: true })).toBeVisible();
  });

  test("valida fechas, URL y formato de evidencia antes de registrar", async ({ page }) => {
    await mockApi(page, "STUDENT");
    let createCalls = 0;
    let evidenceCalls = 0;
    await page.route("**/api/v1/certifications/new-cert/evidence", async (route) => {
      evidenceCalls += 1;
      await route.fulfill({ status: 201, json: { id: "evidence-1" } });
    });
    await page.route("**/api/v1/certifications", async (route) => {
      if (route.request().method() === "POST") {
        createCalls += 1;
        const payload = route.request().postDataJSON();
        expect(payload.expires_on).toBe("2026-09-20");
        expect(payload.source_url).toBe("https://verify.example.test/aws");
        return route.fulfill({ status: 201, json: { id: "new-cert" } });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto("/mi-perfil");
    await page.getByRole("button", { name: "Nueva certificación", exact: true }).click();
    await page.getByLabel("Nombre de la certificación").fill("AWS Cloud Practitioner");
    await page.getByLabel("Entidad emisora").fill("AWS");
    await page.getByLabel("Fecha de emisión").fill("2026-09-10");
    await page.getByLabel("Fecha de vencimiento (opcional)").fill("2026-09-01");
    await page.getByLabel("URL pública de verificación (opcional)").fill("ftp://invalid.example.test");
    await page.getByLabel("Habilidades, separadas por comas").fill("Cloud");
    await page.getByRole("button", { name: "Enviar a validación" }).click();

    await expect(page.getByText("La fecha de vencimiento no puede ser anterior a la emisión.", { exact: true })).toBeVisible();
    await expect(page.getByText("Usa una URL HTTP(S) válida", { exact: false })).toBeVisible();
    expect(createCalls).toBe(0);

    await page.getByLabel("Fecha de vencimiento (opcional)").fill("2026-09-20");
    for (const invalidUrl of ["https:example.com", "https:///example.com"]) {
      await page.getByLabel("URL pública de verificación (opcional)").fill(invalidUrl);
      await page.getByRole("button", { name: "Enviar a validación" }).click();
      await expect(page.getByText("Usa una URL HTTP(S) válida", { exact: false })).toBeVisible();
      expect(createCalls).toBe(0);
    }

    await page.getByLabel("URL pública de verificación (opcional)").fill("https://verify.example.test/aws");
    await page.locator('input[type="file"]').setInputFiles({
      name: "evidence.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an accepted evidence format"),
    });
    await page.getByRole("button", { name: "Enviar a validación" }).click();
    await expect(page.getByText("Formato no admitido. Usa un archivo PDF, PNG o JPEG.", { exact: true })).toBeVisible();
    expect(createCalls).toBe(0);

    await page.locator('input[type="file"]').setInputFiles({
      name: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nsynthetic evidence\n%%EOF"),
    });
    await page.getByRole("button", { name: "Enviar a validación" }).click();
    await expect(page.getByText("Certificación registrada. El validador académico revisará la evidencia.", { exact: true })).toBeVisible();
    expect(createCalls).toBe(1);
    expect(evidenceCalls).toBe(1);
  });

  test("normaliza una URL opcional vacía al registrar", async ({ page }) => {
    await mockApi(page, "STUDENT");
    let submittedSourceUrl: unknown = "not-submitted";
    await page.route("**/api/v1/certifications", async (route) => {
      if (route.request().method() === "POST") {
        submittedSourceUrl = route.request().postDataJSON().source_url;
        return route.fulfill({ status: 201, json: { id: "without-url" } });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto("/mi-perfil");
    await page.getByRole("button", { name: "Nueva certificación", exact: true }).click();
    await page.getByLabel("Nombre de la certificación").fill("AWS Cloud Practitioner");
    await page.getByLabel("Entidad emisora").fill("AWS");
    await page.getByLabel("Fecha de emisión").fill("2026-09-10");
    await page.getByLabel("URL pública de verificación (opcional)").fill("   ");
    await page.getByLabel("Habilidades, separadas por comas").fill("Cloud");
    await page.getByRole("button", { name: "Enviar a validación" }).click();

    await expect(
      page.getByText("Certificación registrada. El validador académico revisará la evidencia.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(submittedSourceUrl).toBe(null);
  });

  test("el espacio del estudiante comunica carga, error y sesión expirada", async ({ page }) => {
    await mockApi(page, "STUDENT");
    let releaseRequest!: () => void;
    const requestReleased = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await page.route("**/api/v1/certifications", async (route) => {
      await requestReleased;
      await route.fulfill({ json: [] });
    });

    await page.goto("/mi-perfil");
    await expect(page.getByText("Cargando tus certificaciones…", { exact: true })).toBeVisible();
    releaseRequest();
    await expect(page.getByText("Todavía no tienes certificaciones registradas.")).toBeVisible();

    await page.reload();
    await page.route("**/api/v1/certifications", (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Servicio temporalmente no disponible" }),
    }));
    await expect(page.getByRole("heading", { name: "No se pudo cargar la información" })).toBeVisible();
    await expect(page.getByText("Servicio temporalmente no disponible", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();

    await page.reload();
    await page.route("**/api/v1/certifications", (route) => route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Sesión expirada" }),
    }));
    await expect(page.getByRole("heading", { name: "Tu sesión expiró" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Volver a iniciar sesión" })).toBeVisible();
  });
});


test("validador abre el envío, revisa imagen y observa con correcciones", async ({ page }) => {
  await mockApi(page, "VALIDATOR");
  const record = { id: "review-1", student_key: "stu-002", credential_name: "Power BI", issuer_name: "DataCamp", issued_on: "2025-08-08", expires_on: "2027-08-08", status: "UNDER_REVIEW", stored_status: "UNDER_REVIEW", latest_comment: null, external_id: "DC-123", skills: [{ name: "Modelado", level: "Intermedio" }], evidences: [{ id: "image-1", evidence_type: "FILE", original_filename: "certificado.png", content_type: "image/png" }] };
  await page.route("**/api/v1/validations", (route) => route.fulfill({ json: [record] }));
  await page.route("**/api/v1/validations/review-1/evidence/image-1/access", (route) => route.fulfill({ json: { access_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==" } }));
  await page.route("**/api/v1/validations/review-1/history", (route) => route.fulfill({ json: [
    { id: "history-1", certification_id: "review-1", actor_user_id: "validator-1", from_status: "PENDING", to_status: "UNDER_REVIEW", comment: null, cutoff_date: null, changed_at: "2026-09-01T10:00:00Z" },
    { id: "history-2", certification_id: "review-1", actor_user_id: "validator-1", from_status: "UNDER_REVIEW", to_status: "OBSERVED", comment: "Sube una imagen donde se vea el titular completo.", cutoff_date: null, changed_at: "2026-09-02T10:00:00Z" },
  ] }));
  let decision: { action: string; comment: string } | undefined;
  await page.route("**/api/v1/validations/review-1", async (route) => {
    decision = route.request().postDataJSON();
    record.status = "OBSERVED";
    await route.fulfill({ json: { status: "OBSERVED" } });
  });
  await page.goto("/validaciones");
  await page.getByRole("button", { name: /Power BI.*Ver envío/ }).click();
  const detail = page.getByRole("region", { name: "Detalle del envío" });
  await expect(detail.getByText("DC-123")).toBeVisible();
  await expect(detail.getByText("Modelado (Intermedio)")).toBeVisible();
  await expect(detail.getByRole("img", { name: "Certificado adjunto por el estudiante" })).toBeVisible();
  await detail.getByRole("button", { name: "Observar", exact: true }).click();
  await expect(page.getByText("Escribe el motivo o las correcciones", { exact: false })).toBeVisible();
  expect(decision).toBeUndefined();
  await detail.getByLabel("Comentario para el estudiante").fill("Sube una imagen donde se vea el titular completo.");
  await detail.getByRole("button", { name: "Observar", exact: true }).click();
  await expect(detail.getByText("Observada", { exact: true })).toBeVisible();
  expect(decision).toEqual({ action: "OBSERVE", comment: "Sube una imagen donde se vea el titular completo." });
  await detail.getByRole("button", { name: "Ver historial de decisiones" }).click();
  const history = page.getByRole("region", { name: "Historial de decisiones" });
  await expect(history.getByText("En revisión → Observada", { exact: false })).toBeVisible();
  await expect(history.getByText("Sube una imagen donde se vea el titular completo.", { exact: true })).toBeVisible();
});

test("STUDENT no puede acceder a la bandeja del validador", async ({ page }) => {
  await mockApi(page, "STUDENT");
  let validationRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/validations")) validationRequests += 1;
  });

  await page.goto("/validaciones");

  await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
  await expect(page.getByText("El rol Estudiante no tiene permiso", { exact: false })).toBeVisible();
  expect(validationRequests).toBe(0);
});

test("validador filtra la bandeja por estado, antigüedad y tipo de caso", async ({ page }) => {
  await mockApi(page, "VALIDATOR");
  const now = Date.now();
  const records = [
    {
      id: "new-old",
      student_key: "stu-001",
      credential_name: "New Certification",
      issuer_name: "AWS",
      issued_on: "2026-09-01",
      expires_on: null,
      status: "PENDING",
      stored_status: "PENDING",
      latest_comment: null,
      source_url: null,
      updated_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      evidences: [],
    },
    {
      id: "correction-recent",
      student_key: "stu-002",
      credential_name: "Correction Case",
      issuer_name: "DataCamp",
      issued_on: "2026-10-01",
      expires_on: null,
      status: "RESUBMITTED",
      stored_status: "RESUBMITTED",
      latest_comment: "Completa la evidencia.",
      source_url: null,
      updated_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      evidences: [],
    },
    {
      id: "approved-recent",
      student_key: "stu-003",
      credential_name: "Approved Case",
      issuer_name: "Oracle",
      issued_on: "2026-10-02",
      expires_on: null,
      status: "APPROVED",
      stored_status: "APPROVED",
      latest_comment: null,
      source_url: null,
      updated_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      evidences: [],
    },
  ];
  await page.route("**/api/v1/validations", (route) => route.fulfill({ json: records }));

  await page.goto("/validaciones");
  await expect(page.getByRole("heading", { name: "Bandeja de validaciones" })).toBeVisible();
  await expect(page.getByText("New Certification", { exact: true })).toBeVisible();
  await expect(page.getByText("Correction Case", { exact: true })).toBeVisible();

  await page.getByRole("combobox", { name: "Filtrar por estado" }).selectOption("RESUBMITTED");
  await expect(page.getByText("Correction Case", { exact: true })).toBeVisible();
  await expect(page.getByText("New Certification", { exact: true })).toHaveCount(0);

  await page.getByRole("combobox", { name: "Filtrar por estado" }).selectOption("ALL");
  await page.getByRole("combobox", { name: "Filtrar por antigüedad" }).selectOption("OLDER");
  await expect(page.getByText("New Certification", { exact: true })).toBeVisible();
  await expect(page.getByText("Correction Case", { exact: true })).toHaveCount(0);

  await page.getByRole("combobox", { name: "Filtrar por antigüedad" }).selectOption("ALL");
  await page.getByRole("combobox", { name: "Filtrar por tipo de caso" }).selectOption("CORRECTION");
  await expect(page.getByText("Correction Case", { exact: true })).toBeVisible();
  await expect(page.getByText("New Certification", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Approved Case", { exact: true })).toHaveCount(0);
});
