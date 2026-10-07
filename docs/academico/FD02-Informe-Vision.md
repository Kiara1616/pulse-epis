# Documento de Visión

![Escudo institucional](../recursos/imagenes/upt-logo.png)

**Proyecto:** Pulse EPIS Dashboard de certificaciones tecnológicas verificadas de estudiantes de la EPIS<br>
**Institución:** Universidad Privada de Tacna Facultad de Ingeniería Escuela Profesional de Ingeniería de Sistemas<br>
**Curso:** Inteligencia de Negocios<br>
**Docente:** Patrick Cuadros Quiroga<br>
**Integrantes:** Kiara Holly Zapana Murillo (2023077087) y Vincenzo Rafael Lllanos Niño (2023076796)<br>
**Código:** FD02<br>
**Versión:** 3.3<br>
**Fecha:** 06/10/2026<br>
**Base técnica:** main d123bea; implementación, piloto sintético y documentación de Pulse EPIS

**Escenario de presentación académica:** se asume como estado final Pulse EPIS desplegado y funcionando públicamente, con autenticación y almacenamiento duradero. Este supuesto se desarrolla en FD05, apartado 4.5; las tablas de implementación y resultados distinguen la evidencia técnica comprobada de la aceptación institucional.

## Control de versiones

| Versión | Fecha | Autores | Motivo |
|---|---|---|---|
| 2.x | Septiembre 2026 | Kiara Zapana y Vincenzo Lllanos | Desarrollo de las fuentes del proyecto |
| 3.0 | 01/10/2026 | Vincenzo Lllanos | Generación académica FD01 a FD04 en PR 51 |
| 3.1 | 02/10/2026 | Equipo del proyecto | Organización documental y actualización contra el código |
| 3.3 | 06/10/2026 | Equipo del proyecto | Carátula institucional, formato de informe y actualización de resultados técnicos |

Revisión y aprobación académica: sin acta registrada. La versión del documento no certifica una aprobación ni un despliegue institucional.

## 1 Introducción

### 1.1 Propósito

Este documento define la visión de Pulse EPIS, una plataforma institucional para conocer el nivel de certificación tecnológica de los estudiantes, conservar evidencia verificable y producir información útil para acreditación y mejora curricular.

### 1.2 Alcance definiciones y referencias

Este documento expresa necesidades, posicionamiento, interesados y capacidades del producto. El SRS precisa los criterios de aceptación y el SAD describe decisiones y vistas. La unidad inicial es EPIS; integración multiescuela, publicación pública y demanda externa son objetivos posteriores.

### Definiciones siglas y abreviaturas

| Término | Significado |
|---|---|
| EPIS | Escuela Profesional de Ingeniería de Sistemas |
| BI | Inteligencia de negocios |
| OIDC | OpenID Connect para identidad |
| RBAC | Autorización basada en roles |
| ETL | Extracción, transformación y carga |
| Snapshot | Publicación analítica para periodo y fecha de corte |

### Referencias y visión general

La [línea base](../proyecto/00-Problema-y-linea-base.md), los [objetivos medibles](../proyecto/01-Objetivos-medibles.md), el [SRS](FD03-Especificacion-Requerimientos.md) y el [diccionario implementado](../proyecto/09-Diccionario-indicadores.md) delimitan las necesidades. El sistema relaciona padrón, evidencia, revisión y snapshot; no descubre identidades desde servicios externos.

## 2 Posicionamiento

### 2.1 Oportunidad

La EPIS dispone de información académica y publica algunos datos agregados, mientras que las certificaciones se encuentran distribuidas en distintas plataformas y archivos. La oportunidad consiste en relacionar de forma gobernada el universo oficial de estudiantes con credenciales verificadas para responder cuántos están certificados, en qué tecnologías, nivel y vigencia, y qué brechas existen frente al mercado.

### 2.2 Definición del problema

