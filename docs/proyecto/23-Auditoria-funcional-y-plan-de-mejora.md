# Auditoría funcional y plan de mejora de Pulse EPIS

**Alcance:** revisión de frontend, contratos, servicios, modelo, seguridad operativa y documentación de los tres perfiles; suite de backend, lint, TypeScript, build, suites de navegador con API simulada y flujo integral con API real y base temporal. Se reprodujeron casos de duplicado y evidencia con API temporal. No se usaron ni verificaron expedientes institucionales reales. Una suite verde en datos sintéticos no equivale a aceptación institucional.

## Evidencia de verificación — 18 de octubre de 2026

| Verificación | Resultado | Interpretación |
|---|---|---|
| Backend `pytest backend/tests -q` | 83 pasaron, 1 omitida al aislar las opciones locales de `.env.local` | La omisión requiere PostgreSQL de prueba. La primera ejecución tuvo cuatro fallos por configuración local heredada y uno porque este documento aún no figuraba en `docs/catalogo.json`; se corrigió su registro y se repitió la suite con las opciones de demostración desactivadas solo para ese proceso. |
| Frontend `npm run lint`, `npm run build`, `npx tsc --noEmit` tras build | Correctos | Un TypeScript aislado anterior al build encontró una ruta antigua en `.next/types`; el build regeneró los tipos y el segundo TypeScript pasó. |
| Playwright con API simulada | 40 pasaron, 18 fallaron | Parte de los fallos exige títulos o módulos retirados del diseño actual. También se confirmó desbordamiento horizontal a 390 px en estudiante y talleres; se requiere clasificar y actualizar cada caso fallido antes de volver a usar la suite como puerta de calidad. |
| Playwright integral con API real y base temporal | 1 flujo integral pasó | Cubrió estudiante, validador y administrador: evidencia, aprobación, preferencias, oportunidad, taller y solicitud. No cubre todos los errores ni los dispositivos. |
| API temporal: duplicados y evidencia | 201 para variante semántica, 409 para duplicado exacto; 201 sin evidencia, caso visible en bandeja, 422 al aprobarlo | Reproduce H1 y H2 sin tocar el entorno persistente. |
| Dependencias | `npm run audit:security` aprobó con una excepción temporal de desarrollo para `braces@3.0.3` hasta 2026-11-05; `pip-audit` no encontró vulnerabilidades conocidas en `backend/requirements.txt` | No sustituye una revisión de seguridad de la aplicación ni de la infraestructura. |

## Diagnóstico principal

Pulse EPIS conserva historial de estados de certificaciones, decisiones de validación, auditoría y corridas ETL. La brecha principal es de **identidad semántica y trazabilidad visible**: un texto libre de credencial o habilidad puede convertirse en una categoría distinta, y las pantallas no conectan de forma verificable la evidencia, la decisión, la publicación y el indicador. Los datos de demostración están etiquetados, pero conviven en algunos recorridos con información operativa.

## Hallazgos priorizados

