# Plantilla de padrón EPIS

La plantilla [`padron.csv`](../recursos/templates/padron.csv) es el contrato para cargar estudiantes activos o históricos de Sistemas. La carga debe provenir de una fuente autorizada por EPIS; este archivo no contiene datos reales. `name` y `linkedin_url` son opcionales: permiten mostrar el nombre en validaciones y solicitar una sincronización consentida del perfil público.

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
| `name` | No | Nombre institucional, si la fuente autorizada lo incluye. Si queda vacío, el validador muestra el código. |
| `linkedin_url` | No | URL pública `https://www.linkedin.com/in/...`; se normaliza y nunca se usa para iniciar sesión. |

## Reglas de carga

- El archivo debe estar codificado en UTF-8. Debe contener las siete columnas obligatorias; puede añadir `name` y `linkedin_url`.
- El enlace de LinkedIn del padrón solo precarga el perfil. La sincronización con Apify se ejecuta desde “Mi perfil” con consentimiento del estudiante; los resultados se crean como `PENDING` y pasan por la bandeja del validador.
- La importación valida todas las filas antes de persistir. Si existe un rechazo, el lote queda `REJECTED` y no aplica cambios parciales.
- Una misma combinación de periodo y contenido se procesa una sola vez. Una nueva solicitud devuelve el mismo reporte con `idempotent: true`.
- Los rechazos devuelven número de fila, campo, código y mensaje genérico; no devuelven el valor inválido.
- El historial se consulta con `GET /api/v1/padron/imports?period_code=...` y solo está disponible para una cuenta `ADMIN` con `PADRON_MANAGE`.