| Elemento | Definición |
|---|---|
| Problema | No existe una fuente consolidada y trazable de certificaciones EPIS |
| Afecta a | Dirección, Comité de Calidad, estudiantes y acreditación |
| Consecuencia | Reportes manuales e indicadores no reproducibles |
| Solución | BI con padrón oficial, evidencias, validación, ETL y dashboard por roles |

La población de referencia será el padrón EPIS autorizado por periodo. La cobertura se calculará sobre estudiantes activos y solo contabilizará certificaciones válidas según las reglas operativas del documento base.

### 2.3 Visión del producto

Para la Dirección y el Comité de Calidad que necesitan evidencia cuantitativa auditable, Pulse EPIS es un sistema web de inteligencia de negocios que consolida estudiantes y certificaciones verificadas, calcula indicadores y genera reportes por periodo. A diferencia de una hoja aislada, mantiene trazabilidad, reglas de calidad, seguridad por roles e historial.

## 3 Descripción de los interesados y usuarios

Un actor de negocio representa una responsabilidad o interés frente al producto. No equivale automáticamente a un rol técnico de autorización. La solución debe conservar esta distinción para no conceder permisos por el nombre de una persona o por la pantalla que utiliza.

| Actor de negocio | Necesidad o responsabilidad | Interacción con el producto |
|---|---|---|
| Administrador | Configurar periodos, catálogos y reglas operativas | Gestiona la configuración autorizada |
| Responsable de datos | Entregar, importar y corregir el padrón oficial | Solicita cargas y revisa conciliaciones |
| Validador | Revisar titularidad, emisor, vigencia y evidencia | Decide aprobar, observar o rechazar |
| Analista | Consultar indicadores y preparar reportes | Usa indicadores de solo lectura |
| Estudiante | Registrar certificaciones y consultar su estado | Gestiona únicamente sus evidencias |
| Visitante propuesto | Conocer resultados generales de la EPIS | Vista pública agregada pendiente |

Dirección EPIS y Comité de Calidad son interesados y consumidores de reportes. Pueden solicitar vistas o reportes autorizados, pero no requieren un rol técnico adicional para el MVP. Sus necesidades se atienden mediante alcance de datos, permisos de lectura y exportaciones controladas.

### Roles técnicos de autorización del MVP

La implementación inicial tendrá únicamente tres roles técnicos:

| Rol técnico | Permisos base | Límites |
|---|---|---|
| `ADMIN` | Gestionar periodos, catálogos, padrón, configuración y auditoría según permisos asignados | No obtiene automáticamente permiso para validar evidencias ni para publicar datos nominales |
| `VALIDATOR` | Revisar evidencias, registrar decisiones y consultar indicadores necesarios para validar | No administra usuarios, periodos, catálogos ni el padrón |
| `STUDENT` | Registrar y consultar sus propias certificaciones y evidencias | No consulta datos de otros estudiantes ni indicadores nominales |

En el RBAC actual, `ANALYTICS_READ` está incluido en los permisos de `ADMIN` y `VALIDATOR`; no existe todavía una cuenta de analista independiente con permisos arbitrarios. Un perfil exclusivamente analítico requiere ampliar la política de autorización. No se creará un cuarto rol técnico hasta que una necesidad institucional y una matriz de permisos lo justifiquen. El **Visitante** solo accederá a endpoints o vistas públicas agregadas, sin datos nominales ni autenticación privilegiada.

### Correspondencia actor–autorización

| Actor de negocio | Rol técnico o alcance MVP | Regla de separación |
|---|---|---|
| Administrador | `ADMIN` | Administra solo las capacidades asignadas |
| Responsable de datos | `ADMIN` + permiso `PADRON_MANAGE` | Puede importar y conciliar; no valida por defecto |
| Validador | `VALIDATOR` | Decide sobre evidencias; no administra el sistema |
| Analista | Alcance `ANALYTICS_READ` | Solo lectura de indicadores y reportes autorizados |
| Estudiante | `STUDENT` | Solo sus datos y evidencias |
| Visitante propuesto | Acceso público agregado aún no implementado | Nunca recibirá datos nominales |