| ID | Prioridad | Perfil | Hallazgo comprobado y consecuencia |
|---|---|---|---|
| H1 | Alta | Estudiante, validador, administrador | El formulario permite escribir libremente credencial, emisor y habilidades (`dashboard-app/src/app/mi-perfil/page.tsx`, líneas 397–455). El servicio crea emisores y habilidades por nombre y detecta duplicados de credencial solo por estudiante, emisor, nombre y fecha, o por identificador externo (`backend/app/certifications/service.py`, líneas 392–435 y 496–525). Variantes como siglas, tildes, idioma y errores ortográficos pueden crear categorías y registros separados. `by_credential` agrupa por el texto original (`backend/app/analytics/service.py`, línea 202). |
| H2 | Alta | Estudiante | La interfaz crea la certificación primero y adjunta evidencia después (`mi-perfil/page.tsx`, líneas 133–181). Archivo y URL son opcionales (`validation.ts`). Puede quedar un registro `PENDING` sin evidencia aunque el botón diga «Enviar a validación». La aprobación exige al menos una evidencia vigente (`backend/app/validation/service.py`, líneas 348–351). |
| H3 | Alta | Estudiante | Después de fallar el adjunto se conserva `createdId`; abrir «Nueva certificación» no lo reinicia (`mi-perfil/page.tsx`, líneas 79, 133, 149 y 290–293). Si el estudiante cambia el formulario, el siguiente envío puede intentar adjuntar evidencia al registro anterior en vez de crear uno nuevo. Los `409` al adjuntar se ignoran sin distinguir la causa (`mi-perfil/page.tsx`, líneas 153–181). |
| H4 | Alta | Validador | `START_REVIEW` cambia el estado, pero no asigna el expediente a un validador; cualquier validador autorizado puede decidir desde `UNDER_REVIEW` (`backend/app/validation/service.py`, líneas 306–388). La aprobación comprueba que existe evidencia vigente, no que se abrió, se cotejó con el emisor o se registró el criterio usado. Hay auditoría de acceso y decisión, pero falta constancia estructurada de la comprobación. |
| H5 | Media | Estudiante | «Tus preferencias de formación» guarda intereses y ruta (`mi-ruta/page.tsx`, líneas 103–115; `backend/app/api/routes/learning.py`, líneas 277–301). No se utiliza para clasificar las certificaciones ni genera recomendaciones personalizadas: la misma página aclara que las oportunidades son un catálogo general (líneas 145–150). La finalidad de la preferencia debe explicitarse y medirse. |
| H6 | Media | Estudiante, validador | El backend admite `external_id` e `issuer_url`, y el validador los muestra, pero el formulario del estudiante no los solicita (`backend/app/certifications/schemas.py`, líneas 56–70; `mi-perfil/page.tsx`, líneas 397–455). Se omiten dos datos útiles para desambiguar y verificar credenciales. Las habilidades se capturan como lista separada por comas y el nivel se fija en `Other` (`mi-perfil/page.tsx`, líneas 77–78 y 140–147). |
| H7 | Media | Estudiante, validador | En desarrollo se muestra un historial sintético junto al historial operativo del estudiante (`mi-perfil/page.tsx`, línea 340; `ReferenceStudentProfile.tsx`, líneas 36–61) y registros sintéticos junto a la bandeja real (`validaciones/page.tsx`, línea 323). Las etiquetas existen, pero el recorrido mezcla dos procedencias y puede parecer que un caso de ejemplo es un expediente validado. |
| H8 | Media | Administrador | La API de ETL conserva `source_sha256`, `quality_report`, duplicados y rechazos (`backend/app/etl/service.py`, líneas 369–425 y 465–491). La pantalla de publicaciones muestra principalmente fecha, estado y conteos (`admin/publicaciones/page.tsx`, líneas 9 y 43–44); calidad resume totales (`DataQuality.tsx`). No hay recorrido de auditoría en UI desde un KPI hasta la corrida, reglas de calidad y fuente correspondientes. |
| H9 | Media | Validador | El historial API incluye `actor_user_id` y `cutoff_date` (`backend/app/validation/schemas.py`, `ValidationHistoryResponse`), pero la vista solo presenta transición, fecha y comentario (`ValidationHistory.tsx`). El validador no puede identificar allí quién tomó cada decisión ni la fecha de datos usada. |
| H10 | Media | Administrador, estudiante | El «Radar de cursos» registra fuentes manualmente (`admin/radar/page.tsx`, línea 193); la publicación sí se audita. La denominación «radar» puede sugerir descubrimiento automático. Las ofertas llevan intereses y ciclos, pero la vista del estudiante presenta el catálogo general sin usar sus preferencias como filtro o explicación de afinidad (`mi-ruta/page.tsx`, líneas 321–367). |
| H11 | Media | Administrador, validador | Si falla `/indicators/config`, el hook de analítica elige `demo` en autenticación local (`useAnalytics.ts`, líneas 64–69). Aunque los datos aparecen etiquetados, este cambio automático de procedencia contradice la regla documental de no sustituir errores de API por demostraciones (`22-Recorridos-y-criterios-por-rol.md`). Debe mostrarse error y dejar la elección de fuente al usuario. |
| H12 | Operativa | Todos | La documentación indica que aún faltan purga de evidencias vencidas y una copia conjunta, cifrada y ensayada de base de datos y archivos (`07-Certificaciones-evidencias.md`, línea 35; `16-Despliegue-y-recuperacion.md`, línea 29). Es requisito previo a expedientes institucionales reales, aunque no sea un fallo visible en una pantalla. |
| H13 | Alta | Administrador, estudiante | El administrador no tiene pantalla para crear intereses ni rutas de formación; el flujo integral tuvo que crearlos por API antes de que el estudiante pudiera elegirlos (`dashboard-app/e2e-real/complete-flow.spec.ts`, líneas 18–29). Sin preparación técnica externa, «Mi ruta» puede permanecer vacía aunque la API funcione. |
| H14 | Alta | Todos | La barra lateral expandida conserva 240–256 px aun con viewport de 390 px (`AppShell.tsx` y `Sidebar.tsx`). Playwright reprodujo desplazamiento horizontal en el espacio del estudiante y talleres. El diseño móvil requiere una navegación tipo cajón o colapso automático, con contenido que aproveche el ancho restante. |
| H15 | Media | Todos | La suite de interfaz conserva expectativas de pantallas anteriores (`e2e/admin-priorities.spec.ts` exige indicadores dentro de `/admin`, hoy centro de enlaces; `e2e/course-radar.spec.ts` exige «Revisión de contenido», hoy «Datos del curso»). Los 18 fallos no son 18 defectos de producto, pero una suite roja impide detectar regresiones con confianza. |
| H16 | Media | Desarrollo | La suite de backend leyó opciones de `.env.local` y alteró resultados de pruebas de configuración, demo y piloto. Hace falta aislar explícitamente la configuración de pruebas del archivo de desarrollo para que `pytest` produzca el mismo resultado en cada máquina. |
| H17 | Media | Estudiante | Al reenviar una corrección, el estado cambia a «Reenviada», pero desaparece el aviso de éxito. `CertificationDetails.tsx` establece el mensaje y luego llama a `onSaved`; `loadCertifications` pone `loading=true` y desmonta temporalmente el detalle (`mi-perfil/page.tsx`, líneas 85–108). El recorrido Playwright reprodujo que la operación se ejecuta y la confirmación no queda visible. Mantener el detalle montado durante la actualización o mostrar el aviso en un nivel persistente de la página. |

