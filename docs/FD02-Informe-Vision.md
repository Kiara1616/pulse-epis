# Informe de Visión

## Pulse EPIS Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS

**Integrantes:** Kiara Holly Zapana Murillo (2023077087) y Vincenzo Rafael Lllanos Niño (2023076796)<br>
**Curso:** Inteligencia de Negocios<br>
**Versión:** 2.1<br>
**Fecha:** 11/09/2026

**Issue:** [#4 — Completar FD02: actores, capacidades y visión](https://github.com/Kiara1616/pulse-epis/issues/4)

> Este documento adopta las definiciones y la línea base de [Problema, población y línea base](00-Problema-y-linea-base.md). Las cifras de `mock-data.json` son demostrativas y no constituyen una medición oficial.

> Los objetivos verificables y el diccionario mínimo de KPIs están definidos en [Objetivos e indicadores medibles](01-Objetivos-medibles.md).

## 1 Propósito

Este documento define la visión de Pulse EPIS, una plataforma institucional para conocer el nivel de certificación tecnológica de los estudiantes, conservar evidencia verificable y producir información útil para acreditación y mejora curricular.

## 2 Oportunidad

La EPIS dispone de información académica y publica algunos datos agregados, mientras que las certificaciones se encuentran distribuidas en distintas plataformas y archivos. La oportunidad consiste en relacionar de forma gobernada el universo oficial de estudiantes con credenciales verificadas para responder cuántos están certificados, en qué tecnologías, nivel y vigencia, y qué brechas existen frente al mercado.

## 3 Definición del problema

| Elemento | Definición |
|---|---|
| Problema | No existe una fuente consolidada y trazable de certificaciones EPIS |
| Afecta a | Dirección, Comité de Calidad, estudiantes y acreditación |
| Consecuencia | Reportes manuales e indicadores no reproducibles |
| Solución | BI con padrón oficial, evidencias, validación, ETL y dashboard por roles |

La población de referencia será el padrón EPIS autorizado por periodo. La cobertura se calculará sobre estudiantes activos y solo contabilizará certificaciones válidas según las reglas operativas del documento base.

## 4 Visión del producto

Para la Dirección y el Comité de Calidad que necesitan evidencia cuantitativa auditable, Pulse EPIS es un sistema web de inteligencia de negocios que consolida estudiantes y certificaciones verificadas, calcula indicadores y genera reportes por periodo. A diferencia de una hoja aislada, mantiene trazabilidad, reglas de calidad, seguridad por roles e historial.

## 5 Actores de negocio e interesados

Un actor de negocio representa una responsabilidad o interés frente al producto. No equivale automáticamente a un rol técnico de autorización. La solución debe conservar esta distinción para no conceder permisos por el nombre de una persona o por la pantalla que utiliza.

| Actor de negocio | Necesidad o responsabilidad | Interacción con el producto |
|---|---|---|
| Administrador | Configurar periodos, catálogos y reglas operativas | Gestiona la configuración autorizada |
| Responsable de datos | Entregar, importar y corregir el padrón oficial | Solicita cargas y revisa conciliaciones |
| Validador | Revisar titularidad, emisor, vigencia y evidencia | Decide aprobar, observar o rechazar |
| Analista | Consultar indicadores y preparar reportes | Usa indicadores de solo lectura |
| Estudiante | Registrar certificaciones y consultar su estado | Gestiona únicamente sus evidencias |
| Visitante | Conocer resultados generales de la EPIS | Consulta información agregada y anonimizada |

Dirección EPIS y Comité de Calidad son interesados y consumidores de reportes. Pueden solicitar vistas o reportes autorizados, pero no requieren un rol técnico adicional para el MVP. Sus necesidades se atienden mediante alcance de datos, permisos de lectura y exportaciones controladas.

### 5.1 Roles técnicos de autorización del MVP

La implementación inicial tendrá únicamente tres roles técnicos:

| Rol técnico | Permisos base | Límites |
|---|---|---|
| `ADMIN` | Gestionar periodos, catálogos, padrón, configuración y auditoría según permisos asignados | No obtiene automáticamente permiso para validar evidencias ni para publicar datos nominales |
| `VALIDATOR` | Revisar evidencias, registrar decisiones y consultar indicadores necesarios para validar | No administra usuarios, periodos, catálogos ni el padrón |
| `STUDENT` | Registrar y consultar sus propias certificaciones y evidencias | No consulta datos de otros estudiantes ni indicadores nominales |

El acceso analítico de un **Analista** se modelará como el permiso o alcance de solo lectura `ANALYTICS_READ`, asociado a una cuenta autorizada sin capacidades administrativas ni de validación. No se creará un cuarto rol técnico hasta que una necesidad institucional y una matriz de permisos lo justifiquen. El **Visitante** solo accederá a endpoints o vistas públicas agregadas, sin datos nominales ni autenticación privilegiada.

### 5.2 Correspondencia actor–autorización

| Actor de negocio | Rol técnico o alcance MVP | Regla de separación |
|---|---|---|
| Administrador | `ADMIN` | Administra solo las capacidades asignadas |
| Responsable de datos | `ADMIN` + permiso `PADRON_MANAGE` | Puede importar y conciliar; no valida por defecto |
| Validador | `VALIDATOR` | Decide sobre evidencias; no administra el sistema |
| Analista | Alcance `ANALYTICS_READ` | Solo lectura de indicadores y reportes autorizados |
| Estudiante | `STUDENT` | Solo sus datos y evidencias |
| Visitante | Acceso público agregado | Nunca recibe datos nominales |

La aplicación no permitirá que el usuario elija o cambie su rol desde el frontend. La autorización se verificará en el backend y quedará registrada en la auditoría.

## 6 Capacidades

1. Autenticación institucional y roles.
2. Importación de padrón mediante CSV o integración autorizada.
3. Auto registro de certificaciones y evidencias.
4. Verificación por URL, metadatos o revisión manual.
5. Clasificación de proveedor, nivel, tecnología y vigencia.
6. KPIs de cobertura, actividad, crecimiento y diversidad.
7. Análisis por periodo, cohorte, ciclo, proveedor y área.
8. Demanda laboral con fuente y fecha.
9. Exportación PDF, CSV y paquete de evidencias.
10. Auditoría y calidad de datos.

### 6.1 Límites de acceso por capacidad

| Capacidad | `ADMIN` | `VALIDATOR` | `STUDENT` | `ANALYTICS_READ` | Visitante |
|---|:---:|:---:|:---:|:---:|:---:|
| Gestionar periodos, catálogos y configuración | Sí | No | No | No | No |
| Importar y conciliar padrón | Con `PADRON_MANAGE` | No | No | No | No |
| Registrar certificación propia | No | No | Sí | No | No |
| Revisar y decidir evidencias | No por defecto | Sí | No | No | No |
| Consultar indicadores agregados | Sí | Sí | Según alcance | Sí | Sí |
| Consultar detalle nominal | Según autorización explícita | Solo lo necesario para validar | Solo propio | No por defecto | No |
| Exportar reportes | Según permiso | Según permiso de validación | No | Sí, con filtros autorizados | No |
| Ver auditoría | Sí, según permiso | Solo acciones propias relacionadas | No | No | No |

## 7 Indicadores

| Indicador | Fórmula |
|---|---|
| Cobertura | estudiantes activos con certificación válida / estudiantes activos |
| Certificaciones vigentes | validadas con expiración nula o posterior al corte |
| Crecimiento | variación respecto al periodo anterior |
| Diversidad | proveedores con al menos una certificación válida |
| Nivel avanzado | credenciales profesionales o expertas / credenciales válidas |
| Brecha | demanda normalizada menos oferta certificada |

Cada indicador mostrará fecha de corte, población y reglas. El total publicado en la web EPIS será referencia agregada; el denominador oficial procederá del padrón.

## 8 Entregas

### MVP

- Padrón CSV con permiso `PADRON_MANAGE`, formulario, revisión manual y dashboard interno.
- Los tres roles técnicos (`ADMIN`, `VALIDATOR`, `STUDENT`) y el alcance analítico de solo lectura.
- KPIs, proveedores, estudiantes, vigencia y exportación CSV según permisos.
- Seudonimización, separación de vistas públicas y auditoría básica.

### Versión 1.0 institucional

- Inicio institucional, evidencias y notificaciones.
- SSO, integración autorizada de insignias y automatización semestral.
- PDF de acreditación, seguimiento de metas y matriz de permisos revisada.
- Pruebas de autorización que demuestren que ningún actor cruza su límite.

### Escalamiento

- Varias escuelas, permisos por unidad y almacén histórico.
- Catálogo común de competencias y API institucional.

## 9 Suposiciones y restricciones

- EPIS entregará un padrón mínimo y responsable de tratamiento.
- Los estudiantes podrán registrar evidencia con consentimiento.
- Los proveedores pueden restringir sus APIs.
- El portal público no es fuente de identidad individual.
- No se realizará scraping de LinkedIn ni búsqueda de identidades en perfiles públicos; las señales laborales se cargarán como fuentes documentadas y agregadas.
- No se almacenan contraseñas externas ni se publican códigos o nombres.
- Cifras simuladas no se usarán en reportes oficiales.
- El análisis del mercado es una aproximación documentada, no garantía de empleabilidad.

## 10 Prioridades y éxito

| Prioridad | Resultado |
|---|---|
| Crítica | Identidad confiable, privacidad, validez y denominador correcto |
| Alta | Dashboard, filtros, historial y exportación |
| Media | Automatización y análisis laboral |
| Posterior | Recomendaciones, permisos por unidad y extensión multiescuela |

El MVP estará completo cuando opere con datos sintéticos controlados y luego con un padrón real autorizado, cubra registro y validación, reproduzca indicadores, aplique la matriz de acceso, separe vistas agregadas de nominales y supere pruebas de autorización. La versión 1.0 añadirá operación institucional, respaldo, monitoreo, notificaciones y responsables operativos.

## 11 Recomendación

Iniciar con un piloto de un semestre. La primera mejora debe eliminar la duplicidad de JSON simulados y crear una fuente servida por API. El ranking nominal debe ser privado y opcional; para difusión pública se usarán cohortes y porcentajes. La decisión de ampliar capacidades debe partir de la matriz de actores y permisos, no de crear roles técnicos por cada área interesada.