La aplicación no permitirá que el usuario elija o cambie su rol desde el frontend. La autorización se verificará en el backend y quedará registrada en la auditoría.

### 3.1 Entorno perfiles y responsabilidades

| Perfil | Responsabilidad | Condición de uso |
|---|---|---|
| Dirección y Comité de Calidad | Revisar cierres y aprobar piloto | Reporte autorizado; no implica rol técnico propio |
| Responsable del padrón | Garantizar población por periodo | Cuenta ADMIN y fuente autorizada |
| Validador | Determinar titularidad y validez | Cuenta VALIDATOR y revisión de evidencia |
| Estudiante | Declarar credenciales propias | Cuenta STUDENT vinculada al padrón |
| Equipo desarrollador | Mantener código y pruebas | Entorno de desarrollo con datos sintéticos |

Los usuarios trabajan en navegador. La provisión de cuentas, autorización del padrón y aceptación del cierre dependen de la Universidad. No se inventa una designación nominal de responsables ni un acta de conformidad.

## 4 Vista general del producto

### Perspectiva y capacidades disponibles

El frontend Next.js consume FastAPI mediante cookies de sesión; PostgreSQL conserva operación y snapshots, y un volumen privado conserva evidencias. Se implementan sesión local de desarrollo/OIDC, importación CSV, registro, revisión, ETL, filtros analíticos y exportación CSV. La evolución implementada compara cortes del mismo periodo. Los PDF académicos generados son documentación; no son una exportación PDF de la pantalla.

### Suposiciones y dependencias

Se necesitan cuentas provisionadas, periodos creados, base migrada, catálogos y permisos. La pantalla de importación obtiene sus opciones de periodos publicados; un periodo nuevo puede requerir preparación administrativa en backend. El uso con datos reales depende de autorización y una configuración operativa verificada.

### Costos y precios

El proyecto no comercializa licencias ni tiene una tarifa institucional aprobada. Los costos de planificación y la valorización de horas se desarrollan en [FD01](FD01-Informe-Factibilidad.md). Hosting, dominio, evidencias, respaldo y soporte deben presupuestarse con volumen y cotizaciones.

### Licenciamiento e instalación

No hay archivo LICENSE en el repositorio: no se atribuye una licencia de uso o transferencia de derechos no acordada. La instalación se describe en [Desarrollo local](../proyecto/12-Desarrollo-local.md); Compose incluye frontend, API y PostgreSQL, con Caddy para HTTPS en ambientes externos.

### 4.1 Indicadores

| Indicador | Fórmula |
|---|---|
| Cobertura | estudiantes activos con certificación válida / estudiantes activos |
| Certificaciones vigentes | validadas con expiración nula o posterior al corte |
| Crecimiento | variación respecto al periodo anterior |
| Diversidad | proveedores con al menos una certificación válida |
| Nivel avanzado | credenciales profesionales o expertas / credenciales válidas |
| Brecha | demanda normalizada menos oferta certificada |

Cada indicador mostrará fecha de corte, población y reglas. El total publicado en la web EPIS será referencia agregada; el denominador oficial procederá del padrón.

## 5 Características del producto

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

### Límites de acceso por capacidad

| Capacidad | `ADMIN` | `VALIDATOR` | `STUDENT` | `ANALYTICS_READ` | Visitante |
|---|:---:|:---:|:---:|:---:|:---:|
| Gestionar periodos, catálogos y configuración | Sí | No | No | No | No |
| Importar y conciliar padrón | Con `PADRON_MANAGE` | No | No | No | No |
| Registrar certificación propia | No | No | Sí | No | No |
| Revisar y decidir evidencias | No por defecto | Sí | No | No | No |
| Consultar indicadores agregados | Sí | Sí | No en RBAC actual | Alcance de ADMIN/VALIDATOR | Pendiente |
| Consultar detalle nominal | Según autorización explícita | Solo lo necesario para validar | Solo propio | No por defecto | No |
| Exportar CSV | Sí en vistas habilitadas | Según vista habilitada | No | Alcance de ADMIN/VALIDATOR | No |
| Ver auditoría | Sí, según permiso | Solo acciones propias relacionadas | No | No | No |

