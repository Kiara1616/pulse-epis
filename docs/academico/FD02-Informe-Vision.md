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

# Documento de Visión

<p align="center">Código FD02<br>Versión <em>3.4</em></p>

**CONTROL DE VERSIONES**

| Versión | Hecha por | Revisada por | Aprobada por | Fecha | Motivo |
|---|---|---|---|---|---|
| 2.x | KHZM / VRLN | — | — | Septiembre 2026 | Elaboración inicial |
| 3.0 | VRLN | — | — | 01/10/2026 | Elaboración de los informes académicos |
| 3.1 | KHZM / VRLN | — | — | 02/10/2026 | Organización del documento |
| 3.3 | KHZM / VRLN | — | — | 06/10/2026 | Actualización de la presentación |
| 3.4 | — | — | — | 08/10/2026 | Revisión de visión, perfiles, capacidades y prioridades |

**ÍNDICE GENERAL**

- [1. Introducción](#1-introducción)
  - [1.1. Propósito](#11-propósito)
  - [1.2. Alcance](#12-alcance)
  - [1.3. Definiciones, Siglas y Abreviaturas](#13-definiciones-siglas-y-abreviaturas)
  - [1.4. Referencias](#14-referencias)
  - [1.5. Visión General](#15-visión-general)
- [2. Posicionamiento](#2-posicionamiento)
  - [2.1. Oportunidad de negocio](#21-oportunidad-de-negocio)
  - [2.2. Definición del problema](#22-definición-del-problema)
- [3. Descripción de los interesados y usuarios](#3-descripción-de-los-interesados-y-usuarios)
  - [3.1. Resumen de los interesados](#31-resumen-de-los-interesados)
  - [3.2. Resumen de los usuarios](#32-resumen-de-los-usuarios)
  - [3.3. Entorno de usuario](#33-entorno-de-usuario)
  - [3.4. Perfiles de los interesados](#34-perfiles-de-los-interesados)
    - [3.4.1. Dirección EPIS y Comité de Calidad](#341-dirección-epis-y-comité-de-calidad)
    - [3.4.2. Responsable del padrón académico](#342-responsable-del-padrón-académico)
    - [3.4.3. Equipo desarrollador](#343-equipo-desarrollador)
    - [3.4.4. Administrador del sistema](#344-administrador-del-sistema)
    - [3.4.5. Validador de certificaciones](#345-validador-de-certificaciones)
    - [3.4.6. Estudiante](#346-estudiante)
  - [3.5. Necesidades de los interesados y usuarios](#35-necesidades-de-los-interesados-y-usuarios)
- [4. Vista General del Producto](#4-vista-general-del-producto)
  - [4.1. Perspectiva del producto](#41-perspectiva-del-producto)
  - [4.2. Resumen de capacidades](#42-resumen-de-capacidades)
  - [4.3. Suposiciones y dependencias](#43-suposiciones-y-dependencias)
  - [4.4. Costos y precios](#44-costos-y-precios)
  - [4.5. Licenciamiento e instalación](#45-licenciamiento-e-instalación)
- [5. Características del producto](#5-características-del-producto)
- [6. Restricciones](#6-restricciones)
- [7. Rangos de calidad](#7-rangos-de-calidad)
- [8. Precedencia y Prioridad](#8-precedencia-y-prioridad)
- [9. Otros requerimientos del producto](#9-otros-requerimientos-del-producto)
  - [9.1. Estándares aplicables](#91-estándares-aplicables)
  - [9.2. Estándares legales](#92-estándares-legales)
  - [9.3. Estándares de comunicación](#93-estándares-de-comunicación)
  - [9.4. Estándares de cumplimiento de la plataforma](#94-estándares-de-cumplimiento-de-la-plataforma)
  - [9.5. Estándares de calidad y seguridad](#95-estándares-de-calidad-y-seguridad)
- [10. Conclusiones](#10-conclusiones)
- [11. Recomendaciones](#11-recomendaciones)
- [12. Bibliografía](#12-bibliografía)
- [13. Webgrafía](#13-webgrafía)

## 1. Introducción

### 1.1. Propósito

Este documento define la visión de Pulse EPIS, plataforma institucional de inteligencia de negocios para analizar certificaciones tecnológicas verificadas de estudiantes de la EPIS de la Universidad Privada de Tacna. Orienta el producto hacia información útil para acreditación, planificación de capacitación y mejora curricular.

El registro de certificados es la fuente operativa; su finalidad es producir indicadores de cobertura, vigencia y distribución de habilidades certificadas. El documento se dirige a la Dirección, Comité de Calidad, responsables del padrón, validadores, estudiantes, equipo desarrollador y docente del curso de Inteligencia de Negocios.

### 1.2. Alcance

La primera implementación atiende a la EPIS y comprende autenticación, importación de padrón, declaración de certificaciones, evidencia privada, revisión humana, ETL e indicadores. Cada actor interviene conforme a su responsabilidad y permiso.

| **Módulo** | **Alcance** |
|---|---|
| Identidad y acceso | Autenticación y permisos por rol |
| Padrón | Población autorizada por periodo, cohorte y ciclo |
| Certificaciones | Registro de credencial, emisor y fechas |
| Evidencia y revisión | Documentos privados, decisiones y observaciones |
| Integración analítica | Calidad de datos y publicación por corte |
| Dashboard y reportes | Cobertura, vigencia, distribución, filtros y CSV |
| Trazabilidad | Historial de decisiones y corridas |

No incluye emisión de certificados, reemplazo de matrícula, cobros ni evaluación automática del rendimiento. PDF operativo, demanda laboral, vista pública y varias escuelas son ampliaciones pendientes de requisitos y aceptación.

### 1.3. Definiciones, Siglas y Abreviaturas

| **Término / sigla** | **Definición** |
|---|---|
| EPIS / UPT | Escuela Profesional de Ingeniería de Sistemas / Universidad Privada de Tacna |
| BI | Integración y análisis de información para decisiones |
| Padrón | Fuente autorizada de población y matrícula |
| Evidencia | Archivo, URL o metadatos que sustentan una credencial |
| KPI | Indicador con fórmula, población y fecha definidos |
| ETL | Extracción, transformación y carga |
| Snapshot | Hechos publicados por periodo y corte |
| OIDC | OpenID Connect para autenticación |
| RBAC | Autorización mediante roles y permisos |
| API REST | Interfaz HTTP entre portal y servicios |
| CSV | Formato tabular de intercambio |
| RPO / RTO | Objetivos de pérdida máxima de datos y recuperación |

### 1.4. Referencias

| **N.°** | **Documento** | **Versión / identificación** | **Uso** |
|---|---|---|---|
| 01 | [FD01 — Factibilidad](FD01-Informe-Factibilidad.md) | 3.5; 08/10/2026 | Presupuesto y viabilidad |
| 02 | [FD03 — Requerimientos](FD03-Especificacion-Requerimientos.md) | Documento del proyecto | Reglas y aceptación |
| 03 | [FD04 — Arquitectura](FD04-Arquitectura-Software.md) | Documento del proyecto | Componentes y decisiones |
| 04 | [Problema y línea base](../proyecto/00-Problema-y-linea-base.md) | Fuente del proyecto | Población y fuentes |
| 05 | [Diccionario de indicadores](../proyecto/09-Diccionario-indicadores.md) | Fuente del proyecto | Definiciones de cálculo |

### 1.5. Visión General

Las nueve secciones principales presentan contexto, posicionamiento, interesados, producto, características, restricciones, calidad, prioridades y estándares. La visión relaciona preguntas de gestión con capacidades verificables. Conclusiones y recomendaciones orientan el piloto; bibliografía y webgrafía identifican las fuentes utilizadas.

## 2. Posicionamiento

### 2.1. Oportunidad de negocio

La oportunidad es institucional: consolidar credenciales procedentes de emisores y formatos distintos para orientar formación y preparar evidencias académicas. Para ello se necesita población autorizada, revisión de titularidad y distinción entre aprobación y vigencia.

Pulse EPIS responde qué proporción de estudiantes tiene certificación vigente, cómo se distribuye por emisor y habilidad y qué credenciales vencerán próximamente. Estas preguntas orientan talleres y acompañamiento. La falta de certificación registrada no demuestra falta de competencia.

Los expedientes requieren privacidad, mientras los agregados aportan valor a la Escuela. La demanda laboral es una ampliación que necesita fuentes y normalización; la brecha interna existente no representa necesidades del mercado ni garantiza empleabilidad.

### 2.2. Definición del problema

| **El problema** | **Afecta a** | **Cuyo impacto es** | **Una solución exitosa sería** |
|---|---|---|---|
| Registros heterogéneos | Estudiantes y validadores | Titularidad y duplicidad difíciles de conciliar | Expedientes revisados y vinculados al padrón |
| Reportes con poblaciones distintas | Dirección y Calidad | Cobertura no comparable | Denominador oficial y corte explícito |
| Preparación repetida de reportes | Responsables académicos | Búsqueda y reproceso | Consultas y exportación consistentes |
| Conteos sin interpretación | Responsables de formación | Juicios incorrectos sobre competencias | Metodología y límites visibles |

El piloto debe confirmar volumen y tiempos institucionales. Los datos sintéticos permiten verificar funcionamiento, pero no prueban la magnitud real del problema ni los beneficios económicos.

## 3. Descripción de los interesados y usuarios

### 3.1. Resumen de los interesados

| **Nombre** | **Descripción** | **Responsabilidad** |
|---|---|---|
| Dirección y Comité de Calidad | Consumidores de información | Definir preguntas y evaluar resultados |
| Responsable del padrón | Custodio de matrícula | Autorizar y conciliar la población |
| Validadores | Revisores de credenciales | Decidir con evidencia y justificación |
| Estudiantes | Titulares de los registros | Declarar información y atender observaciones |
| Soporte institucional | Responsable de continuidad por designar | Respaldos, operación e incidentes |
| Equipo desarrollador | Kiara Zapana y Vincenzo Lllanos | Desarrollo, pruebas y transferencia |

### 3.2. Resumen de los usuarios

| **Nombre** | **Descripción** | **Interesado representativo** |
|---|---|---|
| ADMIN | Padrón y funciones administrativas habilitadas | Responsable de operación y datos |
| VALIDATOR | Revisión y analítica autorizada | Personal designado |
| STUDENT | Registro y consulta de expediente propio | Estudiantes del padrón |
| Consumidor de reportes | Decisiones con resultados autorizados | Dirección y Comité; perfil independiente pendiente |
| Visitante | Consulta futura de agregados | Comunidad académica; vista pública pendiente |

Existen tres roles técnicos. ADMIN y VALIDATOR disponen de lectura analítica; no hay perfil independiente de analista. Los cargos institucionales no deben convertirse automáticamente en permisos administrativos. Los reportes autorizados pueden atender a la Dirección mientras se define una vista de lectura específica.

### 3.3. Entorno de usuario

El acceso utiliza navegador e internet desde PC, laptop, tablet o smartphone. No requiere instalar herramientas de desarrollo. Google OIDC autentica y el directorio interno habilita cuentas; un dominio permitido no sustituye la vinculación institucional.

La carga aumenta durante campañas y cierres. La revisión depende del personal designado, mientras la consulta puede realizarse fuera de ese horario si el servicio está disponible. No hay modo offline. Compatibilidad y facilidad de carga deben comprobarse con los dispositivos del piloto.

### 3.4. Perfiles de los interesados

#### 3.4.1. Dirección EPIS y Comité de Calidad

| **Campo** | **Detalle** |
|---|---|
| Representante | Autoridades y responsables designados |
| Descripción | Orientan uso académico de indicadores |
| Tipo | Interesado institucional |
| Responsabilidades | Definir necesidades y aprobar condiciones del piloto |
| Criterio de éxito | Reportes verificables que apoyen decisiones |
| Grado de participación | Alto en definición y aceptación |

#### 3.4.2. Responsable del padrón académico

| **Campo** | **Detalle** |
|---|---|
| Representante | Unidad autorizada para matrícula |
| Descripción | Define población de referencia |
| Tipo | Responsable de fuente |
| Responsabilidades | Conciliar población, periodo y corte |
| Criterio de éxito | Al menos 95% de conciliación con rechazos identificados |
| Grado de participación | Alto en carga y cierre |

#### 3.4.3. Equipo desarrollador

| **Campo** | **Detalle** |
|---|---|
| Representante | Kiara Holly Zapana Murillo y Vincenzo Rafael Lllanos Niño |
| Descripción | Desarrollo e integración del sistema |
| Tipo | Equipo técnico |
| Responsabilidades | Integrar portal, API y ETL; probar y documentar |
| Criterio de éxito | Flujo central verificable y transferencia documentada |
| Grado de participación | Alto durante las 16 semanas planificadas |

#### 3.4.4. Administrador del sistema

| **Campo** | **Detalle** |
|---|---|
| Representante | Operador con rol ADMIN |
| Descripción | Coordina padrón y configuración |
| Tipo | Usuario operativo |
| Responsabilidades | Importar y conciliar; usar funciones habilitadas |
| Criterio de éxito | Población consistente y cargas trazables |
| Implicaciones | No valida por defecto; administración general aún tiene brechas |

#### 3.4.5. Validador de certificaciones

| **Campo** | **Detalle** |
|---|---|
| Representante | Personal con rol VALIDATOR |
| Descripción | Revisa titularidad, emisor y evidencia |
| Tipo | Usuario de revisión |
| Responsabilidades | Aprobar, observar o rechazar con motivo |
| Criterio de éxito | Credenciales del KPI con decisión y evidencia |
| Implicaciones | Sin administración de padrón ni cuentas |

#### 3.4.6. Estudiante

| **Campo** | **Detalle** |
|---|---|
| Representante | Estudiante vinculado al padrón |
| Descripción | Declara sus logros |
| Tipo | Usuario de registro |
| Responsabilidades | Información precisa y atención de observaciones |
| Criterio de éxito | Registro y estado comprensibles |
| Implicaciones | Solo datos propios; corrección y captura de habilidades en UI por completar |

El visitante se limita a una futura consulta agregada autorizada y no accede a expedientes privados.

### 3.5. Necesidades de los interesados y usuarios

| **Necesidad** | **Prioridad** | **Preocupaciones** | **Solución actual / situación por levantar** | **Solución propuesta** |
|---|---|---|---|---|
| Población confiable | Crítica | Denominador incompleto | Fuentes por conciliar | Padrón por periodo |
| Credenciales verificadas | Crítica | Duplicidad y titularidad | Evidencias heterogéneas | Decisión e historial |
| Cobertura por segmentos | Alta | Conteos sin contexto | Consolidación por evaluar | Filtros y corte |
| Registro propio | Alta | Falta de seguimiento | Canales por identificar | Portal y observaciones |
| Reportes de calidad | Alta | Reproducibilidad | Tiempos por medir | ETL y exportación |
| Comparación laboral | Posterior | Sesgo de fuentes | Sin integración | Método documentado |
| Varias escuelas | Posterior | Acceso cruzado | Solo EPIS | Aislamiento por unidad |

## 4. Vista General del Producto

### 4.1. Perspectiva del producto

Pulse EPIS complementa la gestión académica. Padrón, credenciales y decisiones forman la base operativa; el ETL produce hechos y el dashboard presenta indicadores. El portal usa Next.js y React, la API FastAPI y la persistencia PostgreSQL, con evidencia privada separada.

La trazabilidad relaciona estudiante, credencial, evidencia, decisión y corrida. La publicación actual puede reemplazar hechos del mismo periodo y corte cuando cambia la fuente. Conservar todas las versiones de un reporte requiere reforzar versionado; registrar corridas no garantiza un archivo inmutable de resultados.

La extensión a otras escuelas exige identificar unidades y aislar datos y permisos. El campo de escuela en matrícula no demuestra esa capacidad. El crecimiento técnico se comprobará con carga y almacenamiento adecuados; contenedores y frameworks no prueban escalabilidad por sí solos.

### 4.2. Resumen de capacidades

| **Beneficio** | **Características que lo soportan** | **Situación** |
|---|---|---|
| Población consistente | Importación y conciliación | Implementada; padrón institucional pendiente |
| Evidencia revisable | Registro privado y decisiones | Implementados; operación por aceptar |
| Cobertura institucional | Activos, certificados y porcentaje | Disponible desde ETL |
| Seguimiento de vigencia | Aprobadas y vencimiento próximo en 90 días | Disponible al corte |
| Segmentación | Periodo, corte, cohorte, ciclo, emisor y nivel | Filtros implementados |
| Evolución | Cortes publicados | Solo dentro del mismo periodo |
| Reportes | CSV de consulta | Disponible; PDF operativo pendiente |
| Cobertura por habilidad | Distribución y brecha interna | No representa demanda externa |
| Lectura diferenciada | Perfil analítico y vista pública | Pendientes |

La cobertura cuenta alumnos activos distintos con al menos una credencial aprobada vigente, divididos entre activos del padrón. Varias credenciales no multiplican al estudiante. El filtro por emisor o nivel restringe el numerador y mantiene la población activa seleccionada por periodo, cohorte y ciclo.

### 4.3. Suposiciones y dependencias

Se requieren fuente autorizada, periodo, corte, cuentas habilitadas y responsables de revisión. La institución definirá tratamiento, conservación y correcciones. Participación y capacidad de validación se comprobarán en el piloto.

OIDC exige credenciales del proveedor; el ambiente necesita secretos externos, migraciones y persistencia. El ETL se ejecuta mediante procedimiento técnico, sin botón general de publicación. Integraciones externas dependen de permisos del emisor; la disponibilidad del código no acredita un despliegue institucional activo.

### 4.4. Costos y precios

| **Componente** | **Monto estimado (S/)** |
|---|---:|
| Costos generales | 383,33 |
| Costos operativos del desarrollo | 80,00 |
| Costos del ambiente | 440,00 |
| Trabajo del equipo valorizado | 8 000,00 |
| **Inversión económica inicial** | **8 903,33** |
| **Desembolso adicional inicial con aportes académicos** | **550,00** |
| Aplicación, PostgreSQL y almacenamiento primario anual | 2 400,00 |
| Copias separadas anuales | 240,00 |
| Validación, mantenimiento y administración valorizados por año | 4 500,00 |
| **Costo económico anual** | **7 140,00** |
| **Desembolso adicional anual con personal aportado** | **2 640,00** |

Son estimaciones del FD01 pendientes de sustento, no tarifas de venta. Los desembolsos están incluidos en el costo económico y no se suman nuevamente. La reserva se presenta por separado en FD01. No se prevén cobros a estudiantes.

El escenario no recupera inversión por ahorro monetizado en tres años. La continuidad requiere medir beneficio y evaluar utilidad académica; el tiempo liberado no es ingreso efectivo.

### 4.5. Licenciamiento e instalación

El repositorio no declara archivo LICENSE. Uso institucional, mantenimiento y derechos sobre el código deben acordarse, respetando licencias de dependencias y contenidos. No se presume cesión de derechos ni contrato de soporte.

Compose instala portal, API y PostgreSQL con volúmenes para base y archivos. La publicación requiere HTTPS, OIDC y secretos del ambiente. La configuración Render de demo conserva archivos temporales; para archivo institucional se necesita persistencia y recuperación conjunta probadas.

## 5. Características del producto

| **ID** | **Característica** | **Descripción** |
|---|---|---|
| CAR-01 | Autenticación y permisos | Sesión y autorización de servidor |
| CAR-02 | Padrón | CSV, conciliación y población por periodo |
| CAR-03 | Certificaciones | Credencial, emisor y fechas |
| CAR-04 | Evidencias | Archivos o URL privados y metadatos |
| CAR-05 | Validación | Decisión, responsable, motivo e historial |
| CAR-06 | ETL | Calidad y publicación transaccional |
| CAR-07 | Dashboard | Indicadores y filtros |
| CAR-08 | Análisis interno | Cobertura por habilidad y evolución de cortes |
| CAR-09 | Reportes | CSV; PDF institucional pendiente |
| CAR-10 | Trazabilidad | Historial y corridas; versiones de reportes por reforzar |
| CAR-11 | Lectura diferenciada | Perfil analítico y vista pública pendientes |
| CAR-12 | Extensión | Demanda externa y aislamiento multiescuela futuros |

La aceptación se verifica contra el SRS. Un permiso no implica pantalla completa; corrección, habilidades y administración deben cerrar brechas de interfaz antes de exigir operación autónoma.

## 6. Restricciones

| **ID** | **Restricción** | **Descripción** |
|---|---|---|
| RES-01 | Conectividad | Internet y navegador; sin modo offline |
| RES-02 | Autoridad de datos | Padrón autorizado, sin scraping de identidades |
| RES-03 | Privacidad | Expedientes y evidencia restringidos |
| RES-04 | Alcance | Una escuela; sin emisión de certificados ni reemplazo de matrícula |
| RES-05 | Planificación | Piloto de 16 semanas condicionado a responsables |
| RES-06 | Dependencias | Proveedores requieren configuración y permisos |
| RES-07 | Métricas | Datos sintéticos no son resultados institucionales |
| RES-08 | Interpretación | Falta de credencial no prueba falta de habilidad |
| RES-09 | Continuidad | Base y evidencia deben recuperarse conjuntamente |
| RES-10 | Escalamiento | Varias escuelas requieren aislamiento y pruebas |

## 7. Rangos de calidad

| **Atributo** | **Métrica** | **Rango objetivo** |
|---|---|---|
| Rendimiento | Percentil 95 de consultas principales | Menor a 2 s con carga acordada |
| Disponibilidad | Tiempo disponible en ventana mensual | Al menos 99,5%, sujeto a medición |
| Calidad | Conciliación de filas del padrón | Al menos 95%, con rechazos identificados |
| Trazabilidad | Credenciales del KPI con evidencia y decisión | 100% |
| Seguridad | Acceso sin permiso o a expediente ajeno | Denegación en todos los casos probados |
| Recuperación | Pérdida y tiempo máximo | RPO 24 h y RTO 4 h como metas |
| Usabilidad | Tareas críticas por usuarios capacitados | Registro y revisión completados |
| Accesibilidad | Teclado, etiquetas y contraste | WCAG 2.1 AA como objetivo inicial |
| Escalabilidad | Latencia y errores con mayor carga | Mantener rendimiento con volumen documentado |

Son metas, no certificaciones alcanzadas. La prueba debe fijar población, certificados, archivos y concurrencia. No se anuncia capacidad arbitraria ni disponibilidad garantizada en demo gratuita.

## 8. Precedencia y Prioridad

| **Prioridad** | **ID** | **Característica** | **Justificación** |
|---|---|---|---|
| 1 — Crítica | CAR-01, CAR-02 | Identidad y padrón | Acceso y denominador confiables |
| 1 — Crítica | CAR-03, CAR-04, CAR-05 | Registro y revisión | Sustento de admisión |
| 1 — Crítica | CAR-06 | ETL y calidad | Evitar cifras inconsistentes |
| 2 — Alta | CAR-07, CAR-08 | Análisis | Información para gestión |
| 2 — Alta | CAR-09, CAR-10 | CSV y trazabilidad | Reportes explicables |
| 3 — Media | CAR-09, CAR-11 | PDF y perfil analítico | Ampliación de uso institucional |
| 4 — Posterior | CAR-11, CAR-12 | Vista pública, demanda y escuelas | Requieren método y recursos adicionales |

La secuencia prioriza acceso y padrón, registro y revisión, calidad y publicación, indicadores y reportes. Privacidad y recuperación son requisitos de aceptación, no complementos opcionales. El cierre institucional necesita datos autorizados y responsables, además de demostración sintética.

## 9. Otros requerimientos del producto

### 9.1. Estándares aplicables

| **Estándar / criterio** | **Aplicación / especificación** |
|---|---|
| OpenID Connect Core 1.0 | Autenticación externa, permisos internos |
| OpenAPI | Contratos de solicitudes y respuestas |
| WCAG 2.1 AA | Meta inicial de accesibilidad |
| 1EdTech Open Badges | Referencia de interoperabilidad futura |
| Diccionario de KPI | Población, corte y fórmulas documentados |

### 9.2. Estándares legales

| **Estándar / criterio** | **Aplicación / especificación** |
|---|---|
| Ley N.° 29733 | Protección de datos personales |
| D.S. N.° 016-2024-JUS | Reglamento del tratamiento |
| Políticas UPT | Finalidad, retención y derechos |
| Condiciones de emisores | Uso de evidencia y consulta autorizada |

La institución definirá base habilitante, aviso de privacidad y rectificación y eliminación. Seudonimizar no elimina el carácter personal de los expedientes; controles técnicos no equivalen a certificación legal.

### 9.3. Estándares de comunicación

| **Estándar / criterio** | **Aplicación / especificación** |
|---|---|
| HTTPS / TLS | Protección de tráfico externo |
| HTTP y JSON | Portal y API |
| UTF-8 | Textos y datos tabulares |
| CSV | Esquema de importación y exportación |
| OIDC | Flujo de identidad |

Errores y exportaciones deben informar contexto sin revelar secretos ni datos ajenos. Notificaciones requieren un servicio implementado; SMTP no se considera operativo por defecto.

### 9.4. Estándares de cumplimiento de la plataforma

| **Componente** | **Aplicación / especificación** |
|---|---|
| Frontend | Next.js 16.3.8, React 19.2.8 y TypeScript |
| Entorno frontend | Node.js 20+, según compatibilidad de lock y contenedor |
| Backend | Python 3.12+, FastAPI y Uvicorn |
| Datos | PostgreSQL 16 y migraciones Alembic |
| Analítica | ETL por periodo y corte |
| Despliegue | Contenedores y persistencia |
| Cliente | Navegador actualizado probado en piloto |

Versiones resueltas deben conservarse en artefactos; actualizaciones requieren comprobación de acceso, migraciones y compatibilidad, junto con manuales actualizados.

### 9.5. Estándares de calidad y seguridad

| **Estándar / criterio** | **Aplicación / especificación** |
|---|---|
| Sesión | Firma, expiración y cookie segura en producción |
| Credenciales locales | Argon2id limitado a desarrollo/pruebas |
| Permisos | ADMIN no valida por defecto; STUDENT solo accede a datos propios |
| Evidencia | Rutas privadas, claves aleatorias, hash y acceso temporal |
| Entrada | Validación de servidor |
| Auditoría | Actor, entidad, acción y fecha; consulta completa pendiente |
| Respaldo | Copias y ensayo conjunto de base y evidencia |
| Secretos | Configuración externa y ambientes separados |
| Prevención de abuso | Rate limiting general y controles de carga por verificar |

El hash comprueba contenido, no autenticidad del emisor. La retención necesita política y procedimiento de eliminación; purga automática permanece pendiente.

## 10. Conclusiones

Pulse EPIS articula registro verificado y análisis institucional. Los expedientes aportan evidencia; los indicadores apoyan cobertura, vigencia y formación. La utilidad depende de población confiable y revisión, no de cantidad de gráficos.

El flujo central permite un piloto, pero la aceptación exige datos, roles, persistencia y recuperación. La evolución actual compara cortes de un periodo; la brecha interna no es demanda laboral. La expansión necesita aislamiento por escuela y publicaciones versionadas.

El escenario económico del FD01 no recupera inversión en tres años. La decisión debe apoyarse en mediciones y utilidad académica, sin afirmar rentabilidad garantizada.

## 11. Recomendaciones

1. Confirmar padrón, periodo, corte y responsables antes de cifras oficiales.
2. Completar corrección y revisión con usuarios y comprobar permisos.
3. Contrastar indicadores manualmente y medir ahorro y carga operativa.
4. Probar recuperación y conservar contexto de exportaciones.
5. Reforzar versionado de reportes históricos.
6. Incorporar PDF, perfil analítico y fuentes externas según prioridad.
7. Evaluar otras escuelas tras definir aislamiento y capacidad.

## 12. Bibliografía

- Equipo Pulse EPIS. (2026). *FD01 — Informe de Factibilidad*. Versión 3.5. UPT.
- Equipo Pulse EPIS. (2026). *FD03 — Especificación de Requerimientos* y *FD04 — Arquitectura de Software*.
- Equipo Pulse EPIS. (2026). *Problema y línea base* y *Diccionario de indicadores*.
- Congreso de la República del Perú. (2011). *Ley N.° 29733*.
- Ministerio de Justicia y Derechos Humanos. (2024). *D.S. N.° 016-2024-JUS*.
- OpenID Foundation. (2023). *OpenID Connect Core 1.0 incorporating errata set 2*.
- W3C. (2018). *Web Content Accessibility Guidelines 2.1*.

## 13. Webgrafía

- [Repositorio Pulse EPIS](https://github.com/Kiara1616/pulse-epis).
- [Ley N.° 29733](https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470-29733).
- [Reglamento de protección de datos](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus).
- [OpenID Connect](https://openid.net/specs/openid-connect-core-1_0.html).
- [W3C — WCAG 2.1](https://www.w3.org/TR/WCAG21/).
- [Open Badges](https://www.1edtech.org/standards/open-badges).
- [Next.js](https://nextjs.org/docs), [FastAPI](https://fastapi.tiangolo.com/) y [PostgreSQL 16](https://www.postgresql.org/docs/16/).
