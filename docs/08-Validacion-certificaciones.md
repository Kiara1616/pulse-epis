# Validación y auditoría de certificaciones

Este documento describe la implementación de [#14 — Implementar flujo de validación y auditoría de certificaciones](https://github.com/Kiara1616/pulse-epis/issues/14).

## Máquina de estados

Los estados persistidos son `PENDING`, `UNDER_REVIEW`, `APPROVED`, `OBSERVED`, `RESUBMITTED` y `REJECTED`. `EXPIRED` se calcula al consultar una fecha de corte: una certificación `APPROVED` con `expires_on` anterior al corte se muestra como vencida, pero no se sobrescribe el estado aprobado.

| Estado actual | Acción | Nuevo estado | Comentario |
|---|---|---|---|
| `PENDING` | `START_REVIEW` | `UNDER_REVIEW` | El validador toma la revisión |
| `RESUBMITTED` | `START_REVIEW` | `UNDER_REVIEW` | Revisión posterior a una observación |
| `UNDER_REVIEW` | `APPROVE` | `APPROVED` | Puede incluir comentario |
| `UNDER_REVIEW` | `OBSERVE` | `OBSERVED` | Comentario obligatorio |
| `UNDER_REVIEW` | `REJECT` | `REJECTED` | Comentario obligatorio |
| `OBSERVED` | Corrección del estudiante | `RESUBMITTED` | Conserva la observación anterior |

No se permiten aprobaciones directas desde `PENDING`, decisiones sobre `APPROVED`/`REJECTED` ni acciones sobre una aprobación vencida al corte indicado.

## Trazabilidad

`validations` conserva las decisiones finales del validador (`APPROVED`, `OBSERVED` y `REJECTED`) con actor, comentario y fecha. `certification_status_history` conserva cada transición, incluyendo la toma de revisión y la resubmisión del estudiante. Las filas se agregan dentro de la misma transacción que actualiza la certificación; no existe una operación de actualización o borrado de historial en la API.

La tabla `audit_logs` también registra el cambio de estado, pero evita copiar el comentario completo: solo almacena que existió comentario y los estados anterior y posterior. Esto permite auditar la operación sin duplicar innecesariamente el texto de la revisión.

## API

| Endpoint | Uso | Autorización |
|---|---|---|
| `GET /api/v1/validations?as_of=YYYY-MM-DD` | Bandeja sin correo ni código institucional nominal; devuelve `student_key`, evidencia y estado al corte | `VALIDATOR` + `CERTIFICATION_VALIDATE` |
| `POST /api/v1/validations/{id}` | Ejecutar `START_REVIEW`, `APPROVE`, `OBSERVE` o `REJECT` | `VALIDATOR` + `CERTIFICATION_VALIDATE` |
| `GET /api/v1/validations/{id}/history` | Consultar historial ascendente e inmutable | `VALIDATOR` + `CERTIFICATION_VALIDATE` |
| `POST /api/v1/validations/{id}/evidence/{evidence_id}/access` | Emitir enlace temporal de evidencia para revisar | `VALIDATOR` + `CERTIFICATION_VALIDATE` |

La interfaz `dashboard-app/src/app/validaciones/page.tsx` consume estos endpoints. Las decisiones que requieren explicación solicitan comentario antes de enviarse; el backend vuelve a validar el rol, la transición y el comentario.

En desarrollo, la API permite únicamente los orígenes definidos en `PULSE_CORS_ALLOWED_ORIGINS` y mantiene `allow_credentials` para la cookie de sesión. No se usa `*` con credenciales; los dominios de producción deben declararse de forma explícita.

## Regla para KPI

Una certificación solo es elegible si su estado persistido es `APPROVED` y permanece vigente al corte. La función `is_kpi_eligible` implementa esta regla para que las consultas analíticas futuras no cuenten observadas, rechazadas o aprobadas vencidas.
