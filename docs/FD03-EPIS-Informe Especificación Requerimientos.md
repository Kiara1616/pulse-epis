# Informe de Especificación de Requerimientos

## Pulse EPIS Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS

**Integrantes:** Kiara Holly Zapana Murillo (2023077087) y Vincenzo Rafael Lllanos Niño (2023076796)  
**Versión:** 2.0  
**Fecha:** 09/09/2026

> Las definiciones de estudiante activo, certificación válida, certificación vigente, fecha de corte y fuentes operacionales están centralizadas en [Problema, población y línea base](00-Problema-y-linea-base.md). Este SRS las convierte en requisitos y reglas verificables.

> Los objetivos, fórmulas, metas y criterios de demostración se mantienen en [Objetivos e indicadores medibles](01-Objetivos-medibles.md).

## 1 Introducción

Este documento especifica las funciones, reglas, datos y atributos de calidad necesarios para transformar el prototipo Pulse EPIS en un sistema institucional completo.

## 2 Alcance funcional

El sistema administrará el padrón autorizado, recepción y validación de evidencias, normalización de credenciales, generación de indicadores y reportes. Habrá vistas privadas de administración y vistas agregadas de consulta.

## 3 Actores

- **Administrador:** configura periodos, catálogos, roles y políticas.
- **Responsable de datos:** importa y concilia el padrón.
- **Validador:** acepta, observa o rechaza certificaciones.
- **Analista:** consulta indicadores y genera reportes.
- **Estudiante:** registra y revisa sus propias evidencias.
- **Visitante:** consulta datos agregados autorizados.

## 4 Requerimientos funcionales

| ID | Requerimiento | Prioridad | Criterio verificable |
|---|---|---|---|
| RF-01 | Autenticar y aplicar roles | Crítica | Ningún usuario accede fuera de su rol |
| RF-02 | Importar padrón por periodo desde CSV | Crítica | Informa filas válidas, rechazadas y duplicadas |
| RF-03 | Crear clave interna por estudiante | Crítica | No expone código en analítica pública |
| RF-04 | Registrar credencial y evidencia | Crítica | Exige emisor, nombre, fechas y URL o archivo |
| RF-05 | Validar evidencia y decisión | Crítica | Conserva autor, fecha, comentario y estado |
| RF-06 | Detectar duplicados | Alta | Marca coincidencia por alumno, credencial, emisor y fecha |
| RF-07 | Normalizar proveedor, nivel y habilidades | Alta | Usa catálogos versionados |
| RF-08 | Calcular KPIs por fecha de corte | Crítica | Fórmula y población son visibles |
| RF-09 | Filtrar periodo, ciclo, cohorte, proveedor, nivel y área | Alta | Todos los gráficos responden al filtro |
| RF-10 | Mostrar evolución y participación | Alta | Compara periodos |
| RF-11 | Restringir detalle nominal | Crítica | Visitantes reciben agregados |
| RF-12 | Exportar CSV y PDF | Alta | Refleja filtros y fecha de corte |
| RF-13 | Registrar auditoría | Crítica | Conserva actor, acción y fecha |
| RF-14 | Gestionar expiraciones | Alta | Distingue vigente, próxima y vencida |
| RF-15 | Importar demanda laboral con fuente | Media | Conserva URL, consulta, ubicación y fecha |
| RF-16 | Ejecutar ETL y mostrar estado | Alta | Registra inicio, fin, filas y errores |
| RF-17 | Corregir y volver a revisar | Alta | Mantiene historial anterior |
| RF-18 | Generar paquete de acreditación | Media | Incluye KPIs, metodología y referencias |

## 5 Requerimientos no funcionales

| ID | Requerimiento | Meta |
|---|---|---|
| RNF-01 | Rendimiento | p95 menor a 2 segundos en consultas habituales |
| RNF-02 | Disponibilidad | 99.5 por ciento durante reportes |
| RNF-03 | Seguridad | TLS, SSO o hash seguro, RBAC y secretos externos |
| RNF-04 | Privacidad | minimización, seudonimización y retención |
| RNF-05 | Accesibilidad | WCAG 2.2 AA en flujos principales |
| RNF-06 | Mantenibilidad | lint, tipos, pruebas y API documentada |
| RNF-07 | Recuperación | respaldo diario y restauración trimestral |
| RNF-08 | Observabilidad | logs estructurados, métricas y alertas |
| RNF-09 | Portabilidad | despliegue reproducible en contenedores |
| RNF-10 | Calidad de datos | completitud, unicidad, validez y consistencia medibles |

