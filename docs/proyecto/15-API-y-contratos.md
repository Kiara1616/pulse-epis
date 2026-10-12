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

## VA-02: contratos de frontend y fixtures sintéticos

La issue #68 añade contratos de vista reutilizables en `dashboard-app/src/shared/contracts/`. No crea tablas, endpoints nuevos ni un modo de autenticación alternativo. La API existente sigue siendo la fuente del producto. Las decisiones nuevas son provisionales hasta revisar VA-01 (#67) y cerrar modelo/API en VA-11/VA-12 (#77/#78).

| Contrato | Fuente actual y alcance | Campos derivados o provisionales |
|---|---|---|
| StudentSummary / StudentCredential | GET /certifications del usuario autenticado | Resumen por estado, etiqueta, cantidad de evidencias y lista de observadas corregibles; no calcular permisos ni histórico |
| ValidationQueueItem / ValidationCard | GET /validations autorizado al validador | Tarjeta de bandeja; conservar estado, clave seudónima, comentario, cantidad de evidencias y fecha de actualización |
| AdminIndicators | GET /indicators/overview | Preserva KPIs, dataset, periodo, corte y cobertura por habilidad; certificado no implica dominio |
| InterestProfile / LearningRoute | Solo fixtures; sin endpoints actuales | Intereses, objetivo, pasos, requisitos y evidencia registrada; no predecir habilidades ni empleabilidad |
| CourseCandidate / Opportunity | Solo fixtures; sin persistencia actual | Fuente, fecha, requisitos, estado, audiencia y explicación de relevancia |
| Workshop / Participation | Solo fixtures | Cupos, requisitos, ciclo de taller y solicitud; no inscripción real ni reserva de cupos |
| LoadState / DataResult | Contratos de presentación | loading/error/empty/ready y procedencia API/SYNTHETIC, con fecha de referencia |

### Estados y reglas

Certificaciones: PENDING, UNDER_REVIEW, APPROVED, OBSERVED, RESUBMITTED, REJECTED y EXPIRED. Estados desconocidos se presentan como UNKNOWN conservando rawStatus y sin habilitar corrección. Pending agrega PENDING/UNDER_REVIEW/RESUBMITTED; aprobadas, observadas, rechazadas, vencidas y desconocidas se cuentan por separado. La API determina estado efectivo y correction_allowed. El adaptador solo habilita edición si ese campo es true y el estado pertenece a PENDING/OBSERVED/RESUBMITTED, conforme al servicio existente. correctionIds incluye únicamente observadas corregibles.

El parámetro asOf del resumen identifica la fecha de referencia de la vista; no solicita un corte histórico ni recalcula vencimiento. Para indicadores se conserva el corte real de la API. Una credencial con fecha vencida pero estado APPROVED recibido se muestra según la respuesta; corregir una inconsistencia corresponde al backend, no a una regla oculta del frontend.

Estados provisionales de cursos: DETECTED, IN_REVIEW, PUBLISHED, DISCARDED, RETIRED. Oportunidades: DRAFT/PUBLISHED/RETIRED. Talleres: DRAFT/OPEN/CLOSED/COMPLETED. Solicitudes: SUBMITTED/ACCEPTED/REJECTED/COMPLETED. “Abierta” describe la oferta del taller, no una solicitud. Estas listas no implementan transiciones ni permisos; las futuras escrituras requieren autorización y validación de estado en backend. Fecha de consulta no confirma vigencia, y un curso publicado exige revisión humana en el flujo futuro.

### Uso por las próximas pantallas

```typescript
import { createApiDataSource, createFixtureDataSource } from "@/shared/contracts/sources";

// Datos existentes: conservar la sesión real, permisos y errores de la API.
const api = createApiDataSource();
const summary = await api.student("2026-10-01");

// Inyectar explícitamente SOLO en prototipos o pruebas, después de autenticar
// y proteger la pantalla según su rol. No se cambia AuthProvider ni RoleGate.
const fixture = createFixtureDataSource();
const opportunityDemo = await fixture.prototype();
// Renderizar una etiqueta visible: “Demostración sintética; no guarda cambios”.
```

Los adaptadores se pueden usar sin cambiar las pantallas actuales. No existe conmutador global de producción ni fallback a fixtures cuando la API falla; 401/403/503 permanecen errores. createFixtureDataSource no obtiene identidad, sesión, permisos ni links de acceso a evidencias. Devuelve nuevos objetos en cada consulta para que un prototipo no altere los ejemplos de otro. Sus datos tienen IDs DEMO y fuentes example.invalid, sin perfiles o documentos de personas reales. El resumen del estudiante y los indicadores son escenarios separados: no representan una misma población y no deben conciliarse entre sí.

Para las pantallas nuevas, usar LoadState con una etiqueta sintética visible en ready; empty debe indicar ausencia de registros, error permitir reintento si corresponde y 401 volver al control de sesión existente. Los fixtures facilitan diseño y pruebas; no conceden permisos ni sustituyen controles de la API. VA-03/VA-05/VA-06 implementarán las pantallas, VA-08/VA-09/VA-10 los prototipos y VA-13 sustituirá la inyección explícita por endpoints autorizados.

Verificación: `npx playwright test e2e/contracts.spec.ts` cubre resúmenes, estados desconocidos, permisos recibidos, independencia de fixtures, procedencia, adaptadores y ausencia de fallback. Los recorridos visuales existentes se verifican con `npm run test:e2e`. No se requieren migraciones para esta entrega.
