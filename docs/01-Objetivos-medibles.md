# Pulse EPIS: objetivos e indicadores medibles

**Versión:** 1.0  
**Fecha:** 11/09/2026  
**Issue:** [#2 — Definir objetivos de investigación y solución medibles](https://github.com/Kiara1616/pulse-epis/issues/2)

Este documento desarrolla los objetivos de Pulse EPIS a partir de la población y las definiciones establecidas en [Problema, población y línea base](00-Problema-y-linea-base.md). Las metas son metas del piloto; no convierten los datos sintéticos del prototipo en cifras institucionales.

## 1. Objetivo general de investigación

**Determinar, al cierre de cada periodo académico, la cobertura y vigencia de las certificaciones tecnológicas de los estudiantes activos de la EPIS mediante un padrón autorizado, evidencias aprobadas y reglas reproducibles de calidad.**

La investigación debe producir una medición comparable por periodo, cohorte, ciclo, proveedor, nivel y área tecnológica, indicando población, fuente, fecha de corte y limitaciones.

## 2. Objetivo general de solución BI

**Implementar un sistema de inteligencia de negocios que concilie el padrón EPIS, gestione la validación de certificaciones y publique indicadores trazables para la Dirección, el Comité de Calidad, los validadores y los estudiantes según sus permisos.**

## 3. Objetivos específicos medibles

| ID | Tipo | Objetivo medible | Indicador y fórmula | Meta del piloto | Fuente | Plazo | Evidencia en la demostración |
|---|---|---|---|---:|---|---|---|
| OBJ-01 | Investigación | Medir la población activa de la EPIS con un padrón conciliado por periodo. | `conciliación (%) = filas aceptadas y vinculadas de forma única / filas recibidas no vacías × 100` | ≥ 95% | Padrón oficial, reporte de staging y errores | Antes del cierre del piloto | Reporte con filas recibidas, aceptadas, rechazadas, duplicadas y causas |
| OBJ-02 | Solución | Contabilizar solo credenciales sustentadas y aprobadas. | `cobertura de evidencia (%) = certificaciones aprobadas con evidencia / certificaciones incluidas en KPIs × 100` | 100% | Certificación, evidencia y decisión del validador | En cada fecha de corte | Cada registro contado muestra fuente, estado y fecha de validación |
| OBJ-03 | Investigación | Estimar la cobertura real de estudiantes activos con al menos una certificación válida. | `cobertura (%) = estudiantes activos con ≥1 certificación válida / estudiantes activos del padrón × 100` | KPI calculado en cada periodo | Padrón, certificaciones y validaciones | En cada cierre de periodo | Se muestran numerador, denominador, fórmula, filtros y corte |
| OBJ-04 | Solución | Distinguir credenciales válidas, vigentes, próximas a vencer, observadas, rechazadas y duplicadas. | `vigentes = certificaciones válidas con expiración nula o expiración ≥ corte`; `próximas = expiración entre corte y corte + 30 días` | 100% de estados aplicados | Certificación, expiración, validación y duplicidad | Antes de publicar KPIs | Tabla de estados y prueba con casos sintéticos |
| OBJ-05 | Solución | Mantener la calidad del padrón y de las credenciales cargadas. | `tasa de duplicados (%) = duplicados detectados / filas recibidas × 100`; `completitud (%) = campos obligatorios completos / campos obligatorios esperados × 100` | Duplicados < 1%; completitud ≥ 95% | Lotes ETL, reglas de calidad y catálogo | En cada corrida ETL | Resumen de calidad con totales y causas de rechazo |
| OBJ-06 | Investigación | Comparar la evolución de certificaciones entre periodos sin mezclar cortes ni poblaciones. | `crecimiento (%) = (valor del periodo actual − valor del periodo anterior) / valor del periodo anterior × 100` | 100% de series con periodo y corte | Hechos analíticos y cierres de periodo | En cada cierre | Gráfico con periodos, filtros y fecha de corte visibles |
| OBJ-07 | Solución | Identificar brechas de habilidades usando unidades comparables y fuentes documentadas. | `brecha = demanda normalizada − oferta certificada normalizada`, ambas en escala 0–100 por habilidad y periodo | 100% de puntos con fuente, ubicación y fecha | Demanda laboral documentada y certificaciones válidas | Para la versión piloto si existe fuente laboral | Radar o tabla con método de normalización y procedencia |

## 4. Diccionario mínimo de KPIs

| KPI | Numerador | Denominador | Filtros mínimos | Fecha de corte |
|---|---|---|---|---|
| `activeStudents` | Estudiantes únicos con matrícula activa | No aplica | Periodo académico, cohorte, ciclo | Estado académico al corte |
| `certifiedStudents` | Estudiantes únicos activos con al menos una certificación válida | No aplica | Periodo, cohorte y ciclo; proveedor, nivel y área restringen el numerador | Validación y emisión hasta el corte |
| `coveragePercent` | `certifiedStudents` | `activeStudents` | Periodo, cohorte y ciclo en ambos; proveedor, nivel y área solo en el numerador | Corte del padrón y certificaciones |
| `validCertifications` | Certificaciones aprobadas, no duplicadas y emitidas hasta el corte | No aplica | Periodo, proveedor, nivel y área | Estado aprobado al corte |
| `expiringSoon` | Certificaciones válidas que expiran entre el corte y 30 días después | No aplica | Proveedor, nivel y área | Corte + ventana de 30 días |
| `reconciliationPercent` | Filas del padrón aceptadas y vinculadas de forma única | Filas recibidas no vacías | Periodo y lote | Fecha de carga/cierre |
| `evidenceCoveragePercent` | Credenciales aprobadas con evidencia suficiente | Credenciales incluidas en los KPIs | Periodo, proveedor, nivel y área | Fecha de validación |
| `duplicateRate` | Filas marcadas como duplicadas | Filas recibidas no vacías | Lote y periodo | Fecha de carga |

Los filtros comunes son periodo académico, fecha de corte, cohorte, ciclo, proveedor, nivel y área tecnológica. Las vistas públicas no podrán filtrar ni devolver datos que permitan identificar a una persona o a un grupo de tamaño riesgoso.

Cuando se filtre por proveedor, nivel o área, el denominador de cobertura seguirá siendo la población activa del periodo, cohorte y ciclo seleccionados. De este modo, la pregunta continúa siendo qué proporción de la población posee una credencial que cumple el filtro, y no qué proporción de las certificaciones pertenece al proveedor.

## 5. Reglas de interpretación

1. Una certificación pendiente, observada, rechazada o duplicada no entra en los KPIs oficiales.
2. Una certificación válida vencida permanece en histórico, pero no cuenta como vigente.
3. El porcentaje de cobertura no debe calcularse usando como denominador la cantidad de certificaciones.
4. La variación porcentual no se publica si el periodo anterior es cero o no es comparable; se muestra `N/D` con una explicación.
5. La brecha laboral no puede comparar conteos brutos de puestos y estudiantes sin normalización documentada.
6. Cada exportación debe conservar periodo, filtros, corte, fórmula, fuentes y calidad del dato.
7. Las metas se revisarán después del primer cierre real; cambiar una meta debe conservar su versión y justificación.

## 6. Comprobación del objetivo en la demostración

La demostración debe poder mostrar, con datos sintéticos identificados como tales:

- una importación con filas válidas, rechazadas y duplicadas;
- una certificación aprobada con evidencia y otra que no entre en el KPI;
- un cálculo de cobertura con numerador, denominador y fecha de corte;
- filtros por periodo, cohorte, proveedor y nivel;
- estados de vigencia y expiración próxima;
- un reporte cuya fecha de corte y reglas sean visibles.

La línea base operacional solo se cerrará cuando EPIS entregue el padrón autorizado y el responsable institucional apruebe el periodo y la fecha de corte.
