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

## Radar formativo del administrador

La ruta `/admin/oportunidades` permite registrar fuentes manuales, revisar y publicar o retirar oportunidades. Conserva la navegación, tarjetas y paleta institucional. La publicación actual cambia el catálogo administrativo; la entrega al dashboard del estudiante será una ampliación posterior. No hay recolector automático activo: la issue #64 requiere seleccionar fuentes autorizadas.

El catálogo persiste en `learning_opportunities` mediante la migración `0010_learning_opportunities`. Cada registro tiene título, proveedor, URL HTTPS única sin credenciales, área, nivel, competencias, requisitos, justificación, costo estimado por participante en PEN (null significa desconocido) y fecha de consulta. No se descarga la URL desde el servidor.

### Contrato API del radar

Todos los endpoints requieren sesión y permiso `CATALOG_MANAGE` (ADMIN). Sin sesión: 401; rol ajeno: 403; base no configurada: 503.

- `GET /api/v1/opportunities`: devuelve catálogo e historial.
- `POST /api/v1/opportunities`: registra los campos anteriores; responde 201 y estado DRAFT. URL duplicada: 409; contrato inválido: 422.
- `POST /api/v1/opportunities/{id}/decision`: recibe status PUBLISHED o RETIRED y reason (10–1000 caracteres). DRAFT puede publicarse o retirarse; PUBLISHED puede retirarse; RETIRED es terminal. Transición inválida: 409; ID inexistente: 404.

Cada decisión conserva actor, fecha UTC, estado y motivo. En PostgreSQL, la decisión bloquea la fila durante la transacción para evitar publicaciones concurrentes. El historial no admite edición ni eliminación desde esta API. Esta primera versión no modifica borradores: un registro erróneo puede retirarse; la corrección del catálogo será una ampliación posterior.

### Comparación formativa

El administrador selecciona oportunidades publicadas y define competencias objetivo y presupuesto por participante. La vista calcula unión de competencias, cobertura de objetivos por coincidencia exacta sin distinguir mayúsculas y suma de costos conocidos. Un costo desconocido impide confirmar el presupuesto. No es una optimización automática ni estima participantes, dominio, demanda laboral o empleabilidad. La selección de comparación es temporal; el catálogo y las decisiones sí persisten.

Captura con datos sintéticos: [Radar de oportunidades](../recursos/imagenes/admin-radar-demo.png).

### Operación y rollback

Aplicar `python -m alembic -c backend/alembic.ini upgrade head` con la configuración de base habitual antes de iniciar la versión nueva. Para rollback, respaldar primero la tabla, revertir la aplicación y ejecutar downgrade a `0009_roster_student_code`; el downgrade elimina exclusivamente el catálogo nuevo y su historial. No ejecutar contra una base institucional sin el procedimiento de respaldo existente.
