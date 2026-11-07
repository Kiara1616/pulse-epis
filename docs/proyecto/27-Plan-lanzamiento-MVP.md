# Plan de lanzamiento del MVP de Pulse EPIS

**Fecha de corte:** 7 de noviembre de 2026  
**Objetivo:** llevar el estado local posterior a `main` a un MVP estable, trazable y aceptado para un piloto controlado con datos sintéticos o expresamente autorizados.  
**Decisión actual:** **NO-GO**. El producto tiene una base funcional sólida, pero las puertas de seguridad, navegador, despliegue y aceptación todavía no están cerradas.

## 1. Estado actualizado del proyecto

### Evidencia ejecutada sobre el árbol de trabajo actual

| Frente | Resultado al corte | Estado |
|---|---|---|
| Backend | `88 passed, 1 skipped` en 82,79 s | Amarillo: la suite principal pasa; falta ejecutar la prueba omitida y migraciones sobre PostgreSQL de integración. |
| Frontend estático | ESLint, TypeScript y `next build` correctos; 16 páginas generadas | Verde |
| Navegador con API simulada | `26 passed, 32 failed` de 58; varios fallos son contratos de prueba desactualizados y otros son esperas o proxy no interceptado | Rojo |
| Navegador con API real | `1 passed`: catálogo, evidencia, validación, perfil, oportunidad, taller y participación | Verde |
| Seguridad de dependencias | Next.js actualizado a 16.4.5 y Zod corregido; `npm run audit:security` informa 0 vulnerabilidades altas o críticas | Verde |
| Aceptación | `pilot/acceptance.json` sigue en `pending_public_deployment`; sin URL, OIDC, restauración, rollback, CI documental ni acta verificados | Rojo |
| Repositorio | `main` está en `9d1552d`; hay 75 archivos modificados, 1 751 inserciones, 931 eliminaciones y archivos nuevos sin commit | Amarillo: el avance reciente todavía no es una unidad revisable ni desplegable. |

### Avance funcional incorporado después de `main`

- Catálogo canónico de entidades, certificaciones y habilidades, con alias, propuestas y borradores.
- Registro estudiantil conectado al catálogo y flujo para proponer elementos inexistentes.
- Confirmación del catálogo durante la validación y bloqueo de aprobación para registros antiguos no vinculados.
- Administración del catálogo y migraciones `0010` a `0013` para formación, convergencia, catálogo y descubrimiento.
- Descubrimiento de oportunidades y fuentes, ETL programado y ampliación del dominio de formación.
- Rediseño de navegación, componentes comunes, gráficos, filtros, exportación y estados de pantalla.
- Documentación de auditoría, catálogo, segunda unidad BI y arquitectura de Data Warehouse.

### Brechas que todavía impiden el lanzamiento

1. Dependencias vulnerables sin resolución aceptada.
2. Suite E2E roja y contratos de navegador no alineados al catálogo nuevo.
3. Cambios locales grandes sin dividir, revisar ni integrar mediante PR.
4. Migraciones nuevas sin evidencia completa de `upgrade`, datos existentes, `downgrade` o estrategia de rollback.
5. Recorrido integral con API real no repetido sobre el estado actual.
6. Google OIDC, aprovisionamiento de roles y despliegue público no aceptados.
7. Respaldo conjunto de PostgreSQL y evidencias, restauración y rollback no ensayados.
8. La demostración gratuita de Render no es almacenamiento durable y no debe recibir expedientes reales.
9. Manuales, contratos y acta de aceptación aún no reflejan completamente el catálogo y descubrimiento nuevos.

### Avance de ejecución — 7 de noviembre de 2026

- Se actualizaron `next` y `eslint-config-next` de 16.3.8 a 16.4.5 y se fijó Zod en una versión corregida. Auditoría, lint, TypeScript y build pasan.
- Se actualizó el recorrido Playwright con API real para crear y utilizar el catálogo canónico. El recorrido completo pasa en 17 s de prueba y 34,6 s de ejecución total.
- La suite backend se repitió después de los cambios: `88 passed, 1 skipped` en 72,21 s.
- `python scripts/validate_release.py` confirma que el contrato de evidencia del piloto es válido. La aceptación pública continúa pendiente.
- Docker Desktop está instalado, pero su motor no quedó disponible durante esta sesión. Por ello no se completaron Compose ni `smoke_operations.py`; esta limitación no se registra como prueba aprobada.