## Qué sí tiene trazabilidad

- Los cambios de estado generan historial inmutable con actor, fecha y comentario; el servicio bloquea transiciones inválidas y usa bloqueo de fila para decisiones concurrentes (`backend/app/validation/service.py`).
- Las evidencias privadas tienen hash, retención y acceso temporal; las emisiones de acceso se auditan (`backend/app/certifications/service.py`).
- Las importaciones y publicaciones se registran; ETL guarda hash de la extracción, controles de calidad y rechazos (`backend/app/etl/service.py`).
- El backend aplica permisos y alcance por rol; ocultar enlaces en el frontend no es el control de acceso.

## Decisión de producto: nombres de certificados y preferencias

**Recomendación:** no elegir las preferencias de formación al subir una certificación. Intereses aspiracionales y logros comprobados son conceptos distintos. El estudiante debe seleccionar emisor y credencial de un **catálogo canónico** con búsqueda, alias y autocompletado. Si no encuentra la credencial, debe poder proponer un nombre libre como **candidato pendiente de normalización**, sin crear inmediatamente una categoría oficial. Debe conservarse el texto original y quién aprobó la equivalencia. El identificador externo y la URL de verificación deben solicitarse cuando el emisor los proporcione; evidencia privada debe ser obligatoria para enviar a revisión. Las habilidades acreditadas deberían provenir de la credencial canónica o confirmarse por el validador, no quedar definidas exclusivamente por el estudiante.

La deduplicación debe preferir `(emisor canónico, identificador externo)` cuando exista. En ausencia de identificador, usar `(estudiante, credencial canónica, fecha de emisión)` más una alerta de coincidencia probable para revisión humana. Una renovación con fecha o identificador distintos debe poder coexistir. Evitar bloqueo difuso automático: nombres parecidos no siempre son la misma credencial.

## Plan de implementación y criterios de cierre

### Etapa 1 — Integridad del envío y de la revisión

1. Separar `BORRADOR` de `ENVIADO` o crear una operación transaccional/idempotente que exija evidencia antes de colocar el expediente en bandeja. Evitar el `createdId` persistente al comenzar otro registro; distinguir «reintentar adjunto» de «crear nueva certificación».
2. Presentar errores de duplicación de certificación y evidencia con códigos específicos; no ignorar cualquier `409`.
3. Definir una asignación de revisión o, al menos, mostrar quién tomó el caso y aplicar propiedad de la decisión. Registrar criterio estructurado de verificación: evidencia examinada, resultado de cotejo y fuente usada.
4. Corregir la navegación de 390 px y tamaños menores para los tres roles; el menú debe ser un cajón móvil que no reste ancho permanente al contenido.

