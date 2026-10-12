# VA-01 — Recorridos y criterios de aceptación por rol

**Issue:** [#67 — Definir recorridos y criterios de aceptación por rol](https://github.com/Kiara1616/pulse-epis/issues/67)<br>
**Responsable:** @Vinny-13<br>
**Revisión:** @Kiara1616<br>
**Dependencias:** ninguna<br>
**Estado:** referencia para diseño e implementación

## Propósito

Este documento fija los recorridos mínimos del estudiante, validador y administrador antes de ampliar el modelo de datos. Sirve como contrato de producto para las siguientes issues de valor agregado: cada pantalla debe declarar su rol, su acción principal, el permiso que la respalda, la fuente de datos y el comportamiento esperado cuando una consulta no puede completarse.

El documento describe el contrato vigente del repositorio y conserva la línea base con la que se definió VA-01. Las issues posteriores pueden ampliar esa línea base, pero no cambian retrospectivamente el alcance de esta issue. No convierte una pantalla existente en una autorización nueva ni infiere capacidades a partir de la navegación del frontend.

## Decisiones y límites

1. La API FastAPI es la fuente autoritativa para identidad, permisos, certificaciones, evidencias, validaciones, padrón, ETL e indicadores registrados.
2. `RoleGate` solo protege la experiencia de navegación. La autorización real la aplican `require_permissions` y las reglas de alcance del backend.
3. Los fixtures sintéticos se pueden usar para contratos, pruebas y prototipos explícitos. No son un fallback cuando falla la API, no crean una sesión y no conceden permisos.
4. Un indicador de `dataset=demo` es una demostración local sintética; no representa el padrón institucional, no se usa para decisiones de calidad y no está permitido en staging o producción.
5. Esta issue no crea tablas, migraciones, entidades, endpoints ni permisos nuevos.
6. No se publican padrones, correos, códigos institucionales, evidencias reales ni identificadores personales en fixtures, capturas o documentación.

### Evolución posterior ya integrada en `main`

La rama se actualizó sobre `origin/main` en `0b67964`, que ya incorpora trabajo posterior de formación complementaria. Esto no altera el alcance documental de VA-01, pero sí evita describir como inexistente una capacidad que ahora forma parte del repositorio:

- `backend/app/api/routes/learning.py` y la migración `0010_learning_domain` exponen rutas persistentes para intereses, rutas, cursos, oportunidades, talleres, preferencias del estudiante, solicitudes y auditoría.
- La API de formación usa la sesión existente: `ADMIN` administra catálogos y decisiones; `STUDENT` consulta catálogos publicados, guarda sus preferencias y gestiona sus propias solicitudes; `VALIDATOR` no recibe permisos de administración de formación.
- `/admin/radar` continúa siendo un prototipo visual sintético y todavía no sustituye sus datos de demostración por la API persistente.

Por tanto, “fuera de alcance” en este documento significa “no implementado por VA-01”; no significa que las issues posteriores no hayan añadido capacidades en `main`.

## Roles y permisos vigentes

La siguiente matriz refleja `backend/app/auth/rbac.py`. La columna de pantalla indica el alcance que se puede implementar con el permiso actual; no implica que todas las operaciones administrativas que tienen permiso ya cuenten con una vista.

| Rol | Permisos vigentes | Alcance de producto |
|---|---|---|
| `ADMIN` | `ANALYTICS_READ`, `AUDIT_READ`, `CATALOG_MANAGE`, `PADRON_MANAGE`, `PERIOD_MANAGE`, `USER_MANAGE` | Indicadores agregados, calidad/publicación ETL y gestión del padrón. Las pantallas generales de auditoría, catálogos y usuarios todavía no forman parte del recorrido implementado. |
| `VALIDATOR` | `ANALYTICS_READ`, `CERTIFICATION_VALIDATE` | Indicadores agregados y bandeja de revisión de certificaciones. No administra padrón, cuentas ni catálogos. |
| `STUDENT` | `CERTIFICATION_READ_OWN`, `CERTIFICATION_WRITE_OWN` | Consulta y modifica únicamente sus propias certificaciones y evidencias. No consulta expedientes de otros estudiantes ni decide sobre sus credenciales. |

## Matriz de pantalla, acción, permiso y fuente

`API` significa que la pantalla debe utilizar los endpoints existentes con la sesión actual. `SYNTHETIC` significa que la funcionalidad todavía no tiene contrato persistente y solo puede presentarse como demostración visible y no oficial.

En el dominio `/learning`, las rutas actuales reciben `require_roles(ADMIN)` o `require_roles(STUDENT)` y aplican además alcance propio para preferencias y solicitudes. No se agrega una nueva constante de `Permission` por esta issue; las pantallas deben conservar esa autorización de backend y no confiar solo en el ocultamiento de enlaces.

| Rol | Pantalla o recorrido | Acción mínima | Permiso backend | Fuente actual | Resultado esperado |
|---|---|---|---|---|---|
| Todos | Acceso y sesión | Iniciar sesión con Google institucional; en desarrollo, usar una cuenta local sintética | Sesión autenticada; la cuenta debe estar provisionada y activa | `API` — `/auth/config`, `/auth/me`, login y logout | Se conoce la identidad real de la sesión y se muestra solo la navegación del rol recibido |
| `ADMIN`, `VALIDATOR` | `/` — resumen | Consultar KPIs, filtros, evolución, desglose y exportación | `ANALYTICS_READ` | `API` — `/indicators/periods`, `/indicators/overview`, `/indicators/report.*` | Se muestran datos agregados con periodo, corte, fuente y filtros visibles |
| `ADMIN`, `VALIDATOR` | `/tecnologias` | Explorar emisores, niveles y habilidades acreditadas | `ANALYTICS_READ` | `API` — indicadores | Se muestran agregados; nunca rankings nominales ni códigos de estudiantes |
| `VALIDATOR` | `/estudiantes` | Consultar distribución agregada por cohorte/año de ingreso | `ANALYTICS_READ` | `API` — indicadores | Se orienta la revisión sin exponer la identidad del padrón |
| `ADMIN` | `/estudiantes` | Consultar estudiantes del padrón por periodo y filtros autorizados | `PADRON_MANAGE` | `API` — `/padron/periods`, `/padron/students` | Se consulta la fuente maestra sin convertir la vista en un ranking público |
| `ADMIN` | `/brechas` | Comparar cobertura y brecha estimada por habilidad | `ANALYTICS_READ` | `API` — indicadores; `dataset=demo` solo local | La brecha se explica como ausencia de evidencia aprobada, con fecha de corte y fuente |
| `ADMIN` | `/admin` | Revisar prioridades institucionales y calidad del corte | `ANALYTICS_READ`, `PERIOD_MANAGE` cuando se consulta calidad ETL | `API` — indicadores y `/etl/runs` | Las prioridades enlazan a la información disponible y distinguen datos registrados de demostración |
| `ADMIN` | `/admin/estudiantes` | Crear periodos, previsualizar CSV, importar padrón y consultar rechazos | `PADRON_MANAGE` | `API` — `/padron/periods`, `/padron/preview`, `/padron/imports` | La carga es atómica, reporta aceptados/rechazados y no deja datos parcialmente importados |
| `ADMIN` | `/admin/publicaciones` | Consultar y ejecutar una publicación ETL por periodo y corte | `PERIOD_MANAGE` | `API` — `/etl/runs` | Solo se publica un corte que cumple las reglas de calidad; una repetición es idempotente |
| `VALIDATOR` | `/validaciones` | Tomar una revisión, consultar evidencia temporal, decidir y ver historial | `CERTIFICATION_VALIDATE` | `API` — `/validations` y endpoints de evidencia/historial | La decisión valida la transición; observar y rechazar exigen comentario visible para el estudiante |
| `STUDENT` | `/mi-perfil` | Registrar, consultar, corregir y reenviar certificaciones propias | `CERTIFICATION_READ_OWN`, `CERTIFICATION_WRITE_OWN` | `API` — `/certifications` y evidencias | El registro comienza pendiente, conserva su historial y nunca permite modificar el expediente de otra persona |
| `STUDENT` | Resumen de avance futuro | Consultar intereses, objetivo/ruta y solicitudes propias | `STUDENT` — `/learning/me/profile`, `/learning/me/applications` | `API` disponible; fixtures solo para prototipos | Se persisten únicamente preferencias y solicitudes propias; la ruta debe estar publicada y la oferta/taller disponible |
| `ADMIN` | Radar futuro de cursos y oportunidades | Revisar, corregir y publicar una oportunidad | `ADMIN` — `/learning/courses`, `/learning/offers` y transiciones | `SYNTHETIC` en `/admin/radar`; `API` persistente disponible | El prototipo mantiene etiqueta sintética; la integración debe usar API, auditoría y transiciones backend |
| `ADMIN`, `STUDENT` | Talleres e inscripciones futuras | Publicar talleres, consultar oferta y solicitar participación | `ADMIN` para catálogo; `STUDENT` para solicitudes propias | `API` disponible; fixtures solo para pruebas visuales | La capacidad se controla en backend y una solicitud no expone ni modifica expedientes ajenos |

### Capacidades con permiso, pero sin recorrido de esta issue

`CATALOG_MANAGE` y `USER_MANAGE` existen en la política de `ADMIN`, pero no tienen una pantalla general descrita aquí. El dominio de formación sí cuenta con endpoints administrativos y `/learning/admin/audit`, aunque todavía no hay una vista general de administración/auditoría que cubra todas esas capacidades. Las próximas issues deben crear primero su criterio de aceptación y su contrato; no deben presentar un botón que sugiera una operación que el backend todavía no expone.

## Recorridos mínimos

### 1. Acceso, sesión y entrada por rol

**Inicio:** una persona abre el portal sin una sesión válida.

**Pasos:**

1. El frontend consulta `/auth/config` para conocer si el ambiente usa Google u otra autenticación local permitida.
2. En desarrollo o pruebas, la persona puede iniciar sesión con una cuenta demo local sintética. En los demás ambientes se inicia el flujo Google OIDC institucional.
3. El frontend consulta `/auth/me`; el backend devuelve identidad, rol, `student_id` cuando corresponde y permisos derivados del rol.
4. El portal muestra la navegación mínima: `/mi-perfil` para `STUDENT` y el resumen para `ADMIN` o `VALIDATOR`.

**Resultado esperado:** la pantalla no permite seleccionar un rol arbitrario. Un cambio de rol requiere cambiar la identidad autorizada en el backend.

**Estados de error:**

| Estado | Comportamiento requerido |
|---|---|
| Carga | Mostrar `Validando sesión…` y no renderizar acciones protegidas antes de conocer la identidad. |
| Configuración o API no disponible | Mostrar un error de sesión con opción de reintentar; no activar un modo fixture silencioso. |
| `401 UNAUTHENTICATED` | Volver al control de acceso o solicitar iniciar sesión nuevamente. |
| Cuenta no provisionada, inactiva o estudiante sin vínculo | Explicar que la cuenta debe ser habilitada/revisada por el administrador. |
| `403 FORBIDDEN` | Mostrar acceso restringido y devolver al espacio permitido para el rol. |

### 2. Recorrido del estudiante: registrar y corregir una certificación

**Inicio:** un usuario `STUDENT` con sesión activa entra a `/mi-perfil`.

**Pasos:**

1. El frontend carga únicamente `GET /certifications` para el estudiante de la sesión.
2. Si no hay registros, muestra el estado vacío y la acción `Nueva certificación`.
3. El estudiante registra emisor, credencial, fecha de emisión, vencimiento opcional, enlace y habilidades; puede adjuntar evidencia PDF, PNG, JPEG o una URL según el contrato vigente.
4. El frontend envía la certificación y la evidencia a los endpoints existentes. El nuevo registro queda en `PENDING`.
5. El estudiante consulta estado, comentario más reciente y evidencias desde el detalle de su certificación.
6. Si el backend devuelve `correction_allowed=true` y un estado corregible, el estudiante actualiza datos/evidencia y reenvía. Las decisiones anteriores se conservan en `certification_status_history` dentro del backend; el historial completo de transiciones está disponible para `VALIDATOR`. Una vista equivalente para `STUDENT` requiere un contrato propio con control de titularidad y queda fuera de VA-01.

**Resultado esperado:** la persona distingue `PENDING`, `UNDER_REVIEW`, `APPROVED`, `OBSERVED`, `RESUBMITTED`, `REJECTED` y `EXPIRED`; una observación explica la acción que debe realizar. Ninguna respuesta incluye certificaciones de otros estudiantes.

**Estados de error:**

| Estado | Comportamiento requerido |
|---|---|
| Carga | Mostrar que se están cargando las certificaciones propias. |
| Vacío | Explicar que todavía no hay registros y ofrecer la primera acción. |
| `422 VALIDATION_ERROR` | Marcar los campos o archivo que no cumplen el contrato, sin borrar lo ya escrito. |
| `409` por duplicado o transición inválida | Informar que el registro ya existe o que debe corregirse según el estado actual; recargar el detalle. |
| `401` o `403` | Detener la operación y renovar la sesión o mostrar acceso restringido. |
| `404` | Indicar que la certificación/evidencia ya no está disponible y volver a cargar la lista. |
| `503` | Permitir reintentar la consulta; no sustituir la respuesta por fixtures. |
| URL o archivo temporal vencido | Solicitar una nueva carga o renovar el acceso temporal sin exponer la evidencia públicamente. |

**Fuente:** API existente para todo el recorrido actual. Los contratos y fixtures de `dashboard-app/src/shared/contracts/` cubren pruebas y prototipos, pero no reemplazan la consulta de `/certifications`.

### 3. Recorrido del validador: revisar, decidir y dejar trazabilidad

**Inicio:** un usuario `VALIDATOR` con sesión activa entra a `/validaciones`.

**Pasos:**

1. El frontend carga `GET /validations` y presenta contadores de pendientes, en revisión, aprobadas y observadas.
2. El validador abre un envío, revisa estudiante seudonimizado, emisor, fechas, habilidades, enlace y evidencias.
3. Solicita acceso temporal a la evidencia mediante el endpoint autorizado; el token y el enlace no se guardan como datos públicos.
4. Toma la revisión (`START_REVIEW`) y pasa a `UNDER_REVIEW`.
5. Decide `APPROVE`, `OBSERVE` o `REJECT`. `OBSERVE` y `REJECT` requieren comentario para el estudiante.
6. Consulta el historial inmutable de transiciones desde el detalle.

**Resultado esperado:** solo una decisión válida para el estado actual se persiste. Las certificaciones aprobadas son las únicas que pueden alimentar los indicadores publicados; la observación permite corrección y reenvío del estudiante.

**Estados de error:**

| Estado | Comportamiento requerido |
|---|---|
| Carga | Mostrar la bandeja en estado de carga y bloquear decisiones duplicadas. |
| Vacío | Informar que no existen certificaciones para revisar, sin tratarlo como fallo. |
| Comentario faltante | Bloquear `OBSERVE`/`REJECT` y explicar el motivo requerido. |
| `409` por transición desactualizada | Recargar el registro y mostrar su estado actual antes de volver a decidir. |
| `401` o `403` | Cerrar la acción y explicar que se requiere sesión y permiso de validador. |
| `404` | Indicar que el envío o historial ya no está disponible y actualizar la bandeja. |
| Acceso temporal vencido | Permitir renovar la vista previa; nunca convertir el enlace en una URL permanente. |
| `503` | Mostrar reintento y mantener separada la operación que no pudo guardarse. |

**Fuente:** API existente (`/validations`, decisiones, evidencias temporales e historial). Los mocks de E2E solo simulan respuestas para probar navegación y estados, no son una fuente de producto.

### 4. Recorrido del administrador: interpretar, conciliar y publicar

**Inicio:** un usuario `ADMIN` con sesión activa entra al resumen institucional.

**Pasos:**

1. Consulta periodos y cortes disponibles; selecciona filtros de periodo, cohorte, ciclo, emisor y nivel.
2. Revisa KPIs, evolución, cobertura por habilidad, brechas y calidad de datos. Cada bloque conserva la fecha de corte y la fuente.
3. Si necesita actualizar el padrón, crea o selecciona el periodo, previsualiza el CSV, revisa aceptados/rechazados y ejecuta una importación atómica.
4. Consulta la historia ETL de un periodo y solicita una publicación con fecha de corte cuando la fuente está lista.
5. Vuelve al resumen para verificar que el corte publicado es el esperado. Una operación repetida no duplica el resultado.

**Resultado esperado:** el administrador distingue datos registrados de demostración, sabe qué fuente generó cada indicador y puede corregir una entrada rechazada antes de publicar. Las cifras agregadas no exponen identificadores nominales.

**Estados de error:**

| Estado | Comportamiento requerido |
|---|---|
| Carga | Mostrar el bloque que espera respuesta, sin presentar ceros como si fueran datos reales. |
| Sin periodos o sin corte | Explicar que no existe una publicación para la selección y sugerir revisar padrón/ETL. |
| `422` en CSV, filtros o fecha | Mostrar el campo o regla que se debe corregir y conservar el reporte de rechazo. |
| `409` o resultado idempotente | Informar que la fuente/corte ya fue procesado; no crear una segunda publicación. |
| `403` | Ocultar o bloquear las acciones de padrón/publicación cuando la identidad no tiene el permiso requerido. |
| `404 SNAPSHOT_NOT_FOUND` | Indicar que no hay snapshot para la combinación solicitada; no inventar una cifra. |
| `503` de analítica o dependencia | Mostrar error con reintento y preservar filtros. |
| Dataset de demostración | Mostrar etiqueta de datos sintéticos y limitarlo a desarrollo local; no mezclarlo con una decisión institucional. |

**Fuente:** API existente para padrón, ETL e indicadores. `dataset=demo` usa un servicio sintético local; no es un fixture de identidad ni una autorización alternativa.

## Mapa de API existente frente a fixtures

| Capacidad | API existente que se debe usar | Fixture permitido | Condición para una pantalla próxima |
|---|---|---|---|
| Sesión, rol y permisos | `/auth/config`, login OIDC/local, `/auth/me`, logout | Ninguno | Nunca simular identidad, rol o permisos desde un fixture. |
| Certificaciones del estudiante | `/certifications` y evidencias | `certificationFixtures()` para tests y adaptadores | Mostrar solo registros propios; respetar `correction_allowed` y el estado de la API. |
| Bandeja del validador | `/validations`, decisiones, evidencias y `history` | `validator()` para tests/prototipos | No usar fixture como fallback si la bandeja falla. |
| Indicadores y brechas | `/indicators/periods`, `/overview`, `/dictionary`, reportes | `dataset=demo` local o fixtures de contrato | Etiquetar fuente, periodo y corte; no conciliar demo con registrados. |
| Padrón y calidad ETL | `/padron/*` y `/etl/runs` | Ninguno en la operación actual | Usar CSV sintético en pruebas, nunca padrón real en el repositorio. |
| Intereses y ruta formativa | `/learning/interests`, `/learning/routes`, `/learning/me/profile` | `InterestProfile` y `LearningRoute` para prototipos | La pantalla debe indicar procedencia; las preferencias persistentes son propias del estudiante. |
| Cursos y oportunidades | `/learning/courses`, `/learning/offers` y transiciones | `CourseCandidate` y `Opportunity` usados por `/admin/radar` | El radar actual es sintético; la publicación real exige revisión y reglas de backend. |
| Talleres y participación | `/learning/workshops`, `/learning/me/applications`, `/learning/admin/applications` | `Workshop` y `Participation` para pruebas | Los cupos, estados y alcance se validan en API; no afirmar inscripción desde un fixture. |

La implementación de contratos de frontend y sus fixtures se documenta también en [API y contratos](15-API-y-contratos.md). Los adaptadores deben conservar la procedencia `API` o `SYNTHETIC`, estados `loading`, `ready`, `empty` y `error`, y la independencia entre objetos fixture.

## Contrato común de estados de pantalla

Toda pantalla incluida en las siguientes issues debe poder describir uno de estos estados sin alterar permisos ni inventar datos:

| Estado | Significado | Acción de la interfaz |
|---|---|---|
| `loading` | La fuente todavía no respondió | Indicador de carga; bloquear acciones que dependan de la respuesta. |
| `ready` | Hay datos válidos para mostrar | Renderizar datos y fuente; habilitar solo las acciones autorizadas. |
| `empty` | La consulta fue correcta, pero no hay registros | Mensaje contextual y siguiente acción; no mostrar error técnico. |
| `error` | La fuente no pudo completar la consulta | Mensaje comprensible, código/request id si existe y reintento cuando sea seguro. |
| `unauthenticated` | Falta o venció la sesión | Volver al acceso; no usar fixture para ocultar el `401`. |
| `forbidden` | La sesión existe, pero no tiene permiso | Mostrar acceso restringido; no habilitar la acción desde el cliente. |
| `conflict` | El recurso cambió o la transición es inválida | Recargar estado actual y pedir una decisión consciente. |
| `synthetic` | El contenido es demostrativo | Etiqueta visible, sin persistencia, sin enlaces de evidencia y sin valor institucional. |

## Criterios de aceptación de VA-01

- [x] Existe una matriz de rol, pantalla, acción, permiso y fuente.
- [x] Cada recorrido mínimo tiene inicio, pasos, resultado esperado y estados de error.
- [x] Se distingue la API vigente, el dataset sintético local y los fixtures de prototipo/prueba.
- [x] Se documenta que los fixtures no sustituyen autenticación, RBAC ni errores de la API.
- [x] Se deja explícitamente fuera de alcance la creación de nuevas tablas, migraciones, entidades, endpoints y permisos.
- [x] El documento queda enlazado en el índice y catálogo de documentación para que pueda ser usado por VA-02 y las siguientes issues.

## Handoff a las siguientes issues

1. **VA-02 (#68):** reutilizar la matriz de permisos y procedencia para contratos de frontend; no agregar un fallback silencioso.
2. **VA-03 y VA-04:** implementar la experiencia del estudiante sobre `/certifications`, conservando alcance propio, estados y comentarios.
3. **VA-05:** mejorar la bandeja con `/validations`, evidencia temporal, transiciones y comentario obligatorio.
4. **VA-06:** reorganizar el centro administrativo usando indicadores, calidad ETL y filtros existentes.
5. **VA-08, VA-09 y VA-10:** conservar fixtures explícitos donde aún haya prototipos visuales; para persistencia, usar los contratos `/learning` ya integrados y mantener la etiqueta sintética hasta conectar la pantalla.

Cada PR posterior debe referenciar su issue, declarar fuente de datos, cubrir estados de carga/vacío/error, comprobar RBAC y privacidad, y señalar qué queda fuera de alcance.