## 2. Alcance congelado del MVP

### Obligatorio para lanzar

1. **Identidad y acceso:** inicio y cierre de sesión, Google OIDC del piloto, roles `STUDENT`, `VALIDATOR` y `ADMIN`, denegación desde backend.
2. **Estudiante:** seleccionar catálogo, proponer un elemento faltante, adjuntar evidencia, enviar, consultar estado, corregir y reenviar.
3. **Validador:** abrir caso, revisar evidencia, confirmar correspondencia con catálogo, observar, rechazar o aprobar y consultar historial.
4. **Administrador:** gestionar catálogo y propuestas, periodos y padrón, revisar calidad, ejecutar y publicar el corte, y consultar estudiantes.
5. **BI:** indicadores por periodo y fecha de corte, brechas, tecnologías, evolución, procedencia y exportación.
6. **Formación:** publicar oportunidades y talleres; el estudiante consulta, guarda preferencias y solicita participación.
7. **Operación:** migraciones, observabilidad mínima, copia y restauración, rollback, privacidad de evidencias y manuales.

### Funciones condicionadas

- El descubrimiento automático de cursos se libera como **beta administrativa** solo si sus fuentes, frecuencia, deduplicación, límites y fallos están probados. El radar debe poder vigilar catálogos de Cisco Networking Academy o Skills for All, Microsoft Learn, AWS Skill Builder, Google Cloud Skills Boost, Oracle, IBM, Red Hat y otras plataformas pertinentes cuando exista API, RSS, feed, sitemap o permiso de extracción compatible. Si no, el MVP conserva carga y revisión manual de oportunidades.
- **DataCamp no se incorpora mediante scraping directo sin autorización escrita o interfaz oficial**, porque sus condiciones públicas restringen agentes automatizados, búsquedas automáticas y extracción de datos. Puede mantenerse como fuente curada manualmente, o integrarse posteriormente mediante un acuerdo, API o feed expresamente autorizado.
- Los datos de referencia permanecen claramente marcados y separados de los operativos.
- El Data Warehouse puede iniciar con las tablas de hechos ya publicadas; una ampliación dimensional no necesaria para los KPI del piloto queda para la siguiente versión.

### Radar de certificaciones, cursos y talleres

El radar forma parte del alcance funcional, pero **detectar no significa publicar**. Su flujo obligatorio es:

1. Administración registra una fuente, proveedor, URL, método permitido, fecha de revisión de términos y frecuencia máxima.
2. El recolector consulta primero API, RSS, Atom, sitemap o catálogo descargable. Solo usa HTML cuando los términos y `robots.txt` lo permitan.
3. Cada hallazgo se normaliza con proveedor, título, URL canónica, tipo (`COURSE`, `TRACK`, `CERTIFICATION_PREP`, `WORKSHOP`), modalidad, costo, idioma, duración, nivel, habilidades, certificación relacionada, fecha, vigencia y huella de contenido.
4. El sistema deduplica por URL canónica y similitud controlada de proveedor, título y certificación, conserva `first_seen_at` y `last_seen_at`, y marca cambios o enlaces vencidos.
5. El hallazgo queda en `DETECTED` o `IN_REVIEW`. El administrador comprueba pertinencia para EPIS, requisitos, precio, licencia y vigencia.
6. Solo el administrador puede convertirlo en oportunidad publicada o usarlo como base para proponer un taller interno. Pulse EPIS enlaza al proveedor; no suplanta su inscripción ni afirma que un curso otorgue una certificación si la fuente no lo confirma.

La primera versión debe incluir adaptadores configurables, límites de frecuencia, `User-Agent` identificable, timeout, tamaño máximo, SSRF bloqueado, máximo de redirecciones, reintentos con espera, registro de ejecución y desactivación automática tras fallos repetidos. No debe evadir login, CAPTCHA, paywall, rate limit ni medidas técnicas del proveedor.

### Fuera del MVP

- Recomendaciones personalizadas automáticas.
- Evaluación de conocimientos o empleabilidad del estudiante.
- Integraciones institucionales no autorizadas.
- Operación con datos personales reales sobre hosting gratuito o almacenamiento efímero.
- Automatización de fuentes que prohíban extracción o no tengan condiciones operativas definidas.

