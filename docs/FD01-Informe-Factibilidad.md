# Informe de Factibilidad

## Pulse EPIS Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS

**Universidad Privada de Tacna**  
**Facultad de Ingeniería**  
**Escuela Profesional de Ingeniería de Sistemas**  
**Curso:** Inteligencia de Negocios  
**Docente:** Patrick Cuadros Quiroga  
**Integrantes:**

- Kiara Holly Zapana Murillo (2023077087)
- Vincenzo Rafael Lllanos Niño (2023076796)

**Tacna, Perú — 2026**

> La formulación vigente del problema, las definiciones de estudiante activo y certificación válida, la línea base y la clasificación de fuentes se mantienen en [Problema, población y línea base](00-Problema-y-linea-base.md).

> Los objetivos, metas y fórmulas de medición se mantienen en [Objetivos e indicadores medibles](01-Objetivos-medibles.md).

## Control de versiones

| Versión | Autores | Fecha | Motivo |
|---|---|---|---|
| 2.0 | Kiara Zapana y Vincenzo Lllanos | 09/09/2026 | Adaptación integral al proyecto Pulse EPIS |
| 2.1 | Kiara Zapana y Vincenzo Lllanos | 11/09/2026 | Completar supuestos, riesgos, plan temporal y reproducción del entregable |

## Resumen ejecutivo y decisión

La solución es **viable de forma condicionada para un piloto institucional**. El prototipo actual demuestra la navegación, los indicadores y el flujo visual, pero usa datos sintéticos y no debe presentarse como un sistema de producción. El paso a un piloto requiere un padrón autorizado, responsables de validación, reglas de tratamiento de datos y una infraestructura mínima con respaldos.

La decisión de producción queda condicionada a superar los siguientes hitos:

1. EPIS entrega un padrón oficial con fecha de corte y autoriza su uso.
2. Se aprueban el diccionario de datos, las reglas de certificación válida y la retención de evidencias.
3. Se implementan autenticación, permisos, persistencia, auditoría y respaldo.
4. Un piloto demuestra las metas de [Objetivos e indicadores medibles](01-Objetivos-medibles.md) sin exponer datos personales en las vistas públicas.

## 1. Descripción del proyecto

### 1.1 Nombre

**Pulse EPIS Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS**.

### 1.2 Problema y propuesta

La EPIS necesita demostrar, para sus procesos de mejora continua y acreditación, qué proporción de sus estudiantes activos posee certificaciones tecnológicas válidas, cómo evoluciona el indicador y qué brechas existen frente al mercado laboral. La información puede encontrarse dispersa entre formularios, hojas de cálculo, certificados PDF, plataformas de insignias y registros académicos. Una cifra agregada publicada en el portal institucional permite conocer el contexto, pero no identifica de forma confiable a cada estudiante ni prueba que una credencial le pertenezca.

Pulse EPIS centralizará el padrón académico autorizado y las evidencias de certificación, validará cada registro y producirá indicadores trazables. La fuente de identidad será un padrón entregado por EPIS o Secretaría Académica con código universitario, correo institucional, estado y ciclo; no se obtendrán identidades mediante scraping de páginas públicas.

La definición operativa es deliberadamente estricta: el padrón oficial determina el denominador; una certificación solo entra en los KPI después de conciliar titularidad, emisor, fechas, evidencia, estado aprobado y duplicidad. La línea base actual es sintética y sirve únicamente para demostrar el prototipo; la línea base institucional se levantará durante el piloto con fecha de corte aprobada por EPIS.

### 1.3 Objetivo general

Diseñar e implementar una plataforma de inteligencia de negocios que consolide, valide y visualice las certificaciones de los estudiantes de la EPIS para apoyar la acreditación, la mejora curricular y la identificación de talento.

### 1.4 Objetivos específicos

1. Integrar el padrón oficial con certificaciones reportadas y credenciales digitales verificables.
2. Calcular indicadores por periodo, cohorte, ciclo, proveedor, nivel y área tecnológica.
3. Mantener evidencia y trazabilidad del origen y estado de validación.
4. Proteger datos personales mediante control de acceso, seudonimización y publicación agregada.
5. Comparar competencias certificadas con señales documentadas de demanda laboral.
6. Generar reportes exportables para calidad y acreditación.

### 1.5 Alcance

Incluye autenticación institucional, carga del padrón, registro de certificaciones, evidencias, validación administrativa, ETL, almacén analítico, dashboard, filtros, exportación y auditoría. El MVP atenderá a la EPIS y podrá ampliarse a otras escuelas.