## 6 Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Solo el padrón activo del periodo integra el denominador |
| RN-02 | Solo una certificación validada cuenta en KPIs oficiales |
| RN-03 | Una credencial vencida sigue en histórico, no como vigente |
| RN-04 | Código y correo son restringidos y no aparecen públicamente |
| RN-05 | Posibles duplicados se excluyen hasta resolverlos |
| RN-06 | La inferencia desde correo es auxiliar y no reemplaza el ciclo oficial |
| RN-07 | Toda métrica laboral conserva consulta, fuente, lugar y fecha |
| RN-08 | Catálogos versionados permiten reproducir cierres |
| RN-09 | El estudiante solo consulta sus datos y modifica registros abiertos |
| RN-10 | Eliminación y retención siguen la política institucional |

## 7 Modelo de datos mínimo

| Entidad | Campos principales |
|---|---|
| Student | id, student_key, código cifrado, correo cifrado y estado |
| Enrollment | estudiante, periodo, ciclo, cohorte y estado académico |
| Certification | estudiante, credential_id, emisor, nombre, nivel, emisión, expiración y estado |
| Evidence | certificación, tipo, URL, object_key, hash y fecha |
| Issuer | nombre canónico, alias y sitio oficial |
| Skill | nombre y categoría |
| Validation | certificación, validador, decisión, comentario y fecha |
| MarketDemand | habilidad, fuente, consulta, ubicación, periodo y conteo |
| AuditLog | actor, acción, entidad, antes, después y fecha |
| EtlRun | fuente, inicio, fin, estado, filas y errores |

## 8 Casos de uso

### CU-01 Importar padrón

El responsable selecciona periodo y archivo. El sistema valida columnas, normaliza códigos, muestra errores y confirma la importación. Cada alumno queda asociado a una clave interna y matrícula.

### CU-02 Registrar certificación

El estudiante inicia sesión, completa datos, adjunta PDF o URL y acepta el tratamiento. El sistema valida formato, busca duplicados y crea el registro pendiente.

### CU-03 Validar certificación

El validador compara evidencia con emisor, decide aprobar, observar o rechazar y deja trazabilidad. Una aprobación actualiza la analítica.

### CU-04 Consultar dashboard

El analista selecciona filtros. El sistema presenta KPIs y gráficos coherentes y habilita detalle solo si el rol lo autoriza.

### CU-05 Exportar reporte

El analista genera un reporte con fecha de corte, filtros, fórmulas, gráficos, calidad del dato y fuentes.

## 9 Historias de usuario

### HU-01 Cobertura real

Como miembro del Comité de Calidad quiero conocer la proporción de estudiantes activos con certificación válida para sustentar un informe.

**Aceptación:** dado un periodo cerrado, al consultar cobertura se muestran numerador, denominador, fórmula y fecha reproducibles.

### HU-02 Evidencia estudiantil

Como estudiante quiero registrar una credencial para que sea evaluada.

**Aceptación:** si pertenezco al padrón y envío evidencia válida, recibo identificador y estado pendiente.

### HU-03 Privacidad

Como visitante quiero consultar resultados generales sin datos personales.

**Aceptación:** ninguna respuesta pública contiene nombre, código, correo o grupos con riesgo de reidentificación.

### HU-04 Calidad

Como responsable quiero conocer errores de carga.

**Aceptación:** una importación informa totales, filas y causas sin aplicar parcialmente un lote inválido.

## 10 Trazabilidad

| Objetivo | Requerimientos | Evidencia |
|---|---|---|
| Cobertura confiable | RF-02, RF-03, RF-08 | conciliación y prueba de fórmula |
| Credenciales verificadas | RF-04 a RF-07, RF-14 | validación y duplicados |
| Acreditación | RF-09, RF-10, RF-12, RF-18 | filtros y exportación |
| Privacidad | RF-01, RF-11, RF-13 | autorización y auditoría |
| Brecha laboral | RF-15 | procedencia y fecha |

## 11 Criterio de terminación

La versión productiva debe superar pruebas unitarias, integración, end to end, autorización, seguridad, accesibilidad, carga, respaldo y restauración. Una muestra será conciliada manualmente con padrón y evidencias por EPIS.
