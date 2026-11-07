# Catálogo de certificaciones y descubrimiento de cursos

## Responsabilidades

- Administración mantiene entidades emisoras, alias, nombres de certificaciones y habilidades. Una propuesta del estudiante queda pendiente y asociada a su borrador hasta que administración la vincule a una opción existente o cree la opción y la vincule. El rechazo conserva el motivo. Las acciones del catálogo y la decisión dejan registro de actor y fecha en `audit_logs`.
- El estudiante selecciona entidad, certificación y habilidades del catálogo. Si falta una opción, guarda su propuesta y evidencia como borrador. No puede enviar ese borrador al validador mientras la propuesta esté pendiente o rechazada. Las preferencias de «Mi ruta» representan intereses formativos; no equivalen a habilidades acreditadas.
- El validador compara entidad, nombre y habilidades con la evidencia y confirma esa comprobación al aprobar. Puede observar el registro, pero no crear opciones canónicas. Solo las aprobaciones vinculadas al catálogo deben usarse al publicar indicadores.

## Cursos y talleres

En «Radar de cursos», administración registra una URL HTTPS pública cuya consulta haya sido autorizada, indica si es RSS/Atom o una página de enlaces y puede explorarla. La consulta respeta `robots.txt`, mantiene los hallazgos en `DETECTED` y deduplica por URL. Administración verifica título, proveedor, enlace, requisitos, habilidades y pertinencia antes de publicar una oportunidad. Un proveedor de curso no se convierte automáticamente en entidad emisora de certificaciones.

Las oportunidades externas publicadas aparecen en **Mi ruta**, con un enlace al sitio del proveedor para consultar la inscripción. Pulse EPIS no registra esa inscripción. Los talleres internos creados a partir de una oportunidad publicada aparecen en **Talleres** solo cuando están abiertos; allí se envían solicitudes y administración decide los cupos.

La exploración puede invocarse desde Radar o ejecutarse periódicamente con `python -m backend.scan_learning_sources` desde un programador local que tenga acceso a `PULSE_DATABASE_URL`. La tarea programada solo crea hallazgos pendientes: no publica cursos ni talleres.

## Plataformas objetivo y política de integración

El radar debe admitir fuentes de Cisco Networking Academy o Skills for All, Microsoft Learn, AWS Skill Builder, Google Cloud Skills Boost, Oracle, IBM, Red Hat, Fortinet, Palo Alto Networks y otras plataformas útiles para EPIS. La inclusión en esta lista expresa interés académico, no autorización automática para extraer contenido.

Se aplica este orden de preferencia por fuente:

1. API oficial o convenio institucional.
2. RSS, Atom, sitemap, exportación o catálogo estructurado expresamente permitido.
3. Página HTML pública cuya automatización sea compatible con sus términos y `robots.txt`.
4. Registro manual curado por administración cuando no exista un mecanismo autorizado.

DataCamp se mantiene en el cuarto caso mientras sus condiciones públicas prohíban agentes automatizados, consultas automáticas y scraping, salvo que Pulse EPIS obtenga autorización escrita, API o feed oficial. El sistema nunca debe evadir autenticación, CAPTCHA, paywall, límites de frecuencia ni controles técnicos.

Cada fuente guarda nombre, dominio, método, fecha de revisión de términos, evidencia o referencia del permiso, frecuencia, responsable, última ejecución, último error y estado. Una revisión vencida, cambio de términos, respuesta `403` o `429`, bloqueo de `robots.txt` o fallos repetidos desactiva la ejecución y requiere revisión humana.

## Datos capturados y flujo administrativo

Un hallazgo puede representar curso, ruta, preparación para certificación, certificación o taller. Debe intentar capturar únicamente información pública necesaria: título, proveedor, URL canónica, tipo, descripción breve, modalidad, idioma, nivel, duración, costo visible, habilidades, certificación relacionada, requisitos, fecha, vigencia y fechas de primera y última observación. No se extraen perfiles, cuentas, progreso ni información personal de usuarios del proveedor.

El recolector normaliza y deduplica; no decide la oferta académica. Todo hallazgo permanece en `DETECTED` o `IN_REVIEW` hasta que administración:

1. compruebe vigencia, relación con las competencias EPIS y exactitud de la certificación asociada;
2. revise costo, idioma, requisitos y condiciones de inscripción;
3. descarte, archive, publique como oportunidad externa o lo use como insumo para diseñar un taller interno;
4. registre la decisión, actor y fecha.

La oportunidad publicada enlaza a la fuente original y muestra la fecha de última verificación. Pulse EPIS no copia materiales didácticos ni garantiza cupos o certificación. Un taller interno es una oferta distinta y debe indicar docente, horario, capacidad y criterios propios.

## Requisitos técnicos pendientes del radar

El recolector actual ya exige HTTPS público, bloquea destinos privados, limita redirecciones y tamaño, usa timeout, revisa `robots.txt`, deduplica por URL y conserva huellas y fechas de observación. Para liberar la beta todavía se requiere:

- adaptadores por fuente para API, RSS, Atom, sitemap y HTML permitido;
- metadatos de método, permiso, frecuencia y responsable en la fuente;
- clasificación de tipo y extracción estructurada de modalidad, costo, duración, idioma, habilidades y certificación relacionada;
- canonicalización de URL, deduplicación semántica controlada y detección de enlaces vencidos;
- límites por dominio, espera exponencial, tratamiento explícito de `403` y `429`, y desactivación tras fallos repetidos;
- historial de ejecuciones con cantidades detectadas, actualizadas, omitidas y rechazadas;
- pruebas con respuestas simuladas; las pruebas automatizadas no deben depender de consultar proveedores reales;
- pruebas E2E de revisión, descarte, publicación y creación de taller por administración.

## Base local anterior

La migración `0011_learning_convergence` conserva `learning_opportunities` e importa sus filas como cursos `DETECTED` para revisión. Antes de migrar una base existente, detener la API y hacer una copia verificable. Ejecutar `python -m alembic -c backend/alembic.ini upgrade head`, verificar la revisión y reiniciar la API. La importación no publica automáticamente los datos antiguos.