No incluye acceso no autorizado al sistema académico, extracción de perfiles privados, verificación biométrica, scraping de identidades, ni rankings nominales públicos. Las integraciones con proveedores solo se habilitarán después de verificar sus términos, permisos y límites técnicos.

## 2. Identificación de estudiantes y gobierno de datos

La identificación utilizará un **identificador interno estable**. El código universitario será la clave natural de ingreso, pero en analítica se reemplazará por `student_key`, sin significado externo.

| Fuente | Datos mínimos | Uso | Tratamiento |
|---|---|---|---|
| Padrón oficial EPIS | código, correo, ciclo, estado y periodo | Denominador y vinculación | Acceso restringido; carga con fecha de corte |
| Formulario institucional | código, credencial, URL o PDF y consentimiento cuando corresponda | Registro de evidencia | Validación contra padrón |
| Credly u Open Badges | URL pública, emisor, emisión y expiración | Verificación | No se buscarán personas por correo sin autorización |
| Portal EPIS | totales agregados publicados | Contraste | No identifica personas |

El correo puede ayudar a validar el código, pero inferir el ciclo desde el año contenido en él es aproximado y no sustituye la matrícula. El flujo será: importar padrón, crear `student_key`, registrar evidencia, verificar emisor y fechas, resolver duplicados y cargar solo atributos necesarios al almacén analítico.

### 2.1 Flujo operativo del piloto

| Paso | Actividad | Resultado verificable | Responsable principal |
|---:|---|---|---|
| 1 | Autorizar alcance, fecha de corte y padrón | Acta o autorización institucional | Responsable de datos / ADMIN |
| 2 | Importar y conciliar el padrón | Reporte de registros aceptados, rechazados y faltantes | ADMIN |
| 3 | Recibir certificaciones y evidencias | Registro con fuente, fecha y titular declarado | STUDENT |
| 4 | Revisar emisor, titularidad, vigencia y duplicidad | Decisión aprobada, observada o rechazada | VALIDATOR |
| 5 | Cerrar el periodo y publicar indicadores | KPI con corte, definición y trazabilidad | ADMIN / VALIDATOR |
| 6 | Atender correcciones y derechos del titular | Bitácora de cambios y respuesta documentada | Responsable de datos |

En el MVP se usarán tres roles técnicos (`ADMIN`, `VALIDATOR` y `STUDENT`). Los actores de negocio adicionales —responsable de datos, analista, visitante, Dirección o Comité— se atenderán mediante permisos y vistas específicas, sin multiplicar roles técnicos antes de contar con una necesidad demostrada.

## 3. Factibilidad técnica

### 3.1 Qué demuestra el prototipo actual

El repositorio demuestra viabilidad visual con Next.js, TypeScript, Tailwind CSS y Recharts. También contiene un ETL reproducible en Python y pantallas para dashboard, estudiantes, tecnologías, validaciones y administración.

Los siguientes archivos contienen datos de demostración o de prueba y **no representan la línea base institucional**:

- `dashboard-app/src/shared/api/mock-data.json`.
- `dashboard-app/src/shared/api/etl_data.json`.

En consecuencia, el prototipo permite revisar la experiencia y la lógica de presentación, pero todavía no ofrece persistencia multiusuario, autenticación institucional, autorización real, auditoría completa, almacenamiento privado de evidencias ni una integración validada con el padrón de EPIS.

### 3.2 Diferencia entre prototipo y producción

| Capacidad | Prototipo del repositorio | Requisito para piloto/producción |
|---|---|---|
| Identidad | JSON de demostración | Padrón autorizado, `student_key` y conciliación por corte |
| Certificaciones | Datos preparados para visualización | Registro persistente con estado, emisor, fechas y evidencia |
| Validación | Flujo visual | Reglas, decisiones, observaciones y bitácora auditable |
| Acceso | Roles simulados en frontend | Autenticación institucional y RBAC en backend |
| Almacenamiento | Archivos locales del repositorio | Base de datos y evidencias privadas con respaldo |
| Indicadores | Cálculo sobre datos estáticos | Consultas reproducibles por periodo y fecha de corte |
| Integraciones | ETL reproducible y fuentes de prueba | Importación autorizada, límites documentados y reintentos |
| Publicación | Vistas del dashboard | Separación entre vistas nominales restringidas y agregadas públicas |
| Operación | Ejecución manual | Monitoreo, logs, restauración y responsable de soporte |

### 3.3 Arquitectura objetivo

Para el piloto se propone PostgreSQL como almacén transaccional y analítico inicial, una API en FastAPI o Next.js, almacenamiento privado de evidencias y tareas programadas para importación y recalculo. La interfaz existente puede evolucionar sobre Next.js.

