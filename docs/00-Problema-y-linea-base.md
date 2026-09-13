# Pulse EPIS: problema, población y línea base

**Versión:** 1.0  
**Fecha:** 11/09/2026  
**Issue:** [#1 — Formular título, problema y línea base del proyecto](https://github.com/Kiara1616/pulse-epis/issues/1)

## 1. Título del proyecto

**Pulse EPIS: Dashboard de certificaciones tecnológicas verificadas de los estudiantes de la Escuela Profesional de Ingeniería de Sistemas de la Universidad Privada de Tacna para acreditación y mejora curricular.**

El título delimita el producto: Pulse EPIS no descubre identidades desde perfiles públicos ni reemplaza al sistema académico. Consolida un padrón EPIS autorizado con certificaciones declaradas y verificadas para producir indicadores reproducibles.

## 2. Problema de investigación y de solución

La EPIS no dispone actualmente de una fuente única, trazable y reproducible que permita determinar cuántos estudiantes activos poseen certificaciones tecnológicas válidas, qué proveedores y áreas de competencia representan, qué credenciales siguen vigentes y cómo cambia el indicador entre periodos académicos.

La información se encuentra distribuida entre registros académicos, formularios, hojas de cálculo, archivos de evidencia y plataformas de credenciales. La falta de una identidad institucional conciliada, reglas comunes de validación, control de duplicados y fecha de corte puede producir conteos incompletos o duplicados. Como consecuencia, la Dirección y el Comité de Calidad deben consolidar información manualmente y no pueden reproducir con facilidad los indicadores usados en acreditación o mejora curricular.

### 2.1 Causas principales

1. Las fuentes de estudiantes y certificaciones se administran por separado.
2. No existe un identificador analítico interno vinculado al padrón oficial por periodo.
3. Las evidencias no siempre conservan fuente, emisor, fechas, estado y responsable de validación.
4. No hay un catálogo único para proveedores, niveles, habilidades y estados.
5. Las cifras no siempre declaran población, periodo, fecha de corte y regla de cálculo.

### 2.2 Consecuencias

1. Reportes manuales con resultados difíciles de auditar.
2. Riesgo de contar dos veces una credencial o incluir una credencial no validada.
3. Imposibilidad de distinguir certificaciones históricas, vigentes, pendientes y rechazadas.
4. Menor capacidad para sustentar metas de acreditación y decisiones curriculares.
5. Riesgo de exponer datos personales si se mezclan detalles nominales con vistas agregadas.

## 3. Población, unidad de análisis y periodo

### 3.1 Población objetivo

La población objetivo está formada por estudiantes matriculados en la EPIS durante un periodo académico determinado. La población oficial no se obtiene de un portal público ni de una búsqueda por correo: procede del padrón entregado por EPIS o Secretaría Académica, con el periodo y la fecha de corte correspondientes.

### 3.2 Definiciones operativas

| Concepto | Definición para Pulse EPIS |
|---|---|
| Estudiante EPIS activo | Persona que aparece en el padrón oficial de la EPIS para el periodo consultado, con estado académico activo o matriculado al momento de la fecha de corte. Un estudiante retirado, egresado o no matriculado no integra el denominador corriente, aunque puede conservarse en el histórico. |
| `student_key` | Identificador interno estable generado a partir del padrón. No contiene el código universitario ni el correo y es el identificador usado en el modelo analítico. |
| Certificación registrada | Declaración de una credencial asociada a un estudiante del padrón, con emisor, nombre, fecha de emisión y una URL, archivo o identificador de evidencia. Su estado inicial es `PENDIENTE`. |
| Certificación válida | Certificación cuya titularidad fue conciliada con el padrón, cuya evidencia identifica al emisor y la credencial, cuya fecha de emisión no es posterior al corte, y cuya revisión terminó en `APROBADA`. Los duplicados, rechazados y observados no cuentan en los KPIs oficiales. |
| Certificación vigente | Certificación válida cuya fecha de expiración es nula o igual o posterior a la fecha de corte. Una certificación válida vencida permanece en el histórico, pero no cuenta como vigente. |
| Fecha de corte | Fecha y hora que fijan la fotografía reproducible de matrícula, validación, emisión y vigencia. Toda métrica publicada debe conservarla. |

### 3.3 Unidad de análisis

- **Estudiante-periodo:** unidad para calcular el denominador y la cobertura.
- **Certificación:** unidad para analizar proveedor, nivel, área, emisión, expiración y estado.
- **Evidencia-validación:** unidad para conservar procedencia, decisión, responsable y fecha de revisión.

El mismo estudiante puede tener varias certificaciones y una certificación puede aparecer en el histórico de varios cortes, pero no debe duplicarse dentro del mismo corte.

## 4. Línea base

### 4.1 Estado actual

La línea base operacional todavía no está disponible: el repositorio no contiene un padrón EPIS autorizado ni certificaciones reales validadas. Los archivos frontend `mock-data.json` y `etl_data.json` siguen siendo datos sintéticos o de demostración y no deben usarse para reportes oficiales; el ETL backend ya no depende de un archivo `output_data.json`.

El prototipo contiene una línea base técnica mínima para comprobar la interfaz:

| Elemento | Valor del prototipo | Tratamiento |
|---|---:|---|
| Certificaciones del KPI visual | 342 | Sintético; no oficial |
| Registros transformados por el ETL demostrativo | 3 | Sintético; sirve para probar el pipeline |
| Periodo más reciente disponible en los datos visuales | 2026-II | Referencia de demo; debe ser confirmado por EPIS |
| Última actualización del snapshot ETL | 2026-09-03 | Fecha técnica del archivo, no fecha oficial de corte |
| Padrón oficial conciliado | No disponible | Bloquea el cálculo institucional de cobertura |
| Certificaciones aprobadas con evidencia real | No disponible | No deben alimentar indicadores oficiales |

### 4.2 Línea base que debe levantarse en el piloto

Cuando EPIS entregue el padrón y se cierre el primer periodo piloto, el responsable de datos debe registrar como mínimo:

1. Número de estudiantes activos del padrón.
2. Número de estudiantes con al menos una certificación válida.
3. Número de certificaciones registradas, aprobadas, observadas, rechazadas y duplicadas.
4. Número de certificaciones vigentes y próximas a vencer.
5. Completitud, unicidad y porcentaje de registros conciliados.
6. Distribución por proveedor, nivel, área tecnológica, cohorte y ciclo.
7. Fecha de corte, fuente, reglas aplicadas y responsable del cierre.

La cobertura se calculará así:

```text
Cobertura (%) = estudiantes activos con al menos una certificación válida
                / estudiantes activos del padrón × 100
```

El periodo piloto propuesto es `2026-II`, sujeto a confirmación de EPIS. La fecha `2026-09-03` solo identifica el snapshot sintético que acompaña al prototipo; no sustituye la fecha de corte que deberá aprobar el responsable institucional.

## 5. Fuentes y autoridad de los datos

### 5.1 Fuentes operacionales

Son las fuentes que pueden modificar o respaldar los registros usados en los indicadores:

| Fuente | Uso | Autoridad |
|---|---|---|
| Padrón oficial EPIS/Secretaría Académica | Universo, estado, periodo y conciliación | Fuente de verdad para el denominador |
| Formulario o portal institucional | Registro de certificación y consentimiento | Fuente de declaración del estudiante |
| URL, Open Badge, archivo o identificador del emisor | Evidencia de la credencial | Fuente de verificación, no de identidad institucional |
| Decisión del validador y registro de auditoría | Aprobación, observación, rechazo y fecha | Fuente de estado oficial |
| Ejecución ETL y lote de importación | Filas, errores, duplicados y fecha de carga | Fuente de trazabilidad técnica |

### 5.2 Fuentes contextuales

Ayudan a interpretar o contrastar el resultado, pero no reemplazan el padrón ni convierten una declaración en una certificación aprobada:

| Fuente | Uso | Limitación |
|---|---|---|
| Portal y publicaciones agregadas de UPT/EPIS | Contexto institucional y contraste de totales | No identifica estudiantes ni reemplaza el padrón |
| Ley peruana de protección de datos personales | Restricciones de tratamiento y publicación | No es una fuente de métricas |
| Estándares 1EdTech Open Badges | Criterios técnicos para credenciales verificables | No prueba por sí solo la matrícula EPIS |
| Demanda laboral documentada | Comparación de brechas por habilidad | Debe conservar fuente, consulta, ubicación y fecha |
| JSON del repositorio | Demostración de interfaz y contratos | No tiene validez académica ni operacional |

## 6. Referencias verificables

1. [Universidad Privada de Tacna — portal institucional](https://www.upt.edu.pe/).
2. [Portal EPIS — acreditación y proyectos](https://epis.upt.edu.pe/acreditacion/index.php/inicio/concursoproyectos).
3. [Congreso de la República — Ley N.° 29733, Ley de Protección de Datos Personales](https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470-29733).
4. [1EdTech — Open Badges](https://www.1edtech.org/standards/open-badges).
5. [Credly — Web Service API](https://api.credly.com/docs/web_service_api).

Las fuentes institucionales y operacionales deberán registrarse con URL, fecha de consulta, responsable y alcance. Si una fuente pública no está disponible temporalmente, se conservará la referencia y se indicará la limitación; no se reemplazará con una cifra inventada.

## 7. Coherencia con los documentos del proyecto

- **FD01:** esta definición fija la factibilidad condicionada a un padrón autorizado, evidencia verificable y responsables de validación.
- **FD02:** esta población y estas métricas concretan la visión, los actores y el éxito del piloto.
- **FD03:** las definiciones se convierten en reglas, campos, estados y criterios verificables.
- **FD04:** el padrón, el corte, `student_key`, la evidencia y la auditoría delimitan las fronteras de datos y las interfaces futuras.

Este documento es la referencia base para los objetivos de la issue #2 y para los informes FD01–FD04. Toda cifra demostrativa debe permanecer identificada como sintética hasta que exista un cierre institucional.
