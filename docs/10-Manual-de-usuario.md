# Manual de usuario de Pulse EPIS

## Alcance actual

Este manual describe el flujo del MVP. La autenticación, padrón, registro de certificaciones, evidencias y validación están disponibles en la API. El dashboard todavía utiliza datos demostrativos hasta completar el issue #17.

## Inicio de sesión

1. Abra la aplicación y seleccione iniciar sesión con Google.
2. Use la cuenta institucional autorizada.
3. El sistema comprobará el usuario provisionado y, para estudiantes, su pertenencia al padrón EPIS.
4. Si la cuenta no está habilitada, solicite al administrador revisar el padrón o la asignación del rol.

La aplicación solicita únicamente identidad básica (`openid email profile`) y no acceso a Gmail.

## Rol STUDENT

El estudiante puede registrar y consultar exclusivamente sus propias certificaciones.

1. Registre proveedor, credencial, fechas, URL y habilidades.
2. Adjunte una evidencia PDF o una URL HTTPS verificable.
3. Envíe el registro, que comenzará en estado `PENDING`.
4. Consulte el estado de revisión.
5. Si queda `OBSERVED`, corrija los datos o la evidencia y reenvíe.

El estudiante no puede aprobar su propia credencial ni consultar información nominal de otros estudiantes.

## Rol VALIDATOR

El validador opera la bandeja de certificaciones y puede consultar indicadores agregados autorizados.

1. Abra la bandeja y seleccione una certificación pendiente.
2. Revise sus datos y solicite acceso temporal a la evidencia.
3. Inicie la revisión y emita `APPROVED`, `OBSERVED` o `REJECTED` con comentario.
4. Consulte el historial inmutable de decisiones cuando necesite trazabilidad.

Solo las certificaciones `APPROVED` se publican en los indicadores oficiales.

## Rol ADMIN

El administrador gestiona padrón, periodos, catálogos y usuarios de acuerdo con sus permisos, además de consultar analítica agregada.

1. Prepare el CSV usando `docs/templates/padron.csv`.
2. Importe el padrón para el periodo correcto.
3. Revise el reporte de registros aceptados y rechazados.
4. Corrija la fuente y repita la carga; una fuente idéntica no crea duplicados.
5. Supervise las corridas ETL y la fecha de corte publicada.

## Indicadores y filtros

Los roles con `ANALYTICS_READ` consultan el último snapshot o una fecha de corte específica. Los filtros disponibles son periodo, cohorte, ciclo, proveedor y nivel. La respuesta nunca incluye correos, códigos ni claves estudiantiles.

## Errores frecuentes

| Código | Significado | Acción recomendada |
|---|---|---|
| `UNAUTHENTICATED` | No existe una sesión válida | Iniciar sesión nuevamente |
| `FORBIDDEN` | El rol no tiene el permiso | Usar el módulo correspondiente al rol |
| `SNAPSHOT_NOT_FOUND` | No existe publicación para el corte | Ejecutar o revisar el ETL |
| `VALIDATION_ERROR` | Un campo no cumple el contrato | Corregir los datos indicados |

## Privacidad

No publique padrones, correos, códigos institucionales ni evidencias en issues, capturas o repositorios. Los enlaces de evidencia son temporales y deben utilizarse únicamente durante la revisión autorizada.