La API pública de Credly no debe asumirse capaz de buscar libremente por correo. Se usará una URL pública entregada por el estudiante, Open Badges cuando esté disponible, un archivo autorizado o revisión humana. Cualquier proveedor deberá pasar por una prueba de permisos, límites, términos de uso y recuperación ante errores.

### 3.4 Brechas técnicas y criterio de salida

No se recomienda declarar producción mientras falte cualquiera de estos controles: autenticación, autorización del lado servidor, validación de entradas, cifrado en tránsito y reposo cuando corresponda, copia de respaldo probada, trazabilidad de decisiones y pruebas de restauración. El piloto puede iniciar con servicios administrados de bajo costo si los datos nominales permanecen restringidos y el responsable institucional aprueba la configuración.

## 4. Factibilidad económica

### 4.1 Supuestos de estimación

Los montos son una **estimación de planificación**, no una cotización ni una promesa de gasto institucional. Se expresan en soles peruanos, no incluyen impuestos ni costos contractuales que EPIS deba negociar y deben actualizarse antes del piloto.

Se asume que:

- el desarrollo académico del equipo no genera un desembolso directo para el piloto;
- EPIS puede proporcionar o reutilizar una cuenta institucional, dominio o infraestructura existente;
- el piloto comienza con una escuela, una carga periódica y un volumen reducido de evidencias;
- el almacenamiento de certificados crece según el número y tamaño real de los archivos;
- no se contratará una API externa ni scraping para suplir la ausencia de un padrón autorizado;
- el costo laboral de validadores, responsable de datos y soporte se controla como recurso institucional, aunque debe reconocerse en la evaluación definitiva.

### 4.2 Costos previstos

| Concepto | Tipo | Alternativa inicial | Rango de planificación | Supuesto que puede cambiarlo |
|---|---|---|---:|---|
| Análisis y desarrollo académico | Único | Trabajo del equipo | S/ 0 directo | No incluye valorización de horas de trabajo |
| Dominio | Anual | Subdominio institucional o dominio existente | S/ 0–150/año | Precio, renovación y proveedor |
| Frontend y API | Mensual | Servicio educativo, gratuito o infraestructura EPIS | S/ 0–150/mes | Tráfico, límites y necesidad de entorno separado |
| PostgreSQL | Mensual | Plan gratuito/educativo o servidor institucional | S/ 0–120/mes | Tamaño, respaldos, alta disponibilidad y soporte |
| Evidencias privadas | Mensual | Almacenamiento institucional o de objetos | S/ 0–100/mes inicial | Número, tamaño, retención y copias |
| Monitoreo y correo transaccional | Mensual | Herramientas institucionales o plan gratuito | S/ 0–100/mes | Alertas, volumen y retención de logs |
| API o verificación de terceros | Variable | URL pública, archivo autorizado y revisión humana | S/ 0 inicialmente | Licencia, límites y términos del proveedor |
| Capacitación y soporte | Recurrente | Responsables de EPIS | Por definir | Horas institucionales y nivel de servicio |

Con las alternativas iniciales, el costo técnico recurrente de referencia es **S/ 0–470 mensuales**, incluyendo hasta S/ 100 mensuales de almacenamiento inicial, y **S/ 0–150 anuales por dominio**. Si el volumen de evidencias supera el supuesto del piloto, se añadirá el costo variable correspondiente. Este rango sirve para comparar opciones durante el piloto; no autoriza una contratación. La alternativa preferida es reutilizar infraestructura institucional y contratar servicios externos solo cuando exista una necesidad cuantificada.

El beneficio esperado es reducir consolidación manual, reprocesos y tiempo de preparación de evidencias para acreditación. La medición de ese beneficio se realizará en el piloto comparando horas y errores del proceso actual contra el proceso con Pulse EPIS; no se asigna un ahorro monetario sin datos observados.

## 5. Factibilidad operativa, legal y social

### 5.1 Responsabilidades mínimas

| Responsabilidad | Decisión o tarea | Rol MVP |
|---|---|---|
| Gobierno del padrón | Autorizar fuente, corte, cambios y retención | ADMIN / responsable de datos |
| Validación de credenciales | Aprobar, observar o rechazar evidencias | VALIDATOR |
| Registro personal | Declarar certificaciones y corregir información propia | STUDENT |
| Indicadores | Consultar tendencias y brechas sin modificar datos | Vista de analista |
| Publicación | Mostrar únicamente agregados y contexto metodológico | ADMIN |
| Supervisión | Aprobar alcance y recibir reportes | Dirección / Comité |