**Cierre:** no aparece en la bandeja un envío incompleto; reintentar no crea ni altera otro registro; cada aprobación permite reconstruir actor, evidencia y criterio; ninguna página crea desplazamiento horizontal en 390 px.

### Etapa 2 — Catálogo canónico y calidad semántica

1. Modelar emisores, credenciales, alias y habilidades canónicas con estado de aprobación y auditoría de fusiones.
2. Añadir búsqueda/autocompletado al formulario y flujo «no encuentro mi certificación» para candidatos. Capturar identificador externo, enlace de verificación y texto original.
3. Migrar datos existentes mediante propuestas de equivalencia y revisión humana. Mantener IDs originales y registrar todas las decisiones de fusión. Hacer que el ETL agrupe por ID canónico y exponga «sin clasificar».

**Cierre:** dos variantes conocidas se agrupan en una credencial, una renovación sigue siendo independiente y no cambian históricos publicados sin una nueva versión/corrida documentada.

### Etapa 3 — Trazabilidad de extremo a extremo por rol

1. Estudiante: cronología de envío, evidencia, observación, corrección y resolución, con fecha y siguiente acción.
2. Validador: actor de cada transición, fecha aplicada, evidencia revisada y guía de decisión visible.
3. Administrador: en publicaciones y calidad, mostrar corrida, hash abreviado, reglas, rechazos y enlace desde cada indicador al corte que lo generó; mantener datos nominales fuera de los agregados.
4. Separar navegación de demostración y operación; si falla configuración o API, mostrar error sin cambiar de fuente automáticamente.
5. Aislar las variables de prueba y actualizar los recorridos Playwright para el diseño vigente. Mantener el flujo real por rol y añadir casos de duplicado, evidencia faltante y conflicto de revisión.
6. Conservar la confirmación de correcciones después de recargar el expediente y asegurar que el historial refleje la transición.

**Cierre:** para un KPI publicado, el administrador puede identificar periodo, fecha, corrida y regla; para una certificación, estudiante y validador pueden seguir las transiciones autorizadas sin confundirlas con datos de ejemplo.

### Etapa 4 — Valor de preferencias y operación institucional

1. Definir si «Mi ruta» es un organizador personal o un motor de recomendaciones. Si se mantiene como organizador, explicarlo y ofrecer filtros por intereses. Si se introducen recomendaciones, documentar fórmula, fuente, fecha y explicación visible; no inferir habilidades solo por preferencias.
2. Crear la administración de intereses y rutas, con borrador, publicación, responsable y auditoría; el estudiante no debería depender de llamadas manuales a la API para encontrar opciones.
3. Renombrar o explicar «Radar de cursos» como registro y revisión manual hasta contar con descubrimiento automatizado verificable.
4. Diseñar purga, copia consistente de base y evidencias, restauración y responsables antes de cargar datos institucionales reales. Cerrar la excepción temporal de dependencia antes de su vencimiento.

**Cierre:** las preferencias tienen un efecto visible y comprobable, la procedencia de cursos se entiende y existe un procedimiento ensayado de recuperación de expedientes.

## Límites de esta auditoría

Se revisó código, contratos y recorridos con datos sintéticos y una base temporal. No se ejecutó la prueba de concurrencia que requiere PostgreSQL de prueba, ni se verificaron disponibilidad, rendimiento y respaldo en un entorno institucional. Tampoco se auditó una muestra de certificados reales con sus emisores ni se realizó una evaluación exhaustiva de accesibilidad. Esas verificaciones son necesarias antes de afirmar preparación para uso institucional.

## Decisiones institucionales pendientes

1. ¿Quién es dueño del catálogo canónico y aprueba alias, emisores y habilidades?
2. ¿Qué prueba basta para validar una credencial según el emisor: URL verificable, identificador, archivo o combinación?
3. ¿Puede aprobarse una credencial no incluida en el catálogo o requiere clasificación previa?
4. ¿El propósito de «Mi ruta» es planificación personal, recomendación individual o ambas?
5. ¿Quién autoriza el uso de datos registrados y quién responde por retención, purga y recuperación de evidencias?

Estas respuestas deben incorporarse a los criterios de aceptación antes de implementar la etapa 2 o usar datos reales.
