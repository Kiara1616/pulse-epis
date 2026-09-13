# Plantilla de padrón EPIS

La plantilla [`padron.csv`](templates/padron.csv) es el contrato mínimo para cargar estudiantes activos o históricos de Sistemas. La carga debe provenir de una fuente autorizada por EPIS; este archivo no contiene datos reales.

## Columnas

| Columna | Obligatoria | Regla |
|---|:---:|---|
| `code` | Sí | Código estable del estudiante. Se usa únicamente para generar una clave interna HMAC y no se publica ni se guarda en claro. |
| `email` | Sí | Correo institucional permitido por la configuración del entorno. |
| `school` | Sí | Debe coincidir con una escuela autorizada, por defecto `EPIS`. |
| `plan` | Sí | Plan de estudios, hasta 120 caracteres. |
| `cycle` | Sí | Ciclo o semestre académico, hasta 32 caracteres. |
| `status` | Sí | `ACTIVE`, `INACTIVE` o `GRADUATED`; también se aceptan sus equivalentes `ACTIVO`, `INACTIVO`, `EGRESADO` y `GRADUADO`. |
| `period` | Sí | Código del periodo previamente creado en `academic_periods`; debe coincidir con el periodo de la solicitud. |

## Reglas de carga

- El archivo debe estar codificado en UTF-8 y respetar exactamente las siete columnas.
- La importación valida todas las filas antes de persistir. Si existe un rechazo, el lote queda `REJECTED` y no aplica cambios parciales.
- Una misma combinación de periodo y contenido se procesa una sola vez. Una nueva solicitud devuelve el mismo reporte con `idempotent: true`.
- Los rechazos devuelven número de fila, campo, código y mensaje genérico; no devuelven el valor inválido.
- El historial se consulta con `GET /api/v1/padron/imports?period_code=...` y solo está disponible para una cuenta `ADMIN` con `PADRON_MANAGE`.
