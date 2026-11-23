<p align="center">
  <img src="../recursos/imagenes/upt-logo.png" alt="Escudo institucional" width="150">
</p>

<p align="center">
  <strong>UNIVERSIDAD PRIVADA DE TACNA</strong><br>
  <strong>FACULTAD DE INGENIERÍA</strong><br>
  <strong>Escuela Profesional de Ingeniería de Sistemas</strong>
</p>

<p align="center">
  <strong>Pulse EPIS: plataforma de inteligencia de negocios para la gestión y análisis de certificaciones tecnológicas verificadas de estudiantes de la EPIS</strong>
</p>

<p align="center">
  Curso: Inteligencia de Negocios<br>
  Docente: Patrick Cuadros Quiroga
</p>

<p align="center">
  Integrantes:<br>
  <strong>Zapana Murillo, Kiara Holly (2023077087)</strong><br>
  <strong>Lllanos Niño, Vincenzo Rafael (2023076796)</strong>
</p>

<p align="center">
  <strong>Tacna – Perú</strong><br>
  <strong><em>2026</em></strong>
</p>

---

<p align="center">
  <strong>Pulse EPIS</strong><br>
  Plataforma de inteligencia de negocios para la gestión y análisis de certificaciones tecnológicas verificadas
</p>

# Informe Final del Proyecto

<p align="center">Código FD05<br>Versión <em>3.4</em></p>

**CONTROL DE VERSIONES**

| Versión | Hecha por | Revisada por | Aprobada por | Fecha | Motivo |
|---|---|---|---|---|---|
| 1.0 | KHZM / VRLN | — | — | 02/10/2026 | Elaboración del informe final |
| 3.3 | KHZM / VRLN | — | — | 06/10/2026 | Actualización de presentación y contenido |
| 3.4 | — | — | — | 10/10/2026 | Revisión de estructura, resultados y presupuesto |

**ÍNDICE GENERAL**

