# Informe de Especificación de Requerimientos

## Pulse EPIS Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS

**Integrantes:** Kiara Holly Zapana Murillo (2023077087) y Vincenzo Rafael Lllanos Niño (2023076796)<br>
**Versión:** 2.2<br>
**Fecha:** 11/09/2026

**Issue:** [#5 — Completar FD03: Especificación de Requisitos SRS](https://github.com/Kiara1616/pulse-epis/issues/5)

> Las definiciones de estudiante activo, certificación válida, certificación vigente, fecha de corte y fuentes operacionales están centralizadas en [Problema, población y línea base](00-Problema-y-linea-base.md). Este SRS las convierte en requisitos y reglas verificables.

> Los objetivos, fórmulas, metas y criterios de demostración se mantienen en [Objetivos e indicadores medibles](01-Objetivos-medibles.md).

## 1 Introducción

Este documento especifica las funciones, reglas, datos, estados, errores y atributos de calidad necesarios para transformar el prototipo Pulse EPIS en un sistema institucional completo. Los requisitos describen el estado objetivo; la columna **Estado en el repositorio** identifica qué existe hoy en el prototipo y evita confundir una pantalla demostrativa con una capacidad de producción.

## 2 Alcance funcional

El sistema objetivo administrará el padrón autorizado, recepción y validación de evidencias, normalización de credenciales, generación de indicadores y reportes. Habrá vistas privadas de administración y vistas agregadas de consulta.

El prototipo vigente contiene una aplicación Next.js con datos JSON demostrativos, navegación por páginas, `RoleProvider`/`RoleGate` del lado cliente, una bandeja local de validaciones, un formulario local de estudiante, un ETL Python de prueba y una API FastAPI base. No contiene todavía API de negocio, autenticación institucional, base de datos, almacenamiento privado, auditoría persistente, importación CSV real ni exportación PDF/CSV real. Esas diferencias se registran como `Pendiente` o `Parcial` en los requisitos.

## 3 Actores de negocio

Los actores de negocio describen quién participa o tiene interés en el proceso. No son, por sí mismos, roles técnicos de autorización.

| Actor de negocio | Objetivo | Operación principal |
|---|---|---|
| Administrador | Mantener la configuración del producto | Periodos, catálogos, políticas y usuarios autorizados |
| Responsable de datos | Mantener confiable el universo EPIS | Importar, conciliar y corregir el padrón |
| Validador | Asegurar que una credencial sea válida | Aprobar, observar o rechazar evidencias |
| Analista | Interpretar resultados | Consultar indicadores y generar reportes |
| Estudiante | Declarar sus logros | Registrar y revisar sus propias evidencias |
| Visitante | Conocer resultados generales | Consultar datos agregados autorizados |

Dirección EPIS y Comité de Calidad son interesados y consumidores de reportes. No se modelan como roles técnicos adicionales del MVP.

### 3.1 Roles técnicos y permisos

El MVP implementará únicamente estos tres roles técnicos de autorización:

| Rol técnico | Permisos base | Restricciones |
|---|---|---|
| `ADMIN` | Periodos, catálogos, configuración, padrón y auditoría según permisos | No valida evidencias ni publica datos nominales por defecto |
| `VALIDATOR` | Consulta de evidencia necesaria y decisión de validación | No administra usuarios, periodos, catálogos ni padrón |
| `STUDENT` | Registro y consulta de sus propias certificaciones | No consulta ni modifica datos de otros estudiantes |

El permiso `PADRON_MANAGE` se asignará a cuentas `ADMIN` que actúen como responsables de datos. El alcance `ANALYTICS_READ` permitirá a un analista consumir indicadores y reportes de solo lectura sin concederle administración ni validación; no se creará un cuarto rol técnico para el MVP. Un visitante solo utilizará vistas o endpoints públicos agregados.

| Actor de negocio | Autorización MVP | Regla verificable |
|---|---|---|
| Administrador | `ADMIN` | Solo opera capacidades asignadas |
| Responsable de datos | `ADMIN` + `PADRON_MANAGE` | Importa y concilia, pero no valida por defecto |
| Validador | `VALIDATOR` | Decide evidencias y no administra el sistema |
| Analista | `ANALYTICS_READ` | Solo lectura de indicadores y reportes permitidos |
| Estudiante | `STUDENT` | Solo sus propios datos |
| Visitante | Público agregado | Nunca recibe datos nominales |

La selección de rol no estará disponible en el frontend. El backend verificará cada permiso, aplicará denegación por defecto y registrará la identidad, rol técnico, alcance y acción en `AuditLog`.

## 4 Requerimientos funcionales

| ID | Requerimiento | Prioridad | Criterio verificable | Estado en el repositorio |
|---|---|---|---|---|
| RF-01 | Autenticar y aplicar roles y permisos | Crítica | Solo existen `ADMIN`, `VALIDATOR` y `STUDENT`; los alcances `PADRON_MANAGE` y `ANALYTICS_READ` se verifican en backend | Parcial: `RoleProvider`/`RoleGate` solo simulan el acceso en el cliente |
| RF-02 | Importar padrón por periodo desde CSV | Crítica | Una cuenta `ADMIN` con `PADRON_MANAGE` obtiene filas válidas, rechazadas y duplicadas | Parcial: la pantalla muestra un botón demostrativo, sin carga CSV |
| RF-03 | Crear clave interna por estudiante | Crítica | No expone código en analítica pública | Pendiente: no existe persistencia ni generación de `student_key` |
| RF-04 | Registrar credencial y evidencia | Crítica | Exige emisor, nombre, fechas y URL o archivo | Parcial: formulario local sin API ni almacenamiento de evidencias |
| RF-05 | Validar evidencia y decisión | Crítica | Solo `VALIDATOR` conserva autor, fecha, comentario y estado | Parcial: la bandeja cambia estados en memoria y no registra auditoría |
| RF-06 | Detectar duplicados | Alta | Marca coincidencia por alumno, credencial, emisor y fecha | Pendiente: no hay regla persistente de deduplicación |
| RF-07 | Normalizar proveedor, nivel y habilidades | Alta | Usa catálogos versionados | Parcial: ETL de prueba normaliza algunos proveedores y niveles |
| RF-08 | Calcular KPIs por fecha de corte | Crítica | Fórmula y población son visibles para `ANALYTICS_READ` y permisos superiores | Parcial: KPIs estáticos desde `mock-data.json`, sin fecha de corte real |
| RF-09 | Filtrar periodo, ciclo, cohorte, proveedor, nivel y área | Alta | Todos los gráficos autorizados responden al filtro | Parcial: selector de periodo y filtros visuales aislados; no hay consulta común |
| RF-10 | Mostrar evolución y participación | Alta | Compara periodos y muestra la fecha de corte | Parcial: gráficos sobre datos estáticos |
| RF-11 | Restringir detalle nominal | Crítica | Visitantes reciben agregados y ningún endpoint público devuelve PII | Parcial: `RoleGate` es del cliente y no existe endpoint público/backend |
| RF-12 | Exportar CSV y PDF | Alta | Refleja filtros, fecha de corte, fuentes y fórmula | Parcial: botones simulan exportación y solo muestran una alerta |
| RF-13 | Registrar auditoría | Crítica | Conserva principal, rol, alcance, acción y fecha | Pendiente: no existe bitácora persistente |
| RF-14 | Gestionar expiraciones | Alta | Distingue vigente, próxima y vencida con fecha de corte | Pendiente: no existe cálculo conectado a datos reales |
| RF-15 | Importar demanda laboral con fuente | Media | Conserva URL, consulta, ubicación y fecha | Parcial: el mock muestra demanda sin procedencia completa |
| RF-16 | Ejecutar ETL y mostrar estado | Alta | Registra inicio, fin, filas y errores por corrida | Parcial: ETL Python escribe JSON y logs, sin API ni panel de estado |
| RF-17 | Corregir y volver a revisar | Alta | Mantiene historial anterior y exige una nueva decisión | Parcial: la pantalla permite observar/validar en memoria, sin historial |
| RF-18 | Generar paquete de acreditación | Media | Incluye KPIs, metodología, calidad y referencias | Pendiente: no existe paquete institucional reproducible |

`Implementado` significa que existe un flujo persistente y verificable; `Parcial` significa que hay una demostración sin garantías de producción; `Pendiente` significa que aún no hay una implementación funcional en el repositorio.

En la demo, el selector del encabezado permite alternar entre roles y la ruta de validaciones acepta `ADMIN` y `VALIDATOR`. Esto sirve para recorrer las pantallas, pero no es autorización de producción: la restricción objetivo de `RF-01` y `RF-05` deberá imponerse en el backend y por permisos persistentes.

## 5 Requerimientos no funcionales

| ID | Requerimiento | Prioridad | Meta verificable | Estado en el repositorio |
|---|---|---|---|---|
| RNF-01 | Rendimiento | Alta | p95 menor a 2 segundos en consultas habituales con el volumen del piloto | Pendiente: no existe medición p95 de la API ni consultas de negocio |
| RNF-02 | Disponibilidad | Alta | 99.5 por ciento durante la ventana de reportes acordada | Pendiente: no existe ambiente operativo |
| RNF-03 | Seguridad | Crítica | TLS, SSO/OIDC, RBAC, validación servidor y secretos externos | Parcial: hay control visual de roles, sin autenticación ni backend |
| RNF-04 | Privacidad | Crítica | minimización, seudonimización, retención y cero PII en vistas públicas | Parcial: algunos datos están anonimizados en la demo, sin enforcement servidor |
| RNF-05 | Accesibilidad | Alta | WCAG 2.2 AA en flujos principales y revisión documentada | Parcial: HTML semántico básico, sin auditoría WCAG |
| RNF-06 | Mantenibilidad | Alta | lint, tipos, pruebas automatizadas y API documentada | Parcial: lint, TypeScript y build; faltan pruebas y API |
| RNF-07 | Recuperación | Alta | respaldo diario y restauración trimestral probada | Pendiente: no existe base de datos ni respaldo |
| RNF-08 | Observabilidad | Media | logs estructurados, métricas y alertas con responsable | Parcial: ETL emite logs locales; no hay monitoreo |
| RNF-09 | Portabilidad | Media | despliegue reproducible en contenedores | Pendiente: Docker forma parte de un issue posterior |
| RNF-10 | Calidad de datos | Crítica | completitud, unicidad, validez y consistencia medibles por corrida | Parcial: ETL de prueba calcula salida, sin contrato persistente |

## 6 Estados, errores y contratos

### 6.1 Estados de una certificación

Los estados siguientes son el contrato funcional objetivo. `Vigente`, `Próxima a vencer` y `Vencida` se derivan de una certificación validada, su fecha de expiración y la fecha de corte; no reemplazan la decisión del validador.

| Estado | Significado | Puede entrar en KPI oficial | Transición permitida |
|---|---|:---:|---|
| `BORRADOR` | El estudiante aún no envió el registro | No | `PENDIENTE` |
| `PENDIENTE` | Registro enviado y en cola de revisión | No | `VALIDADA`, `OBSERVADA` o `RECHAZADA` |
| `OBSERVADA` | Falta información o evidencia corregible | No | `PENDIENTE` después de una corrección |
| `VALIDADA` | El validador confirmó titularidad, emisor, fechas y evidencia | Sí, si no está duplicada y cumple el corte | `VENCIDA` solo como estado derivado |
| `RECHAZADA` | La evidencia no satisface las reglas o no se pudo verificar | No | Nuevo registro o corrección según política |
| `DUPLICADA` | Coincide con otra credencial y está pendiente de resolución | No | `VALIDADA` u `OBSERVADA` después de resolver |
| `VENCIDA` | Certificación validada cuya expiración es anterior al corte | No como vigente; sí en histórico | Estado derivado, no decisión manual |

Solo `VALIDATOR` puede registrar una decisión de aprobación, observación o rechazo. `ADMIN` puede administrar el flujo y consultar auditoría según permisos, pero no valida por defecto. Ninguna transición debe eliminar la decisión anterior: cada cambio conserva autor, fecha, comentario y estado previo.

### 6.2 Estados de una carga

| Estado de lote | Significado | Resultado ante error |
|---|---|---|
| `RECIBIDO` | Archivo o lote registrado con hash y metadatos | Se rechaza si no cumple tamaño o formato |
| `VALIDANDO` | Se revisan columnas, tipos, duplicados y reglas | Se registran errores por fila sin publicar datos |
| `APLICADO` | Todas las reglas bloqueantes fueron superadas | Se confirma el lote de forma idempotente |
| `RECHAZADO` | Existe un error bloqueante o el periodo está cerrado | No se aplica parcialmente; se devuelve el reporte de causas |

### 6.3 Errores y contrato de respuesta

La API objetivo utilizará códigos estables y un formato común. La interfaz actual no implementa aún este contrato; se documenta para evitar mensajes ambiguos cuando se incorpore el backend.

| Código de dominio | HTTP | Situación | Acción esperada |
|---|---:|---|---|
| `UNAUTHENTICATED` | 401 | No existe sesión válida | Solicitar inicio de sesión |
| `FORBIDDEN` | 403 | El rol o alcance no permite la operación | No revelar datos ni habilitar la acción |
| `VALIDATION_ERROR` | 422 | Campo requerido, tipo o formato inválido | Mostrar campos y causas corregibles |
| `EVIDENCE_UNSUPPORTED` | 422 | Archivo o URL no permitida | Solicitar formato o fuente admitida |
| `DUPLICATE_RECORD` | 409 | Credencial o lote ya registrado | Mostrar referencia sin duplicar |
| `PERIOD_CLOSED` | 409 | Se intenta modificar un cierre | Abrir un nuevo periodo o flujo de corrección |
| `NOT_FOUND` | 404 | Recurso inexistente o no visible para el usuario | No confirmar existencia de datos restringidos |
| `FILE_TOO_LARGE` | 413 | Evidencia supera el límite configurado | Solicitar archivo dentro del límite |
| `RATE_LIMITED` | 429 | Se superó el límite de solicitudes | Reintentar según `Retry-After` |
| `INTERNAL_ERROR` | 500 | Falla no controlada | Mostrar `requestId` y registrar el detalle interno |

El cuerpo de error tendrá la forma:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La fecha de emisión es obligatoria.",
    "details": [{"field": "issuedAt", "reason": "required"}],
    "requestId": "req-..."
  }
}
```

Los mensajes al usuario no incluirán códigos, correos, URLs privadas ni trazas internas. Las respuestas exitosas de listados deben incluir paginación, fecha de corte y filtros aplicados cuando correspondan.

## 7 Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Solo el padrón activo del periodo integra el denominador |
| RN-02 | Solo una certificación validada cuenta en KPIs oficiales |
| RN-03 | Una credencial vencida sigue en histórico, no como vigente |
| RN-04 | Código y correo son restringidos y no aparecen públicamente |
| RN-05 | Posibles duplicados se excluyen hasta resolverlos |
| RN-06 | La inferencia desde correo es auxiliar y no reemplaza el ciclo oficial |
| RN-07 | Toda métrica laboral conserva consulta, fuente, lugar y fecha |
| RN-08 | Catálogos versionados permiten reproducir cierres |
| RN-09 | El estudiante solo consulta sus datos y modifica registros abiertos |
| RN-10 | Eliminación y retención siguen la política institucional |
| RN-11 | No se realiza scraping de LinkedIn ni búsqueda de identidades desde perfiles públicos; las fuentes laborales son agregadas y trazables |

## 8 Modelo de datos mínimo

| Entidad | Campos principales |
|---|---|
| Student | id, student_key, código cifrado, correo cifrado y estado |
| Enrollment | estudiante, periodo, ciclo, cohorte y estado académico |
| Certification | estudiante, credential_id, emisor, nombre, nivel, emisión, expiración y estado |
| Evidence | certificación, tipo, URL, object_key, hash y fecha |
| Issuer | nombre canónico, alias y sitio oficial |
| Skill | nombre y categoría |
| Validation | certificación, validador, decisión, comentario y fecha |
| MarketDemand | habilidad, fuente, consulta, ubicación, periodo y conteo |
| AuditLog | principal, rol técnico, alcance, acción, entidad, antes, después y fecha |
| EtlRun | fuente, inicio, fin, estado, filas y errores |

## 9 Casos de uso

### CU-01 Importar padrón

El responsable de datos, mediante una cuenta `ADMIN` con permiso `PADRON_MANAGE`, selecciona periodo y archivo. El sistema valida columnas, normaliza códigos, muestra errores y confirma la importación. Cada alumno queda asociado a una clave interna y matrícula.

### CU-02 Registrar certificación

El estudiante inicia sesión, completa datos, adjunta PDF o URL y acepta el tratamiento. El sistema valida formato, busca duplicados y crea el registro pendiente.

### CU-03 Validar certificación

El validador compara evidencia con emisor, decide aprobar, observar o rechazar y deja trazabilidad. Una aprobación actualiza la analítica.

### CU-04 Consultar dashboard

El analista con alcance `ANALYTICS_READ` selecciona filtros. El sistema presenta KPIs y gráficos coherentes y habilita detalle solo si el permiso explícito lo autoriza.

### CU-05 Exportar reporte

El analista con alcance `ANALYTICS_READ` genera un reporte con fecha de corte, filtros, fórmulas, gráficos, calidad del dato y fuentes. El sistema oculta campos nominales salvo autorización adicional.

## 10 Historias de usuario

### HU-01 Cobertura real

Como consumidor autorizado del Comité de Calidad quiero conocer la proporción de estudiantes activos con certificación válida para sustentar un informe.

**Aceptación:** dado un periodo cerrado, al consultar cobertura se muestran numerador, denominador, fórmula y fecha reproducibles.

### HU-02 Evidencia estudiantil

Como estudiante quiero registrar una credencial para que sea evaluada.

**Aceptación:** si pertenezco al padrón y envío evidencia válida, recibo identificador y estado pendiente.

### HU-03 Privacidad

Como visitante quiero consultar resultados generales sin datos personales.

**Aceptación:** ninguna respuesta pública contiene nombre, código, correo o grupos con riesgo de reidentificación.

### HU-04 Calidad

Como responsable de datos con permiso `PADRON_MANAGE` quiero conocer errores de carga.

**Aceptación:** una importación informa totales, filas y causas sin aplicar parcialmente un lote inválido.

## 11 Trazabilidad

| Objetivo | Requisitos relacionados | Issue(s) de implementación | Prueba o artefacto |
|---|---|---|---|
| `OBJ-01` — Padrón conciliado | RF-02, RF-03, RF-16 | [#2](https://github.com/Kiara1616/pulse-epis/issues/2), [#12](https://github.com/Kiara1616/pulse-epis/issues/12), [#15](https://github.com/Kiara1616/pulse-epis/issues/15) | T-01, T-02, T-08: lote válido, clave interna y calidad |
| `OBJ-02` — Evidencia aprobada | RF-04, RF-05, RF-06, RF-14, RF-17 | [#2](https://github.com/Kiara1616/pulse-epis/issues/2), [#13](https://github.com/Kiara1616/pulse-epis/issues/13), [#14](https://github.com/Kiara1616/pulse-epis/issues/14) | T-03, T-04, T-07: registro, decisión, duplicidad y estado |
| `OBJ-03` — Cobertura real | RF-08, RF-09 | [#2](https://github.com/Kiara1616/pulse-epis/issues/2), [#16](https://github.com/Kiara1616/pulse-epis/issues/16), [#17](https://github.com/Kiara1616/pulse-epis/issues/17) | T-05, T-06: fórmula, denominador y filtros |
| `OBJ-04` — Vigencia y estados | RF-05, RF-06, RF-14 | [#2](https://github.com/Kiara1616/pulse-epis/issues/2), [#14](https://github.com/Kiara1616/pulse-epis/issues/14), [#16](https://github.com/Kiara1616/pulse-epis/issues/16) | T-07: transiciones y cálculo al corte |
| `OBJ-05` — Calidad de datos | RF-06, RF-07, RF-16 | [#2](https://github.com/Kiara1616/pulse-epis/issues/2), [#15](https://github.com/Kiara1616/pulse-epis/issues/15) | T-08: idempotencia, completitud, unicidad y errores |
| `OBJ-06` — Evolución comparable | RF-09, RF-10 | [#2](https://github.com/Kiara1616/pulse-epis/issues/2), [#16](https://github.com/Kiara1616/pulse-epis/issues/16), [#17](https://github.com/Kiara1616/pulse-epis/issues/17) | T-09: series por periodo y fecha de corte |
| `OBJ-07` — Brechas documentadas | RF-15 | [#2](https://github.com/Kiara1616/pulse-epis/issues/2), [#16](https://github.com/Kiara1616/pulse-epis/issues/16) | T-10: fuente, ubicación, fecha y normalización |
| Objetivo de solución BI — acceso trazable | RF-01, RF-11, RF-12, RF-13, RNF-03, RNF-04 | [#4](https://github.com/Kiara1616/pulse-epis/issues/4), [#5](https://github.com/Kiara1616/pulse-epis/issues/5), [#11](https://github.com/Kiara1616/pulse-epis/issues/11), [#17](https://github.com/Kiara1616/pulse-epis/issues/17) | T-11, T-12: matriz RBAC, privacidad y exportación |

La matriz relaciona los objetivos medibles con el requisito que los habilita, el issue que implementará la capacidad y la prueba que debe cerrarla. Mientras no exista el backend, las pruebas marcadas como pendientes son criterios de aceptación y no resultados ya obtenidos.

## 12 Plan de pruebas

| ID | Tipo | Alcance | Resultado esperado | Estado |
|---|---|---|---|---|
| T-00 | Automatizada | Lint, TypeScript y build del frontend | Cero errores de lint y compilación exitosa | Disponible: `npm run lint`, `npm run build` |
| T-01 | Integración | Importación de lote válido, inválido y duplicado | Totales, causas y estado de lote reproducibles | Pendiente — #12 |
| T-02 | Unitarias | Generación y no exposición de `student_key` | Clave estable, sin código/correo en analítica pública | Pendiente — #12 |
| T-03 | Integración | Registro de certificación y evidencia | Campos obligatorios, formato y estado `PENDIENTE` | Pendiente — #13 |
| T-04 | Integración | Decisiones del validador | Solo `VALIDATOR` decide; se conserva historial y auditoría | Pendiente — #14 |
| T-05 | Unitarias | Fórmulas de cobertura, vigencia y duplicados | Numerador, denominador y corte coinciden con el diccionario | Pendiente — #16 |
| T-06 | Integración | Filtros combinados | Proveedor, nivel y área no alteran indebidamente el denominador | Pendiente — #16/#17 |
| T-07 | Unitarias | Máquina de estados | Solo transiciones permitidas; estados fuera de regla quedan excluidos | Pendiente — #14 |
| T-08 | Integración | ETL repetido y datos erróneos | Corrida idempotente, calidad medida y errores aislados | Pendiente — #15 |
| T-09 | Integración | Evolución entre periodos | Serie reproducible con corte, filtros y periodo anterior | Pendiente — #16 |
| T-10 | Contrato | Demanda laboral | Cada punto conserva fuente, consulta, ubicación y fecha | Pendiente — #16 |
| T-11 | Seguridad | Autorización horizontal y vertical | `STUDENT`, `VALIDATOR`, `ADMIN`, `ANALYTICS_READ` y visitante respetan límites | Pendiente — #11/#17 |
| T-12 | Seguridad y privacidad | Exportaciones y vistas públicas | No aparece PII; exportación conserva filtros y solicitud autorizada | Pendiente — #11/#17 |

## 13 Criterio de terminación

La versión productiva debe superar pruebas unitarias, integración, end to end, autorización horizontal y vertical, seguridad, accesibilidad, carga, respaldo y restauración. Las pruebas de autorización deben demostrar que `STUDENT` solo ve sus datos, `VALIDATOR` no administra, `ADMIN` respeta sus permisos, `ANALYTICS_READ` no modifica datos y el visitante solo recibe agregados. Una muestra será conciliada manualmente con padrón y evidencias por EPIS.
