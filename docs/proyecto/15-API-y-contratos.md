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