La operación requiere un responsable de datos, al menos un validador titular y uno de respaldo, un calendario de cierre semestral y un canal para correcciones. Si no se designan esas personas, el sistema puede mostrar una interfaz, pero no puede producir una cifra institucional confiable.

### 5.2 Tratamiento legal y social

El tratamiento debe diseñarse conforme a la Ley peruana 29733 y a las políticas de la Universidad. Este documento no sustituye una revisión legal institucional. Antes del piloto se debe definir formalmente la finalidad, base habilitante o consentimiento cuando corresponda, aviso de privacidad, minimización de campos, perfiles de acceso, plazo de retención, eliminación o anonimización y atención de derechos del titular.

El padrón y las evidencias nominales permanecerán restringidos. Las vistas públicas usarán agregados, umbrales de publicación cuando sean necesarios y una fecha de corte visible. Nombres, correos, códigos, enlaces privados y rankings nominales no se publicarán sin autorización y finalidad académica explícita. Las métricas de demanda laboral se presentarán como señales documentadas, no como una garantía de empleabilidad ni como criterio automático de evaluación de estudiantes.

## 6. Matriz de riesgos

Escala: **Probabilidad** = baja, media o alta; **Impacto** = bajo, medio, alto o crítico. El riesgo residual supone que las acciones preventivas ya fueron implementadas.

| ID | Riesgo | Categoría | Prob. | Impacto | Señal de activación | Responsable | Prevención | Contingencia | Residual |
|---|---|---|:---:|:---:|---|---|---|---|:---:|
| R-01 | Padrón incompleto, desactualizado o sin fecha de corte | Datos | Alta | Alto | Diferencia entre padrón y conteo oficial | Responsable de datos | Acta de entrega, esquema obligatorio y conciliación | Pausar KPI nominal y emitir reporte de faltantes | Medio |
| R-02 | Certificado falso, vencido o duplicado | Calidad | Media | Alto | Evidencia no verificable o coincidencia de hash/URL | VALIDATOR | Reglas de emisor, fechas, titularidad y unicidad | Marcar como observado/rechazado y solicitar corrección | Medio |
| R-03 | Proveedor limita API, cambia términos o bloquea automatización | Integración | Alta | Medio | Error 401/403, límite excedido o cambio de contrato | ADMIN | Priorizar fuentes autorizadas y registrar versión | Cambiar a carga CSV/URL y revisión manual | Medio |
| R-04 | Exposición de datos personales por configuración o exportación | Seguridad | Media | Crítico | Archivo o endpoint nominal accesible sin permiso | ADMIN / soporte | RBAC servidor, mínimo privilegio, cifrado y revisión de exportaciones | Revocar acceso, preservar logs, notificar y activar protocolo institucional | Medio |
| R-05 | Retención o uso incompatible con la finalidad declarada | Legal | Media | Alto | Solicitud de eliminación o campo sin propósito documentado | Responsable de datos | Diccionario, política de retención y revisión legal | Bloquear campo, anonimizar/eliminar y responder al titular | Bajo |
| R-06 | Baja participación estudiantil o poca capacidad de validación | Operación | Media | Alto | Evidencias pendientes o tiempos de revisión crecientes | ADMIN / VALIDATOR | Calendario, capacitación, validador de respaldo y estado visible | Ampliar ventana, priorizar cierre y reportar cobertura real | Medio |
| R-07 | Pérdida, corrupción o indisponibilidad de datos | Continuidad | Media | Crítico | Fallo de servicio o restauración no verificable | ADMIN / soporte | Copias automáticas, control de versiones y prueba de restauración | Restaurar último respaldo válido y registrar la incidencia | Medio |
| R-08 | Indicadores sesgados por fuentes laborales o categorías ambiguas | Analítica | Media | Medio | Resultado cambia por una sola fuente o taxonomía | Analista | Metodología visible, varias fuentes y catálogo versionado | Publicar limitación y recalcular con una fuente revisada | Bajo |
| R-09 | Dependencia de dos desarrolladores | Proyecto | Alta | Medio | Incidencia sin responsable o conocimiento concentrado | Dirección / equipo | README, documentación, revisión por pares y CI | Congelar alcance, transferir conocimiento y priorizar correcciones | Medio |
| R-10 | El costo real supera la estimación inicial | Económico | Media | Medio | Límite gratuito excedido o cotización mayor | ADMIN / Dirección | Presupuesto por escenario y alertas de consumo | Volver a infraestructura institucional y reducir alcance | Bajo |

La matriz se revisará en cada hito y ante un cambio de proveedor, fuente, finalidad o alcance. Los riesgos R-01, R-04 y R-05 son bloqueantes para publicar datos nominales aunque el dashboard técnico funcione.