## 3. Plan de ejecución

El calendario propuesto ocupa cuatro semanas. Las fechas son objetivos; una puerta roja desplaza el lanzamiento y no se compensa omitiendo evidencia.

| Fase | Fechas objetivo | Trabajo principal | Responsable funcional | Salida obligatoria |
|---|---|---|---|---|
| 0. Congelamiento y saneamiento | 9–10 nov | Crear rama de release; respaldar el trabajo local; dividir cambios en PR de catálogo, formación y descubrimiento, UI y documentación; registrar decisiones de alcance | Líder técnico / producto | Árbol limpio, PR trazables y backlog clasificado P0–P2 |
| 1. Seguridad y dependencias | 9–12 nov | Actualizar `next`, `zod` y lockfile a versiones corregidas; repetir auditoría; revisar secretos, cookies, CORS, headers, carga y acceso a evidencias | Backend / frontend / seguridad | Auditoría sin high o critical; ninguna excepción vencida |
| 2. Integridad de datos | 11–15 nov | Probar migraciones `0010–0013` en PostgreSQL vacío y copia anonimizada; catálogo inicial; equivalencia de registros previos; idempotencia y rollback compatible | Backend / datos | Migración reproducible, conciliación antes y después, y plan de reversión |
| 3. Cierre funcional por rol | 13–19 nov | Corregir envío con evidencia, borradores y propuestas, aprobación ligada al catálogo, historial, publicaciones, oportunidades y talleres; separar demo de operación | Producto / frontend / backend | Recorridos de los tres roles cumplen criterios de aceptación |
| 3B. Radar de oferta externa | 15–20 nov | Crear matriz de fuentes y permisos; completar metadatos, adaptadores API, feed o HTML permitido, deduplicación, revisión administrativa y creación de oportunidades o talleres | Backend / datos / producto | Al menos dos fuentes autorizadas operan de extremo a extremo; DataCamp queda manual salvo permiso o API |
| 4. Automatización y UX | 17–21 nov | Actualizar mocks y selectores E2E; interceptar endpoints nuevos; corregir tiempos; probar 390, 768 y 1440 px; accesibilidad básica | Frontend / QA | 58/58 E2E o suite revisada equivalente, 0 fallos, sin scroll horizontal |
| 5. Integración y ensayo | 20–24 nov | API real, PostgreSQL y almacenamiento; recorrido integral; ETL; prueba de concurrencia; carga básica; smoke de contenedor | QA / DevOps | CI verde y reporte de ensayo candidato a release |
| 6. Staging y operación | 23–27 nov | Desplegar commit inmutable; configurar OIDC, roles y secretos; monitoreo; backup y restore; rollback; retención y purga | DevOps / responsable institucional | Staging aceptado, restauración y rollback demostrados |
| 7. Piloto controlado | 28 nov–2 dic | Un administrador, un validador y 5–10 estudiantes de prueba; registrar incidencias, tiempos y conciliación | Producto / usuarios piloto | Acta de UAT, 0 P0 o P1 abiertos y métricas mínimas cumplidas |
| 8. Lanzamiento | 3–4 dic | Go/No-Go, despliegue, smoke, comunicación, soporte y observación intensiva | Comité de lanzamiento | `acceptance.json` completo, tag `v1.0.0` y release publicada |

## 4. Backlog priorizado para el lanzamiento

### P0 — bloquea el MVP

- Resolver avisos críticos de `next` y alto de `zod`; la excepción de `braces` vencida también debe eliminarse, actualizarse con base técnica nueva o seguir bloqueando.
- Recuperar una suite de navegador determinista. Clasificar los 32 fallos en: regresión real, contrato obsoleto, endpoint nuevo no simulado y problema de infraestructura del test.
- Probar migraciones nuevas sobre PostgreSQL y datos previos, incluyendo la vinculación de certificaciones antiguas al catálogo.
- Garantizar que ningún caso llegue a aprobación sin evidencia vigente y sin credencial canónica confirmada.
- Repetir el flujo integral real de estudiante → validador → publicación → indicadores → formación.
- Impedir que una fuente sin términos revisados o con prohibición de automatización se active; probar que ningún hallazgo se publique sin aprobación administrativa.
- Configurar y verificar OIDC real, cuentas, roles y secretos de staging.
- Ejecutar y documentar backup y restauración de base y archivos, más rollback del código.
- Completar aceptación pública con enlaces verificables; no crear `v1.0.0` mientras el estado sea pendiente.

