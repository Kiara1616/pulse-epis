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

Cada decisión conserva actor, fecha UTC, estado y motivo. En PostgreSQL, la decisión bloquea la fila durante la transacción para evitar publicaciones concurrentes. El historial no admite edición ni eliminación desde esta API. Los borradores pueden corregirse mediante PUT `/api/v1/opportunities/{id}` con el contrato de registro más reason (10–1000 caracteres). Solo DRAFT admite edición; se conservan campos modificados, valores anteriores y nuevos, actor y motivo. Una corrección sin cambios no añade eventos. URL duplicada o edición de una oportunidad publicada/retirada: 409.

### Comparación formativa

El administrador selecciona oportunidades publicadas y define competencias objetivo y presupuesto por participante. La vista calcula unión de competencias, cobertura de objetivos por coincidencia exacta sin distinguir mayúsculas y temas compartidos entre alternativas. Sin selección muestra instrucciones, no un costo de cero. Se pueden elegir temas del catálogo o escribir objetivos adicionales. El análisis económico es opcional: se indica cantidad prevista (entero de 1 a 10.000) y presupuesto total del grupo. La suma de precios por persona se multiplica por la cantidad, suponiendo que todas las personas realizarán todos los cursos. Cero significa gratuito; null significa precio no informado. Un costo desconocido impide confirmar el total y presupuesto, aunque el subtotal conocido sí puede superar el límite. No se aplican descuentos, tarifas grupales ni costos adicionales. No es una optimización automática ni estima participantes, dominio, demanda laboral o empleabilidad. La selección de comparación es temporal; el catálogo y las decisiones sí persisten.

Captura con datos sintéticos: [Radar de oportunidades](../recursos/imagenes/admin-radar-demo.png).

### Operación y rollback

Aplicar `python -m alembic -c backend/alembic.ini upgrade head` con la configuración de base habitual antes de iniciar la versión nueva. Para rollback, respaldar primero la tabla, revertir la aplicación y ejecutar downgrade a `0009_roster_student_code`; el downgrade elimina exclusivamente el catálogo nuevo y su historial. No ejecutar contra una base institucional sin el procedimiento de respaldo existente.


## Revisión funcional de espacios ADMIN

Esta revisión corresponde a las secciones existentes, no declara capacidades futuras como implementadas. El centro de administración enlaza siete módulos operativos con su objetivo y siguiente acción.

| Espacio | Datos y propósito | Acciones disponibles | Decisión y límite |
|---|---|---|---|
| Resumen | Activos, certificados, cobertura, vencimientos, cortes y evolución | Elegir fuente, periodo y filtros; consultar gráficos y exportar | Observar situación institucional; evolución dentro del periodo, no impacto causal |
| Tecnologías | Emisores, credenciales y habilidades asociadas | Filtrar, explorar gráficos y exportar | Identificar áreas representadas; una credencial no prueba dominio de cada habilidad |
| Estudiantes | Directorio autorizado, matrícula, credenciales e historial | Buscar y consultar fichas mediante permisos existentes | Seguimiento individual; datos nominales restringidos, sin modificar trayectoria desde el radar |
| Brechas | Cobertura por habilidad frente a activos del corte | Filtrar, exportar y abrir radar | Orientar prioridades; ausencia de evidencia no equivale a falta de conocimientos ni demanda laboral |
| Administrar | Accesos a los siete módulos y responsabilidades | Navegar según tarea: actualizar matrícula, cifras o formación | Elegir el siguiente paso; no contiene indicadores inventados ni tarjetas sin acción |
| Padrón | Periodos, filas del CSV, resultado de conciliación e historial | Registrar periodo, previsualizar, importar por periodo y revisar rechazos | Mantener población y calidad; la vista previa detecta periodos, no sustituye validación completa al importar |
| Radar | Fuentes, contenido, nivel, requisitos, precio y decisiones | Registrar, editar borrador, filtrar, revisar/publicar/retirar y comparar | Elegir formación por contenido y presupuesto grupal opcional; publicación administrativa, sin inscripción real |
| Publicar indicadores | Periodo, corte, resultado de ETL e historial | Ejecutar publicación y consultar resultados | Actualizar tablero con padrón previo; no aprueba credenciales, responsabilidad del validador |

### Auditoría de alcance y continuaciones

#66 completa navegación y comparación del flujo existente. #64 mantiene pendiente evaluación y conexión de fuentes externas. Distribución estudiantil, inscripción a talleres, evaluación de dominio, planes guardados, demanda laboral externa y gestión de cuentas no forman parte de esta entrega. El número de participantes del comparador es un escenario declarado por ADMIN, no un conteo calculado desde matrículas. La selección y parámetros de comparación son temporales; las oportunidades y su auditoría sí persisten.