## 7. Factibilidad temporal y plan de ejecución

El plan de 16 semanas supone disponibilidad del responsable de datos y de los validadores. Las semanas son una secuencia de trabajo para el piloto, no una promesa de despliegue institucional.

| Fase | Semanas | Dependencia de entrada | Entregable / puerta de control |
|---|---:|---|---|
| Gobierno y acceso | 1–2 | Sponsor y responsable designados | Alcance, roles, finalidad, padrón de prueba y acta |
| Modelo y backend | 3–5 | Diccionario y reglas aprobadas | Esquema, API, autenticación y permisos probados |
| Ingesta y validación | 6–8 | Padrón conciliable y formulario | Carga, deduplicación, evidencia y bitácora |
| BI y reportes | 9–11 | Datos validados | KPI, filtros, fecha de corte y exportación |
| Calidad y seguridad | 12–13 | Flujo integrado | Pruebas, revisión de permisos, respaldo y restauración |
| Piloto y decisión | 14–16 | Puertas anteriores aprobadas | Capacitación, medición de metas y decisión de producción |

### 7.1 Camino crítico

`Autorización del padrón → Diccionario y reglas → Modelo persistente → Ingesta y validación → KPI trazables → Seguridad y restauración → Piloto`.

Si se retrasa la autorización del padrón, se puede continuar con datos sintéticos para probar la interfaz, pero no se puede declarar éxito institucional ni cerrar la factibilidad de producción. La aprobación de cada puerta debe quedar registrada en el repositorio o en el acta institucional correspondiente.

## 8. Criterios de éxito del piloto

Los objetivos y fórmulas completas se encuentran en [Objetivos e indicadores medibles](01-Objetivos-medibles.md). Para la decisión del piloto se verificará como mínimo:

- al menos 95 por ciento del padrón activo conciliado;
- 100 por ciento de las certificaciones incluidas en los KPI con fuente y estado;
- duplicados inferiores al 1 por ciento después del ETL;
- consultas principales en menos de dos segundos con el volumen del piloto;
- reportes reproducibles por periodo, filtros y fecha de corte;
- cero datos personales en vistas públicas;
- respaldo restaurado exitosamente en una prueba documentada;
- responsables de datos y validación identificados y activos.

No se considerará logrado un indicador si solo se cumple con los JSON sintéticos del prototipo.

## 9. Reproducibilidad del PDF

El Markdown de este archivo es la fuente canónica. El script [`render-fd01.ps1`](render-fd01.ps1) genera el PDF con una configuración fija y deja el archivo generado fuera del control de versiones porque `*.pdf` está ignorado en la raíz del repositorio.

Requisitos de reproducción:

- Pandoc 3.x.
- XeLaTeX o Tectonic disponible en el `PATH`.
- PowerShell 5.1 o superior.

Desde la raíz del repositorio se ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File .\docs\render-fd01.ps1
```

El resultado esperado es `docs/FD01-Informe-Factibilidad.pdf`. Para verificar el artefacto generado se puede calcular:

```powershell
Get-FileHash .\docs\FD01-Informe-Factibilidad.pdf -Algorithm SHA256
```

Si una máquina no tiene Pandoc o un motor PDF, el script informa la dependencia faltante en lugar de producir un archivo incompleto. La fecha, autores, márgenes, índice y numeración se fijan en el script para que dos ejecuciones sobre el mismo contenido sean comparables.

## 10. Conclusión

Pulse EPIS es **viable de manera condicionada para un piloto**, porque el prototipo ya demuestra el flujo visual y el stack tecnológico es accesible para el equipo. No es viable declarar producción con los datos y controles actuales: todavía deben incorporarse padrón autorizado, persistencia, autenticación, autorización del lado servidor, gobierno de evidencias, auditoría, respaldo e integración operativa.

La recomendación es aprobar un piloto acotado a la EPIS, con datos autorizados y vistas nominales restringidas, y tomar la decisión de producción únicamente después de medir los criterios de éxito. Si no se obtiene el padrón o no se designan validadores, el proyecto debe mantenerse como demostrador sintético y no presentar sus cifras como resultados institucionales.

## 11. Referencias

- [Repositorio Pulse EPIS](https://github.com/Kiara1616/pulse-epis).
- [Portal institucional de la EPIS](http://epis.upt.edu.pe/acreditacion/index.php/inicio/concursoproyectos).
- [Ley 29733 — Ley de Protección de Datos Personales](https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470-29733).
- [1EdTech Open Badges](https://www.1edtech.org/standards/open-badges).
