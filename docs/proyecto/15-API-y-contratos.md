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

## VA-12: API persistente de formación

#78 expone `/api/v1/learning`. Requiere aplicar `0010_learning_domain` de #77. ADMIN mantiene catálogos y decisiones; STUDENT utiliza preferencias y solicitudes propias. VALIDATOR no obtiene administración de formación. Las rutas usan sesión existente y modelos request/response publicados en OpenAPI. Las entidades devuelven UUID, created_at y sus campos declarados; no devuelven correos, códigos, evidencia privada ni perfiles ajenos.

| Endpoint | Operación y permiso |
|---|---|
| GET /learning/interests | ADMIN todos; STUDENT activos |
| POST /learning/interests; PUT /learning/interests/{id} | ADMIN: name (1–120), active |
| GET /learning/{kind} | kind=routes/courses/offers/workshops; ADMIN todos, STUDENT solo publicados, talleres abiertos con oferta y curso publicados |
| POST /learning/routes; PUT /learning/routes/{id} | ADMIN: title, description, steps (title, skills, prerequisites); editar solo DRAFT |
| POST /learning/courses; PUT /learning/courses/{id} | ADMIN: title, provider, source_url HTTPS, checked_on no futura, requirements, skills; corrección solo DETECTED/IN_REVIEW |
| POST /learning/offers; PUT /learning/offers/{id} | ADMIN: course_id en revisión, title, cycles I–X, interest_ids activos, relevance; editar solo DRAFT sin cambiar curso |
| POST /learning/workshops; PUT /learning/workshops/{id} | ADMIN: offer_id publicado, title, capacity entero 1–10000, requirements; editar solo DRAFT sin cambiar oferta |
| POST /learning/{kind}/{id}/status | ADMIN: status y reason de 10–2000 caracteres |
| GET/PUT /learning/me/profile | STUDENT: route_id publicado u opcional, interest_ids activos; identidad derivada de sesión |
| GET /learning/me/applications; GET /learning/me/applications/{id} | STUDENT: solo solicitudes propias; ajenas responden 404 |
| POST /learning/me/applications | STUDENT: workshop_id y requirements_acknowledged=true; taller abierto y oferta/curso publicados |
| GET /learning/admin/applications | ADMIN: solicitudes y estado |
| POST /learning/admin/applications/{id}/status | ADMIN: status y reason; aceptar con cupos disponibles |
| GET /learning/admin/audit?entity_id={id} | ADMIN: auditoría con secuencia por entidad; sin filtro, listado temporal de eventos |

Ejemplo de preferencias: `{ "route_id": "UUID-de-ruta-publicada", "interest_ids": ["UUID-de-interes-activo"] }`. Respuesta con los mismos campos e IDs canónicos. Campos ajenos como student_id son rechazados, no usados como dueño. Los intereses duplicados se normalizan; las asociaciones tienen FK y unicidad. Retirar una ruta no borra preferencias históricas; solo rutas publicadas se pueden seleccionar nuevamente.

La oferta acepta `{ "course_id": "UUID", "title": "Formación en IA", "cycles": ["V"], "interest_ids": [], "relevance": "Contenido relevante para profundizar la formación." }`. Audiencia es información declarada para orientar selección, no autorización automática ni evaluación de conocimientos. El catálogo de oportunidades publicadas está visible a STUDENT; no se presenta como recomendación personalizada. Los requisitos son revisados por ADMIN al aceptar una solicitud, y el acuse del estudiante no acredita que los haya cumplido.

Transiciones: curso DETECTED → IN_REVIEW/DISCARDED y IN_REVIEW → DISCARDED. Crear una oportunidad exige IN_REVIEW; publicarla exige audiencia (ciclo o interés) y relevancia de al menos 10 caracteres y cambia el curso a PUBLISHED en la misma transacción. Oportunidad DRAFT → PUBLISHED/RETIRED, PUBLISHED → RETIRED; retirar sincroniza curso a RETIRED. Ruta DRAFT → PUBLISHED/RETIRED, PUBLISHED → RETIRED. Taller DRAFT → OPEN → CLOSED → COMPLETED. Solicitud SUBMITTED → ACCEPTED/REJECTED, ACCEPTED → COMPLETED. Estados terminales no se reabren desde esta API.

Cupos: solicitudes enviadas no reservan cupo; ACCEPTED y COMPLETED consumen cupo. Al aceptar, se bloquea la fila del taller y se valida el conteo bajo la transacción. Un estudiante solo tiene una solicitud por taller. Cambios de estado y preferencias conservan actor, motivo y valores anteriores/nuevos; auditoría es de solo lectura. La secuencia por entidad evita ordenar empates por UUID. Lecturas y escrituras son atómicas: un error no deja publicaciones o auditorías parciales.

Errores mantienen la envoltura existente: error.code/error.message. 401 sin sesión; 403 por rol o estudiante no provisionado; 404 inexistente/no disponible o solicitud ajena; 409 duplicado, estado inválido o cupos completos; 422 contrato inválido, referencia inactiva o publicación incompleta; 503 sin base configurada. No existe fallback a fixtures ni descarga de URLs. Los detalles de estado no permiten cambiar permisos de sesión.

Tests: SQLite para persistencia, contratos, privacidad y transiciones; PostgreSQL con `LEARNING_TEST_DATABASE_URL` apuntando exclusivamente a una base de pruebas para aceptación concurrente. Cada caso PostgreSQL crea y elimina un esquema propio learning_test_UUID; no modifica tablas de otra aplicación. Los endpoints se entregan antes de conectar las pantallas en #79: el prototipo #75 aún no los consume. El cierre #80 debe distinguir flujo HTTP persistente de aceptación visual integrada.
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

## Integración de pantallas con formación persistente

`dashboard-app/src/shared/api/learning.ts` consume el contrato `/api/v1/learning` con cookies de sesión mediante `apiFetch`. `/mi-ruta` usa GET interests/routes/courses/offers y GET/PUT me/profile; `/admin/radar` usa cursos, oportunidades y transiciones; `/talleres` usa talleres y solicitudes propias o administrativas según el rol. No existe fallback sintético ante errores de la API.

El estudiante confirma lectura de requisitos con `requirements_acknowledged=true` al solicitar; esto no prueba elegibilidad ni reserva cupo. La aceptación administrativa valida capacidad y persiste el motivo en `comment`, que la pantalla de solicitudes propias muestra. Catálogos publicados y permisos siguen definidos por el backend. La prueba de navegador VA-14 verifica estas relaciones con sesiones reales y datos sintéticos; las pruebas HTTP/backend cubren reglas de titularidad, transiciones y concurrencia PostgreSQL.
