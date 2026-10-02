# API y contratos

## Autoridad y versión

FastAPI genera /openapi.json y Swagger en /docs. El paquete documental exporta ambos desde backend.app.main:app; OpenAPI es la referencia de esquemas y respuestas vigentes. El [dashboard-spec.json](../recursos/schemas/dashboard-spec.json) se extrae de AnalyticsOverview. El [esquema objetivo histórico](../recursos/schemas/dashboard-spec-objetivo.json) se conserva, identificado como propuesta, sin confundir camelCase y snake_case.

## Rutas principales

| Familia | Ruta o método | Autorización |
|---|---|---|
| Salud | GET /health, /ready | Salud del proceso/dependencias; sin datos nominales |
| Configuración | GET /api/v1/auth/config | Proveedores habilitados |
| Sesión | POST /api/v1/auth/local/login | Solo development/test |
| OIDC | GET /api/v1/auth/google/login y callback | Cuenta provisionada y proveedor configurado |
| Perfil | GET /api/v1/auth/me y POST logout | Sesión actual |
| Padrón | POST y GET /api/v1/padron/imports | PADRON_MANAGE |
| Certificaciones | POST/GET /api/v1/certifications y GET/PATCH por id | Lectura/escritura propia STUDENT |
| Evidencia | POST por certificación; emisión de access y download temporal | Propietario o validador; descarga con token válido |
| Validación | GET /api/v1/validations; POST por id; GET history | CERTIFICATION_VALIDATE |
| Indicadores | GET /api/v1/indicators/overview, periods, dictionary | ANALYTICS_READ |

La ruta overview exige period_code y admite cutoff_date, cohort, cycle, issuer y level. Los listados actuales no ofrecen paginación general. No hay endpoint público de indicadores ni endpoint de exportación PDF operativa.

## Respuesta de indicadores

AnalyticsOverview contiene filters, kpis, by_issuer, by_level, by_cohort, by_cycle, by_skill, evolution y skill_gaps. KPI usa active_students, certified_students, coverage_percent, approved_certifications y expiring_soon. Las series usan name/value. Los desgloses son agregados y la respuesta no incluye student_key, código o correo.

No se asumen indicadores de mercado, calidad o metodología completa dentro del JSON actual. Las propiedades, tipos y restricciones exactos se verifican en el esquema extraído y OpenAPI; sus cambios exigen actualizar la documentación y el frontend.

## Contrato de errores

El sobre es plano y se acompaña de X-Request-ID. El siguiente ejemplo muestra un error de validación, sin datos personales.

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {"loc": ["body", "issued_on"], "message": "Field required", "type": "missing"}
  ],
  "request_id": "identificador-de-la-solicitud"
}
```

401 exige nueva sesión; 403 indica permiso insuficiente; 404 identifica recurso/corte no disponible; 409 evita duplicados o transiciones inválidas; 422 describe campos; 503 indica dependencia no disponible. Las rutas definen códigos específicos y OpenAPI documenta sus esquemas. El frontend utiliza apiFetch con credentials=include y captura errores, sin reemplazarlos por mocks.

## Uso autorizado y cambios

Utilizar cookie de sesión obtenida por proveedor configurado. No pasar un rol arbitrario como autorización. El CSV del padrón y evidencia se envían como multipart; no fijar manualmente Content-Type de FormData. Para modificar un contrato, actualizar Pydantic, tipos frontend, pruebas y esquema documental; el validador compara el esquema con model_json_schema.