### P1 — requerido antes del piloto

- Actualizar manual de usuario, API, modelo de datos y arquitectura para catálogo, propuestas, borradores y descubrimiento.
- Sembrar catálogo inicial aprobado y definir quién resuelve propuestas, en qué plazo y con qué criterio.
- Validar navegación móvil, teclado, mensajes de error, estados vacíos y confirmaciones persistentes.
- Añadir observabilidad de `/ready`, errores 5xx, latencia, ejecución ETL, uso de almacenamiento y fallos de descubrimiento.
- Mantener una matriz versionada de fuentes con proveedor, URL, método autorizado, evidencia de permiso, frecuencia, responsable y fecha de próxima revisión.
- Definir retención, purga y acceso a evidencia con responsable operativo.
- Preparar soporte: canal, horario, severidades, responsable y respuesta esperada.

### P2 — posterior a `v1.0.0`

- Personalización de oportunidades con explicación de afinidad.
- Mayor automatización de descubrimiento y conciliación semántica.
- Ampliación del Data Warehouse, tableros históricos y métricas de adopción.
- Mejoras visuales no relacionadas con comprensión, accesibilidad o cierre del recorrido.

## 5. Puertas Go/No-Go

El lanzamiento se autoriza únicamente si todas las condiciones están en verde:

- [ ] `main` limpio, protegido y con PR revisados; commit candidato identificado.
- [ ] Backend completo en PostgreSQL: 0 fallos y 0 omisiones sin justificación firmada.
- [ ] ESLint, TypeScript y build: 0 errores.
- [ ] E2E simulada y E2E con API real: 0 fallos; evidencia adjunta al CI.
- [ ] Auditoría: 0 vulnerabilidades high o critical en producción y sin excepciones vencidas.
- [ ] Migraciones y conciliación aprobadas; backup previo disponible.
- [ ] OIDC real y autorización de los tres roles verificadas.
- [ ] Evidencias privadas no son públicas y sus accesos quedan auditados.
- [ ] Restauración y rollback ensayados en el ambiente elegido.
- [ ] Smoke de producción: `/`, `/ready`, login, carga y consulta de evidencia, publicación y exportación.
- [ ] UAT firmada; 0 defectos P0 o P1 abiertos.
- [ ] Radar probado con fuentes autorizadas: deduplicación, cambios, enlaces vencidos, rate limit, fallos y publicación exclusivamente manual.
- [ ] `pilot/acceptance.json` en `accepted`, con URL y enlaces reales.
- [ ] Manual, privacidad, soporte y comunicación publicados.

**Regla:** si falla seguridad, integridad de datos, autenticación, evidencia, restauración o autorización, la decisión automática es **NO-GO**.

## 6. Métricas del piloto y primeras 72 horas

| Métrica | Umbral de aceptación |
|---|---|
| Conciliación de padrón | 100 % de filas aceptadas o rechazadas con motivo |
| Credenciales aprobadas contabilizadas | 100 % en el corte publicado correspondiente |
| Casos aprobados sin evidencia o catálogo | 0 |
| Acceso indebido entre roles o estudiantes | 0 |
| Éxito de recorridos críticos | Al menos 95 % sin asistencia técnica |
| Errores 5xx en recorridos críticos | 0 durante UAT; alerta inmediata en producción |
| Recuperación verificada | Base y evidencias restauradas y contrastadas |
| P0 o P1 posteriores al despliegue | 0 abiertos; un P0 activa rollback o suspensión |

Durante las primeras 72 horas se revisan salud, autenticación, errores 4xx y 5xx, cola de validaciones, ETL, almacenamiento y soporte al inicio y cierre de cada jornada. Un P0 suspende nuevas cargas; si afecta integridad, privacidad o acceso, se ejecuta rollback y se conserva evidencia para análisis.

## 7. Próxima acción concreta

La siguiente iteración no debe empezar por nuevas funciones. Debe crear el candidato de release desde el estado local, resolver seguridad y convertir los 32 fallos E2E en una lista clasificada con dueño y criterio de cierre. Cuando esas dos puertas estén verdes, se ejecutan migraciones y el recorrido real; recién entonces se habilita staging y el piloto.