### 5.1 Entregas previstas

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

## 6 Restricciones

- EPIS entregará un padrón mínimo y responsable de tratamiento.
- Los estudiantes podrán registrar evidencia con consentimiento.
- Los proveedores pueden restringir sus APIs.
- El portal público no es fuente de identidad individual.
- No se realizará scraping de LinkedIn ni búsqueda de identidades en perfiles públicos; las señales laborales se cargarán como fuentes documentadas y agregadas.
- No se almacenan contraseñas externas ni se publican códigos o nombres.
- Cifras simuladas no se usarán en reportes oficiales.
- El análisis del mercado es una aproximación documentada, no garantía de empleabilidad.

## 7 Rangos de calidad

| Dimensión | Objetivo | Verificación |
|---|---|---|
| Rendimiento | p95 menor a 2 segundos con volumen acordado | Prueba de carga documentada, aún sin medición institucional |
| Disponibilidad | 99.5% en ventana acordada | Monitoreo con periodo y responsable |
| Seguridad | Denegación sin sesión o permiso | Pruebas de acceso horizontal y vertical |
| Recuperación | RPO 24 h y RTO 4 h como objetivos | Ensayo de restauración de base y evidencias |
| Accesibilidad | WCAG 2.1 AA como objetivo del producto | Auditoría funcional y de accesibilidad pendiente |

Las metas no se presentan como certificaciones alcanzadas. Los contratos usan HTTP/JSON y OpenAPI; OIDC restringe acceso institucional. El tratamiento de datos toma como marco la Ley 29733 y su [Reglamento D.S. 016-2024-JUS](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus). La política institucional determinará responsabilidades y conservación.

## 8 Precedencia y prioridad

| Prioridad | Resultado |
|---|---|
| Crítica | Identidad confiable, privacidad, validez y denominador correcto |
| Alta | Dashboard, filtros, historial y exportación |
| Media | Automatización y análisis laboral |
| Posterior | Recomendaciones, permisos por unidad y extensión multiescuela |

El MVP estará completo cuando opere con datos sintéticos controlados y luego con un padrón real autorizado, cubra registro y validación, reproduzca indicadores, aplique la matriz de acceso, separe vistas agregadas de nominales y supere pruebas de autorización. La versión 1.0 añadirá operación institucional, respaldo, monitoreo, notificaciones y responsables operativos.

## 9 Otros requerimientos del producto

La exportación PDF operativa, paquete institucional de acreditación, notificaciones, demanda laboral externa, publicación pública y purga automática de evidencias requieren implementación o validación adicional. Deben conservar su prioridad y criterios en el SRS, sin asumirlos satisfechos por una pantalla ni por un workflow versionado.

## 10 Conclusiones y recomendaciones

Iniciar con un piloto de un semestre y comprobar el flujo completo de la API ya conectada al frontend, con responsables y datos autorizados. El ranking nominal debe ser privado y opcional; para difusión pública se usarán cohortes y porcentajes. La decisión de ampliar capacidades debe partir de la matriz de actores y permisos, no de crear roles técnicos por cada área interesada.

El producto ya integra los flujos principales, pero su aceptación requiere datos autorizados y evidencia operativa. Se recomienda cerrar las brechas según prioridad del SRS y validar indicadores contra una muestra manual. Las referencias técnicas son el [repositorio](https://github.com/Kiara1616/pulse-epis), el SRS, el SAD y los manuales técnicos enlazados; las fuentes institucionales se registran en la línea base con alcance y fecha de consulta.

## 11 Bibliografía y webgrafía

- [Repositorio y antecedentes](https://github.com/Kiara1616/pulse-epis).
- [Fuentes institucionales y línea base](../proyecto/00-Problema-y-linea-base.md).
- [SRS](FD03-Especificacion-Requerimientos.md) y [SAD](FD04-Arquitectura-Software.md).
- [Marco de protección de datos](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus).