- [1. Antecedentes](#1-antecedentes)
- [2. Título](#2-título)
- [3. Autores](#3-autores)
- [4. Planteamiento del Problema](#4-planteamiento-del-problema)
  - [4.1. Problema](#41-problema)
  - [4.2. Justificación](#42-justificación)
  - [4.3. Alcance](#43-alcance)
- [5. Objetivos](#5-objetivos)
  - [5.1. Objetivo General](#51-objetivo-general)
  - [5.2. Objetivos Específicos](#52-objetivos-específicos)
- [6. Marco Teórico](#6-marco-teórico)
- [7. Desarrollo de la Propuesta](#7-desarrollo-de-la-propuesta)
  - [7.1. Análisis de Factibilidad](#71-análisis-de-factibilidad)
    - [7.1.1. Factibilidad Técnica](#711-factibilidad-técnica)
    - [7.1.2. Factibilidad Económica](#712-factibilidad-económica)
    - [7.1.3. Factibilidad Operativa](#713-factibilidad-operativa)
    - [7.1.4. Factibilidad Legal](#714-factibilidad-legal)
    - [7.1.5. Factibilidad Social](#715-factibilidad-social)
    - [7.1.6. Factibilidad Ambiental](#716-factibilidad-ambiental)
  - [7.2. Tecnología de Desarrollo](#72-tecnología-de-desarrollo)
  - [7.3. Metodología de implementación](#73-metodología-de-implementación)
- [8. Cronograma](#8-cronograma)
- [9. Presupuesto](#9-presupuesto)
- [10. Conclusiones](#10-conclusiones)
- [Recomendaciones](#recomendaciones)
- [Anexos](#anexos)
  - [Anexo 01. Informe de Factibilidad](#anexo-01-informe-de-factibilidad)
  - [Anexo 02. Documento de Visión](#anexo-02-documento-de-visión)
  - [Anexo 03. Documento SRS](#anexo-03-documento-srs)
  - [Anexo 04. Documento SAD](#anexo-04-documento-sad)
  - [Anexo 05. Manuales y otros documentos](#anexo-05-manuales-y-otros-documentos)

## 1. Antecedentes

Pulse EPIS se desarrolla en el contexto de la Escuela Profesional de Ingeniería de Sistemas de la Universidad Privada de Tacna y del curso de Inteligencia de Negocios. El proyecto aborda la organización de certificaciones tecnológicas de estudiantes y su transformación en información útil para gestión académica, preparación de evidencias y mejora curricular. Las credenciales son emitidas por sus respectivos proveedores; la plataforma conserva registros, sustento y decisiones de revisión.

La propuesta relaciona dos conjuntos que deben distinguirse: la población académica de cada periodo y los estudiantes con certificaciones admitidas para el análisis. Sin un padrón conciliado, contar documentos recibidos no permite determinar cobertura de la escuela. Asimismo, una declaración o un archivo adjunto no equivalen a una credencial validada. La línea base del proyecto identifica estas diferencias como condiciones para interpretar correctamente los indicadores.

El desarrollo evolucionó desde una interfaz demostrativa hacia un portal integrado con API, persistencia relacional, revisión humana y publicación analítica. Los documentos FD01, FD02, FD03 y FD04 establecen factibilidad, visión, requisitos y arquitectura. El informe final reúne esos elementos y describe el alcance disponible en la copia local del proyecto al 10 de octubre de 2026.

La evidencia disponible incluye pruebas sintéticas, contratos, código y un registro de verificación del flujo académico local. Ese registro documenta carga de padrón, navegación por roles, publicación y reportes. La ejecución local constituye un avance técnico; la aceptación institucional, la autorización de cifras y la operación en infraestructura definitiva requieren sus propios registros de conformidad.

## 2. Título

**Pulse EPIS: plataforma de inteligencia de negocios para la gestión y análisis de certificaciones tecnológicas verificadas de estudiantes de la Escuela Profesional de Ingeniería de Sistemas de la Universidad Privada de Tacna.**

La denominación abreviada es **Pulse EPIS**. El dashboard presenta resultados de un proceso que comprende padrón, credenciales, evidencias, decisiones y cortes analíticos. El título expresa tanto la gestión de los datos de origen como su análisis institucional.

## 3. Autores

| Autor | Código universitario | Participación en el proyecto |
|---|---|---|
| Kiara Holly Zapana Murillo | 2023077087 | Desarrollo y documentación de Pulse EPIS |
| Vincenzo Rafael Lllanos Niño | 2023076796 | Desarrollo y documentación de Pulse EPIS |

El proyecto se presenta en el curso de **Inteligencia de Negocios**, bajo la docencia de **Patrick Cuadros Quiroga**, en la Escuela Profesional de Ingeniería de Sistemas de la Universidad Privada de Tacna.

## 4. Planteamiento del Problema

El problema comprende la calidad de los registros, la revisión de su sustento y la interpretación de resultados sobre una población académica. La solución requiere coordinar esas responsabilidades para evitar que el tablero muestre cifras sin un contexto verificable.

### 4.1. Problema

La información de certificaciones puede encontrarse dispersa entre archivos, declaraciones y fuentes sin una estructura común. Esa dispersión dificulta relacionar una credencial con su titular, verificar emisor y fechas, conocer el estado de revisión y producir un conteo consistente. La ausencia de un corte definido también permite que dos informes utilicen conjuntos distintos sin explicar la diferencia.

Un segundo problema es el denominador. Los estudiantes que entregan certificados no representan necesariamente a toda la población de un periodo. Calcular cobertura únicamente sobre participantes con registros produce una lectura sesgada. El padrón debe identificar estudiantes y matrícula para distinguir población activa, personas certificadas y número de credenciales.

La multiplicidad de habilidades agrega otra dificultad: una credencial puede acreditar varias habilidades y aparecer en varias relaciones analíticas. Su presencia en esas relaciones no debe duplicar el conteo de certificaciones o estudiantes. También es necesario distinguir credenciales pendientes, observadas, rechazadas, aprobadas y vencidas.

La línea base plantea estas condiciones como problema del proyecto. No incorpora una medición institucional cerrada que permita afirmar tiempos medios, porcentajes de error o ahorro real. La evaluación de beneficios deberá contrastarse con responsables de la EPIS y fuentes autorizadas.

### 4.2. Justificación

Pulse EPIS se justifica por la necesidad de obtener información de gestión con población, evidencia y reglas de conteo identificables. La centralización del expediente facilita seguimiento de estados y responsabilidades, mientras la publicación analítica permite consultar cobertura, vigencia y distribución por habilidades sin abrir todos los expedientes individuales.

La trazabilidad aporta valor a la preparación de información para calidad académica: permite explicar de dónde procede un resultado y qué decisiones habilitaron su inclusión. La revisión humana mantiene la responsabilidad sobre el sustento; el sistema registra y organiza la decisión, sin atribuirse la facultad de emitir certificaciones o conceder acreditación institucional.

El análisis también puede orientar acompañamiento y revisión curricular. Una brecha interna por habilidad describe estudiantes sin certificación registrada bajo las reglas del corte; no demuestra ausencia de competencia ni representa automáticamente demanda laboral. Esa distinción evita utilizar el tablero para conclusiones que sus fuentes no permiten sostener.

La utilidad académica debe evaluarse junto con sostenibilidad económica y operativa. FD01 reconoce una inversión valorizada y costos recurrentes; su escenario de ahorro supuesto no justifica rentabilidad monetaria en tres años. La continuidad requiere medir beneficios y acordar recursos institucionales, además de demostrar funcionamiento técnico.

### 4.3. Alcance

| Componente | Alcance disponible en la copia local | Condición o límite |
|---|---|---|
| Acceso | Sesión, Google OIDC configurables, roles ADMIN, VALIDATOR y STUDENT | Las cuentas y el proveedor institucional requieren configuración y verificación del ambiente. |
| Padrón | Periodos, previsualización CSV, carga por periodo, historial y consulta administrativa | La fuente y la población deben ser autorizadas; la carga no genera certificaciones. |
| Credenciales | Registro propio, habilidades, archivos o enlaces y consulta del expediente | El estudiante actúa sobre sus propios registros. |
| Revisión | Inicio de revisión, aprobación, observación, rechazo e historial | La autenticidad depende de la revisión responsable del sustento. |
| Corrección | Edición de observaciones y reenvío desde el flujo estudiantil local | Requiere nueva revisión; no sustituye una decisión previa por aprobación automática. |
| Publicación | ETL por periodo y corte mediante administración, CLI y automatización | La calidad condiciona la publicación y la repetición debe evitar duplicación. |
| Analítica | Cobertura, certificaciones, habilidades, vigencia y evolución por cortes | Algunas dimensiones siguen siendo mutables; el histórico no es íntegramente inmutable. |
| Reportes | CSV y PDF de información analítica autorizada | Un reporte descargado no equivale a un paquete oficial de acreditación aprobado. |
| Operación | Configuración de contenedores, monitoreo y respaldo conjunto | El cierre institucional exige infraestructura, recuperación y responsables verificados. |

La versión documentada se concentra en el flujo académico de la EPIS. No incluye emisión de certificados de terceros, sustitución del sistema académico, comparación con demanda laboral externa ni operación multiescuela aceptada. Tampoco se acredita una publicación anónima de indicadores: las funciones disponibles se restringen por permisos.

## 5. Objetivos

Los objetivos relacionan la operación del sistema con resultados de información. Su cumplimiento técnico puede comprobarse mediante casos de control; el efecto institucional exige evaluar adopción, calidad de fuentes y utilidad de los reportes.

### 5.1. Objetivo General

Desarrollar e integrar una plataforma de inteligencia de negocios que organice certificaciones tecnológicas y sus evidencias, facilite su revisión y produzca indicadores sobre una población académica definida de la EPIS, para apoyar gestión de calidad y mejora curricular con acceso controlado y trazabilidad.

### 5.2. Objetivos Específicos

| ID | Objetivo específico | Evidencia de cumplimiento |
|---|---|---|
| OE-01 | Conciliar padrón y matrícula por periodo | Reportes de carga, rechazos e idempotencia. |
| OE-02 | Gestionar credenciales y evidencias del titular | Expediente propio, metadatos y acceso privado. |
| OE-03 | Conservar decisiones de revisión y correcciones | Estados, comentarios, historial y auditoría de operaciones cubiertas. |
| OE-04 | Publicar hechos analíticos con calidad controlada | Corrida ETL, identificación de fuente y publicación transaccional. |
| OE-05 | Consultar indicadores sin duplicar personas o credenciales | Comparación con casos de cálculo conocidos y contexto de filtros. |
| OE-06 | Entregar reportes y documentación de uso | CSV, PDF, manuales y correspondencia con requisitos. |
| OE-07 | Preparar condiciones de continuidad y evaluación | Pruebas de recuperación, responsables y criterios de aceptación. |

Las metas documentadas de completitud y calidad deben medirse sobre el conjunto autorizado del piloto. Las pruebas sintéticas permiten comprobar reglas, pero no convierten esos objetivos en resultados institucionales alcanzados.

## 6. Marco Teórico

**Inteligencia de negocios en gestión académica.** La inteligencia de negocios transforma datos de operación en información para analizar una situación y orientar decisiones. En Pulse EPIS, la unidad de análisis combina estudiantes, matrícula, credenciales y habilidades dentro de un periodo y un corte. El tablero constituye la presentación de ese proceso; la confiabilidad depende de los datos y las reglas que lo alimentan.

**Población, cobertura y granularidad.** La cobertura relaciona estudiantes activos con al menos una certificación elegible y la población activa del contexto seleccionado. El número de certificaciones es una medida distinta. Cuando una credencial se relaciona con varias habilidades, los indicadores generales deben utilizar identificadores distintos para impedir duplicaciones por la granularidad del modelo.

**ETL y calidad de datos.** La extracción, transformación y carga prepara información para consulta analítica. La normalización de catálogos y los controles de validez, completitud y duplicidad permiten decidir si un lote puede publicarse. La idempotencia evita repetir efectos ante la misma fuente y contexto; una transacción evita dejar una publicación parcialmente cargada.

**Trazabilidad y reproducibilidad.** La trazabilidad relaciona origen, transformaciones y decisiones con un resultado. La reproducibilidad exige además conservar el contexto necesario para obtenerlo de nuevo. El hash de fuente y el corte identifican corridas, pero no vuelven inmutables dimensiones operacionales ni publicaciones reemplazables. Un informe histórico oficial requiere una política de versiones y conservación de metodología.

**Arquitectura modular y persistencia.** La separación entre presentación, contratos HTTP, servicios y datos permite revisar responsabilidades y cambios. PostgreSQL sostiene integridad y transacciones; el almacenamiento privado conserva los binarios de evidencia. Son recursos complementarios y ambos deben recuperarse para reconstruir expedientes completos.

**Identidad, permisos y privacidad.** OIDC permite obtener identidad del proveedor; la habilitación de la cuenta y el RBAC determinan acceso. Una identidad autenticada no dispone de todos los permisos. Las consultas agregadas y la restricción de evidencias reducen exposición, pero no sustituyen políticas de tratamiento de datos, configuración segura y supervisión.

## 7. Desarrollo de la Propuesta

El desarrollo articula padrón, registro, revisión, publicación e interpretación de resultados. Cada etapa produce información que la siguiente utiliza bajo reglas de autorización y calidad. La propuesta se implementa sobre una base tecnológica existente y conserva un alcance académico definido.

### 7.1. Análisis de Factibilidad

La factibilidad se evalúa en seis dimensiones, de acuerdo con FD01. El funcionamiento local sustenta la evaluación técnica, mientras costos, autorización y recursos de operación condicionan la decisión institucional. Ninguna dimensión se considera aprobada únicamente por disponer de una interfaz ejecutable.

#### 7.1.1. Factibilidad Técnica

El proyecto dispone de portal, API, base relacional, almacenamiento privado y proceso analítico integrado. La separación de módulos permite revisar registro, validación, evidencia y consulta de manera específica. Los contratos y las migraciones mantienen correspondencia entre servicios y esquema.

Las modificaciones locales recientes incorporan publicación administrativa, PDF y tareas estudiantiles de corrección y habilidades. Su presencia se contrasta con código y el registro local de verificación. Es necesario consolidar esa versión antes de certificar una entrega: un avance local no demuestra que la misma funcionalidad esté disponible en una instancia pública.

La capacidad de crecimiento requiere medir consultas, memoria, conexiones y almacenamiento. No se presume autoscaling, alta disponibilidad o almacenamiento de evidencias compartido. El traslado a un ambiente institucional debe conservar configuración de identidad, datos y recuperación conjunta.

#### 7.1.2. Factibilidad Económica

El presupuesto económico de FD01 asciende a **S/ 8 903,33** para desarrollo, con operación anual valorizada de **S/ 7 140,00**. El costo reconoce trabajo aportado y uso de recursos existentes, además de gastos adicionales; no se limita al efectivo desembolsado.

| Concepto de evaluación | Valor del escenario base |
|---|---:|
| Inversión económica inicial | S/ 8 903,33 |
| Beneficio anual supuesto | S/ 7 200,00 |
| Costo económico anual | S/ 7 140,00 |
| Flujo económico neto anual | S/ 60,00 |
| Horizonte y tasa de descuento | 3 años; 10% |
| VAN | S/ -8 754,12 |
| TIR | -79,68% |
| Relación beneficio/costo | 0,6716 |

El escenario no recupera la inversión mediante el ahorro monetizado supuesto. Los beneficios de gestión académica y organización documental deben evaluarse con sus responsables y no presentarse como ingresos cobrados. Los montos son estimaciones de planificación, no ejecución presupuestaria ni comprobantes de pago.

#### 7.1.3. Factibilidad Operativa

El flujo asigna al administrador la preparación de población y publicación; al estudiante, la declaración y corrección de sus credenciales; y al validador, la revisión y decisión. La separación reduce el riesgo de que una misma acción administrativa otorgue aprobación sin examen del sustento.

El registro local documenta navegación de los tres roles y tareas integradas. La operación institucional necesita responsables titulares y de respaldo, criterios de revisión, capacitación y atención de errores. Las cuentas de prueba no reemplazan provisión institucional y las pruebas de navegación no miden adopción o satisfacción de usuarios reales.

La aceptación debe comprobar una tarea completa por rol: carga conciliada, registro con evidencia, revisión, corrección cuando corresponda, publicación y lectura del resultado. El cierre exige que los usuarios comprendan los estados y el significado de las cifras.

#### 7.1.4. Factibilidad Legal

El tratamiento de datos estudiantiles debe evaluarse dentro de la Ley N.° 29733 y del [Reglamento aprobado por el D.S. N.° 016-2024-JUS](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus). La finalidad, el acceso y la conservación requieren definición institucional; la existencia de autenticación no constituye por sí sola cumplimiento integral.

La plataforma maneja población identificable, credenciales y archivos. El listado nominal administrativo debe quedar restringido a su tarea autorizada, mientras los resultados de gestión minimizan identificadores. La conservación de evidencias y copias debe acordarse con responsables, incluyendo atención de solicitudes y eliminación cuando corresponda.

Los proveedores externos, las claves y el ambiente de alojamiento deben revisarse antes de habilitar datos institucionales. El informe describe condiciones necesarias y controles técnicos; no atribuye una aprobación legal registrada al proyecto.

#### 7.1.5. Factibilidad Social

La solución puede facilitar seguimiento de logros y preparación de información para responsables académicos. El estudiante obtiene un estado explícito de su expediente; el validador conserva observaciones y decisiones; la gestión dispone de agregados con población y corte.

El uso de los resultados debe evitar interpretaciones perjudiciales. Una persona sin certificación registrada no carece necesariamente de una habilidad; puede no haber presentado evidencia o no haber completado la revisión. Las brechas internas requieren ese contexto y no deben convertirse en rankings nominales públicos.

La evaluación social requiere participación y capacitación de los usuarios. Deben revisarse barreras de acceso, claridad de instrucciones y mecanismos de corrección, sin atribuir mejoras de satisfacción que no se hayan medido.

#### 7.1.6. Factibilidad Ambiental

La centralización digital puede reducir copias e impresiones utilizadas para consolidar evidencia. La consulta y los reportes permiten reutilizar información sin trasladar repetidamente archivos físicos. Este beneficio potencial depende de que la práctica institucional sustituya efectivamente parte del procedimiento anterior.

La operación digital también consume recursos de cómputo y almacenamiento. Las evidencias, respaldos y cortes conservados deben dimensionarse con una política de retención que evite duplicación innecesaria y mantenga la información requerida para revisión.

No se dispone de una medición de papel, energía o emisiones que permita cuantificar impacto. La evaluación ambiental se presenta como oportunidad de uso eficiente de recursos y requiere seguimiento durante el piloto.

### 7.2. Tecnología de Desarrollo

La solución separa portal y API, y utiliza PostgreSQL para información operacional y hechos analíticos. Los archivos de evidencia permanecen en almacenamiento privado. La aplicación no se describe como una API serverless de Next.js: las reglas del dominio se ejecutan en FastAPI.

| Componente | Tecnología | Función en Pulse EPIS |
|---|---|---|
| Portal | Next.js 16.3.8 y React 19.2.8 | Navegación, formularios y presentación de resultados. |
| Lenguaje de interfaz | TypeScript 5 | Contratos de cliente y comprobación de tipos. |
| Estilos y visualización | Tailwind CSS 4 y Recharts 3 | Interfaz adaptable y gráficos analíticos. |
| Backend | Python, FastAPI y Pydantic | Endpoints, validación de solicitudes y servicios del dominio. |
| Persistencia | PostgreSQL 16 y SQLAlchemy | Integridad relacional, consultas y transacciones. |
| Migraciones | Alembic | Evolución versionada del esquema. |
| Identidad | Google OIDC, sesión firmada y RBAC | Identidad, habilitación y autorización. |
| Evidencias | Archivos privados, SHA-256 y tokens temporales | Integridad del archivo y acceso restringido. |
| Analítica | Servicios Python y ETL | Normalización, calidad y publicación por periodo y corte. |
| Reportes | CSV en cliente y PDF mediante servicio backend | Descarga de información analítica autorizada. |
| Despliegue | Docker Compose, Caddy y configuración alternativa de Render | Ejecución reproducible y publicación HTTPS según ambiente. |
| Colaboración y automatización | Git, GitHub y GitHub Actions | Control de versiones y tareas de integración y operación. |
| Pruebas y documentación | Pruebas backend, Playwright, Markdown y Mermaid | Verificación de flujos y documentación editable. |

La topología inicial utiliza servicios y volúmenes definidos. PostgreSQL y evidencia requieren respaldo conjunto. El crecimiento horizontal necesita revisar almacenamiento compartido, conexión a base y coordinación de publicación; no se obtiene únicamente aumentando instancias del portal.

### 7.3. Metodología de implementación

El trabajo se organiza por incrementos funcionales con revisión de contratos y pruebas. Cada incremento reúne una necesidad, su regla, la operación del usuario y el resultado esperado. La documentación académica conserva esa correspondencia: FD02 define alcance, FD03 requisitos y casos de uso, y FD04 responsabilidades y vistas.

| Etapa | Actividad principal | Entregable o comprobación |
|---|---|---|
| Análisis | Definir población, actores, fuentes y reglas. | Alcance, requisitos y criterios de calidad. |
| Diseño | Organizar contratos, estados y persistencia. | Arquitectura, modelo de datos y diagramas. |
| Construcción | Implementar padrón, credenciales, revisión y analítica. | Operaciones integradas por rol. |
| Integración | Conectar portal, API, evidencias y ETL. | Tareas completas con respuestas y errores consistentes. |
| Verificación | Ejecutar casos de control y navegación. | Resultados de prueba vinculados con el ambiente. |
| Preparación operativa | Configurar despliegue, respaldo y recuperación. | Procedimientos y condiciones de continuidad. |
| Evaluación institucional | Capacitar, medir y revisar aceptación. | Acta y decisión sobre operación con datos autorizados. |

El recorrido principal comienza con preparación de periodo y padrón. La previsualización permite revisar fuente antes de importar; la aplicación conserva resultados y rechazos y evita duplicar cargas repetidas. El estudiante declara credenciales con habilidades y fuentes de evidencia, y consulta su estado.

El validador toma revisión y decide con las reglas del expediente. Una observación permite corregir y reenviar, conservando decisiones anteriores. Después se publica un corte válido; las consultas utilizan ese conjunto para calcular cobertura, vigencia y habilidades. Una credencial recién aprobada no altera automáticamente todo reporte ya emitido.

**Resultados técnicos y evidencia disponible**

| Aspecto | Evidencia documentada | Interpretación y límite |
|---|---|---|
| Padrón local | Registro de carga de 342 filas aceptadas y ninguna rechazada, con repetición sin duplicados. | Resultado consignado en el registro local; no certifica autorización institucional ni cobertura de certificaciones. |
| Publicación local | Corte 2025-12-05 publicado y PDF descargado desde interfaz. | La carga del padrón no introduce credenciales aprobadas; los indicadores permanecen en cero sin ellas. |
| Navegación por rol | Registro de 9 rutas con 3 roles, equivalente a 27 combinaciones, sin errores de JavaScript. | Verificación local documentada; no mide experiencia de usuarios institucionales. |
| Flujo integrado | Prueba backend disponible para registro, evidencia, observación, corrección, aprobación, publicación y PDF. | El archivo de prueba define la comprobación; no se atribuye una nueva ejecución a este informe. |
| Piloto sintético previo | Población ficticia de 20 activos y cobertura de 1/20, equivalente a 5%. | Contrasta conteos distintos; no describe la población real de EPIS. |
| Continuidad | Scripts de respaldo de base y evidencias y verificación aislada. | Requiere ensayo conjunto y medición en infraestructura de operación. |

Los avances locales se documentan en el [registro del flujo académico local](../proyecto/20-Cierre-funcional-local.md). El piloto previo se conserva en el [reporte sintético](../../pilot/synthetic-report.json). Ambos corresponden a contextos distintos y sus cifras no se combinan para presentar un resultado institucional.

La preparación del cierre debe identificar versión de aplicación, fuente autorizada, ambiente y responsables. Se verificarán permisos, relaciones entre archivos y registros, y consistencia entre filtros y reportes. El sistema necesita conservar contexto metodológico para publicaciones oficiales: algunos hechos pueden reemplazarse y ciertas dimensiones siguen siendo mutables.

## 8. Cronograma

El plan base mantiene las **16 semanas** de FD01 y una dedicación estimada conjunta de **320 horas**. Las semanas representan una secuencia de preparación y evaluación del piloto; no son fechas contractuales ni una afirmación de ejecución completa. Los componentes locales existentes permiten reutilizar trabajo, pero no eliminan autorización, capacitación y medición.

| Fase | Semanas | Actividades | Entregable | Condición de cierre |
|---|---|---|---|---|
| Gobierno y acceso | 1–2 | Definir finalidad, responsables, roles y fuente. | Alcance y padrón de prueba acordados. | Responsabilidades y autorización documentadas. |
| Modelo y backend | 3–5 | Revisar esquema, contratos y acceso. | API, migraciones y permisos verificables. | Pruebas de identidad y datos consistentes. |
| Ingesta y validación | 6–8 | Conciliar población y revisar expedientes. | Importación, evidencia y decisiones integradas. | Flujo de revisión y corrección comprobado. |
| BI y reportes | 9–11 | Publicar cortes y contrastar indicadores. | Tablero, filtros, CSV y PDF. | Conteos y reportes corresponden al contexto. |
| Calidad y seguridad | 12–13 | Revisar acceso, carga y recuperación. | Evidencia de pruebas y procedimientos. | Incidencias relevantes resueltas y recuperación comprobada. |
| Piloto y decisión | 14–16 | Capacitar, medir beneficios y evaluar uso. | Informe de aceptación y decisión de operación. | Conformidad institucional y recursos acordados. |

El progreso técnico local se describe en 7.3. El cronograma de aceptación institucional debe fijarse con los responsables y actualizarse si cambian disponibilidad de fuentes, volumen o ambiente. La conclusión de una fase requiere su evidencia; no depende exclusivamente del transcurso de las semanas.

## 9. Presupuesto

El presupuesto toma los valores y supuestos de FD01 para evitar diferencias entre factibilidad e informe final. La inversión reconoce recursos consumidos y trabajo valorizado. El efectivo adicional depende de la modalidad de aportes y contratación; no se interpreta el costo económico como dinero ya pagado.

| Componente de inversión | Tipo | Monto estimado |
|---|---|---:|
| Costos generales | Conectividad, energía y uso atribuido de recursos | S/ 383,33 |
| Costos operativos durante el desarrollo | Actividades de desarrollo presupuestadas | S/ 80,00 |
| Costos del ambiente | Preparación e infraestructura del piloto | S/ 440,00 |
| Costos de personal | 320 h × S/ 25,00/h | S/ 8 000,00 |
| **INVERSIÓN ECONÓMICA TOTAL — AÑO 0** | **Valoración consolidada** | **S/ 8 903,33** |

La dedicación se estima en 160 horas por integrante, con dos integrantes durante 16 semanas a diez horas semanales. La tarifa de S/ 25,00 por hora es una valoración de planificación y no acredita salario, contrato o cotización. El presupuesto corresponde al piloto sobre la base existente; una ampliación de alcance necesita revisión de esfuerzo y costos.

| Concepto complementario | Monto | Tratamiento |
|---|---:|---|
| Desembolso adicional inicial bajo aportes académicos y recursos existentes | S/ 550,00 | Pendiente de confirmación y cotización. |
| Reserva económica propuesta del 10% | S/ 890,33 | No consumida ni incluida en el flujo base. |
| Egreso económico anual de operación | S/ 7 140,00 | Incluye infraestructura y actividades valorizadas. |
| Caja adicional anual estimada bajo modalidad de aportes | S/ 2 640,00 | No elimina el costo de trabajo aportado. |
| Beneficio económico anual supuesto | S/ 7 200,00 | Ahorro valorizado, no ingreso comercial. |

El neto económico anual del escenario base es S/ 60,00. El VAN negativo, la TIR de -79,68% y B/C de 0,6716 impiden justificar la inversión solo por ese ahorro. Antes de aprobar gasto recurrente deben medirse carga de revisión, soporte, almacenamiento y ahorro real, y evaluar la utilidad académica con la institución.

La actualización local incorpora funcionalidades que antes figuraban pendientes. Debe comprobarse si su consolidación y pruebas están comprendidas en las horas estimadas. El informe no asigna costos nuevos sin sustento ni presume que la disponibilidad de software de código abierto elimina gastos de operación.

## 10. Conclusiones

1. **Pulse EPIS integra gestión de evidencia e inteligencia de negocios.** La solución relaciona población académica, credencial, sustento, decisión y corte. Esa relación permite interpretar cobertura y habilidades, además de organizar documentos individuales.

2. **El avance local amplía el flujo funcional.** El código y el registro de verificación describen padrón, credenciales con habilidades, corrección, revisión, publicación administrativa y reportes CSV/PDF. La entrega debe consolidar esa versión y mantener correspondencia con sus pruebas y documentos.

3. **Las cifras disponibles tienen un alcance delimitado.** La carga local de 342 filas y el piloto sintético de 20 activos corresponden a conjuntos diferentes. Ninguno demuestra por sí solo cobertura institucional de certificaciones, ahorro real o aceptación de la EPIS.

4. **La trazabilidad implementada requiere fortalecerse para publicaciones históricas oficiales.** Los estados, decisiones y corridas aportan contexto; el reemplazo de cortes y las dimensiones mutables limitan la reproducción íntegra de resultados anteriores. Es necesario acordar versiones y conservación de metodología.

5. **La sostenibilidad económica permanece condicionada.** La inversión económica estimada de S/ 8 903,33 y el costo anual de S/ 7 140,00 superan la recuperación que ofrece el escenario base de ahorro a tres años. La utilidad académica debe valorarse institucionalmente junto con beneficios medidos y recursos disponibles.

6. **El cierre técnico local no equivale a cierre institucional.** La operación requiere fuentes y cuentas autorizadas, responsables de validación, infraestructura segura, prueba conjunta de recuperación y acta de aceptación. El cumplimiento de esas condiciones permitirá evaluar uso real y continuidad.

## Recomendaciones

- Consolidar la versión de aplicación que incorpora los avances locales y verificar el flujo completo con un ambiente identificado, antes de presentarla como entrega institucional.
- Conciliar el padrón con su responsable y documentar autorización, periodo, población y finalidad. La carga por sí sola no valida certificaciones.
- Designar revisores y respaldo operativo, acordar criterios de autenticidad y capacitar a usuarios en observación, corrección y estados.
- Medir tiempo de consolidación, esfuerzo de validación, adopción y utilidad de reportes para revisar los beneficios y costos previstos en FD01.
- Definir conservación de publicaciones, atributos y fórmulas para que un reporte aprobado pueda explicarse posteriormente.
- Probar recuperación conjunta de PostgreSQL y evidencias, con comprobación de asociaciones y tiempos. Separar respaldos protegidos del servidor principal.
- Actualizar FD03, FD04 y manuales cuando se consoliden cambios funcionales, manteniendo diagramas y requisitos alineados con la versión entregada.

## Anexos

Los anexos remiten a las fuentes del proyecto. La revisión y aprobación de cada entregable debe registrarse por sus responsables; la existencia de un archivo no acredita conformidad institucional.

### Anexo 01. Informe de Factibilidad

El [FD01 — Informe de Factibilidad](FD01-Informe-Factibilidad.md) desarrolla problema, riesgos, seis dimensiones de viabilidad, costos y flujo financiero. Conserva el horizonte, supuestos y sensibilidad que sustentan el presupuesto de este informe.

### Anexo 02. Documento de Visión

El [FD02 — Documento de Visión](FD02-Informe-Vision.md) define posicionamiento, interesados, características, alcance y condiciones de calidad. Permite revisar si el resultado técnico responde a las necesidades del producto.

### Anexo 03. Documento SRS

El [FD03 — Especificación de Requerimientos](FD03-Especificacion-Requerimientos.md) conserva los cuadros RF/RNF, reglas y perfiles. Incluye quince casos de uso con narrativa en tabla, diagramas individuales, objetos y secuencias Mermaid. Las ampliaciones locales posteriores requieren actualizar su estado de implementación al consolidar la entrega.

### Anexo 04. Documento SAD

El [FD04 — Arquitectura de Software](FD04-Arquitectura-Software.md) presenta objetivos y restricciones, vistas de casos de uso, lógica, implementación, procesos y despliegue. Sus diagramas y escenarios de calidad permiten revisar responsabilidades, datos, continuidad y crecimiento; deben reflejar la versión final aceptada.

### Anexo 05. Manuales y otros documentos

| Documento | Contenido |
|---|---|
| [Manual de usuario](../proyecto/10-Manual-de-usuario.md) | Tareas y navegación de usuarios autorizados. |
| [Modelo de datos](../proyecto/05-Modelo-de-datos.md) | Entidades y relaciones operacionales y analíticas. |
| [Diccionario de indicadores](../proyecto/09-Diccionario-indicadores.md) | Fórmulas y significado de los resultados. |
| [API y contratos](../proyecto/15-API-y-contratos.md) | Solicitudes, respuestas y operaciones disponibles. |
| [Despliegue y recuperación](../proyecto/16-Despliegue-y-recuperacion.md) | Topologías y procedimientos; contrastar con scripts actuales. |
| [Pruebas y aceptación](../proyecto/17-Pruebas-y-aceptacion.md) | Criterios y verificaciones del proyecto. |
| [Registro de validación](../proyecto/19-Registro-de-validacion.md) | Evidencia técnica registrada por versión. |
| [Flujo académico local](../proyecto/20-Cierre-funcional-local.md) | Avances y resultados consignados en la verificación local. |
| [Reporte del piloto sintético](../../pilot/synthetic-report.json) | Datos ficticios y contraste previo de indicadores. |
