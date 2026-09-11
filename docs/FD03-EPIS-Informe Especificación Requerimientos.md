# Informe de Especificación de Requerimientos

## Pulse EPIS Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS

**Integrantes:** Kiara Holly Zapana Murillo (2023077087) y Vincenzo Rafael Lllanos Niño (2023076796)<br>
**Versión:** 2.1<br>
**Fecha:** 11/09/2026

**Issue:** [#4 — Completar FD02: actores, capacidades y visión](https://github.com/Kiara1616/pulse-epis/issues/4)

> Las definiciones de estudiante activo, certificación válida, certificación vigente, fecha de corte y fuentes operacionales están centralizadas en [Problema, población y línea base](00-Problema-y-linea-base.md). Este SRS las convierte en requisitos y reglas verificables.

> Los objetivos, fórmulas, metas y criterios de demostración se mantienen en [Objetivos e indicadores medibles](01-Objetivos-medibles.md).

## 1 Introducción

Este documento especifica las funciones, reglas, datos y atributos de calidad necesarios para transformar el prototipo Pulse EPIS en un sistema institucional completo.

## 2 Alcance funcional

El sistema administrará el padrón autorizado, recepción y validación de evidencias, normalización de credenciales, generación de indicadores y reportes. Habrá vistas privadas de administración y vistas agregadas de consulta.

## 3 Actores de negocio

Los actores de negocio describen quién participa o tiene interés en el proceso. No son, por sí mismos, roles técnicos de autorización.

| Actor de negocio | Objetivo | Operación principal |
|---|---|---|
| Administrador | Mantener la configuración del producto | Periodos, catálogos, políticas y usuarios autorizados |
| Responsable de datos | Mantener confiable el universo EPIS | Importar, conciliar y corregir el padrón |
| Validador | Asegurar que una credencial sea válida | Aprobar, observar o rechazar evidencias |
| Analista | Interpretar resultados | Consultar indicadores y generar reportes |
| Estudiante | Declarar sus logros | Registrar y revisar sus propias evidencias |
| Visitante | Conocer resultados generales | Consultar datos agregados autorizados |

Dirección EPIS y Comité de Calidad son interesados y consumidores de reportes. No se modelan como roles técnicos adicionales del MVP.

### 3.1 Roles técnicos y permisos

El MVP implementará únicamente estos tres roles técnicos de autorización:

| Rol técnico | Permisos base | Restricciones |
|---|---|---|
| `ADMIN` | Periodos, catálogos, configuración, padrón y auditoría según permisos | No valida evidencias ni publica datos nominales por defecto |
| `VALIDATOR` | Consulta de evidencia necesaria y decisión de validación | No administra usuarios, periodos, catálogos ni padrón |
| `STUDENT` | Registro y consulta de sus propias certificaciones | No consulta ni modifica datos de otros estudiantes |

El permiso `PADRON_MANAGE` se asignará a cuentas `ADMIN` que actúen como responsables de datos. El alcance `ANALYTICS_READ` permitirá a un analista consumir indicadores y reportes de solo lectura sin concederle administración ni validación; no se creará un cuarto rol técnico para el MVP. Un visitante solo utilizará vistas o endpoints públicos agregados.

| Actor de negocio | Autorización MVP | Regla verificable |
|---|---|---|
| Administrador | `ADMIN` | Solo opera capacidades asignadas |
| Responsable de datos | `ADMIN` + `PADRON_MANAGE` | Importa y concilia, pero no valida por defecto |
| Validador | `VALIDATOR` | Decide evidencias y no administra el sistema |
| Analista | `ANALYTICS_READ` | Solo lectura de indicadores y reportes permitidos |
| Estudiante | `STUDENT` | Solo sus propios datos |
| Visitante | Público agregado | Nunca recibe datos nominales |

La selección de rol no estará disponible en el frontend. El backend verificará cada permiso, aplicará denegación por defecto y registrará la identidad, rol técnico, alcance y acción en `AuditLog`.

## 4 Requerimientos funcionales

| ID | Requerimiento | Prioridad | Criterio verificable |
|---|---|---|---|
| RF-01 | Autenticar y aplicar roles y permisos | Crítica | Solo existen `ADMIN`, `VALIDATOR` y `STUDENT`; los alcances `PADRON_MANAGE` y `ANALYTICS_READ` se verifican en backend |
| RF-02 | Importar padrón por periodo desde CSV | Crítica | Una cuenta `ADMIN` con `PADRON_MANAGE` obtiene filas válidas, rechazadas y duplicadas |
| RF-03 | Crear clave interna por estudiante | Crítica | No expone código en analítica pública |
| RF-04 | Registrar credencial y evidencia | Crítica | Exige emisor, nombre, fechas y URL o archivo |
| RF-05 | Validar evidencia y decisión | Crítica | Solo `VALIDATOR` conserva autor, fecha, comentario y estado |
| RF-06 | Detectar duplicados | Alta | Marca coincidencia por alumno, credencial, emisor y fecha |
| RF-07 | Normalizar proveedor, nivel y habilidades | Alta | Usa catálogos versionados |
| RF-08 | Calcular KPIs por fecha de corte | Crítica | Fórmula y población son visibles para `ANALYTICS_READ` y permisos superiores |
| RF-09 | Filtrar periodo, ciclo, cohorte, proveedor, nivel y área | Alta | Todos los gráficos autorizados responden al filtro |
| RF-10 | Mostrar evolución y participación | Alta | Compara periodos |
| RF-11 | Restringir detalle nominal | Crítica | Visitantes reciben agregados |
| RF-12 | Exportar CSV y PDF | Alta | Refleja filtros y fecha de corte |
| RF-13 | Registrar auditoría | Crítica | Conserva principal, rol, alcance, acción y fecha |
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
| RN-11 | No se realiza scraping de LinkedIn ni búsqueda de identidades desde perfiles públicos; las fuentes laborales son agregadas y trazables |

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
| AuditLog | principal, rol técnico, alcance, acción, entidad, antes, después y fecha |
| EtlRun | fuente, inicio, fin, estado, filas y errores |

## 8 Casos de uso

### CU-01 Importar padrón

El responsable de datos, mediante una cuenta `ADMIN` con permiso `PADRON_MANAGE`, selecciona periodo y archivo. El sistema valida columnas, normaliza códigos, muestra errores y confirma la importación. Cada alumno queda asociado a una clave interna y matrícula.

### CU-02 Registrar certificación

El estudiante inicia sesión, completa datos, adjunta PDF o URL y acepta el tratamiento. El sistema valida formato, busca duplicados y crea el registro pendiente.

### CU-03 Validar certificación

El validador compara evidencia con emisor, decide aprobar, observar o rechazar y deja trazabilidad. Una aprobación actualiza la analítica.

### CU-04 Consultar dashboard

El analista con alcance `ANALYTICS_READ` selecciona filtros. El sistema presenta KPIs y gráficos coherentes y habilita detalle solo si el permiso explícito lo autoriza.

### CU-05 Exportar reporte

El analista con alcance `ANALYTICS_READ` genera un reporte con fecha de corte, filtros, fórmulas, gráficos, calidad del dato y fuentes. El sistema oculta campos nominales salvo autorización adicional.

## 9 Historias de usuario

### HU-01 Cobertura real

Como consumidor autorizado del Comité de Calidad quiero conocer la proporción de estudiantes activos con certificación válida para sustentar un informe.

**Aceptación:** dado un periodo cerrado, al consultar cobertura se muestran numerador, denominador, fórmula y fecha reproducibles.

### HU-02 Evidencia estudiantil

Como estudiante quiero registrar una credencial para que sea evaluada.

**Aceptación:** si pertenezco al padrón y envío evidencia válida, recibo identificador y estado pendiente.

### HU-03 Privacidad

Como visitante quiero consultar resultados generales sin datos personales.

**Aceptación:** ninguna respuesta pública contiene nombre, código, correo o grupos con riesgo de reidentificación.

### HU-04 Calidad

Como responsable de datos con permiso `PADRON_MANAGE` quiero conocer errores de carga.

**Aceptación:** una importación informa totales, filas y causas sin aplicar parcialmente un lote inválido.

## 10 Trazabilidad

| Objetivo | Requerimientos | Evidencia |
|---|---|---|
| Cobertura confiable | RF-02, RF-03, RF-08 | conciliación y prueba de fórmula |
| Credenciales verificadas | RF-04 a RF-07, RF-14 | validación y duplicados |
| Acreditación | RF-09, RF-10, RF-12, RF-18 | filtros y exportación |
| Privacidad | RF-01, RF-11, RF-13 | matriz de roles, autorización y auditoría |
| Brecha laboral | RF-15 | procedencia y fecha |

## 11 Criterio de terminación

La versión productiva debe superar pruebas unitarias, integración, end to end, autorización horizontal y vertical, seguridad, accesibilidad, carga, respaldo y restauración. Las pruebas de autorización deben demostrar que `STUDENT` solo ve sus datos, `VALIDATOR` no administra, `ADMIN` respeta sus permisos, `ANALYTICS_READ` no modifica datos y el visitante solo recibe agregados. Una muestra será conciliada manualmente con padrón y evidencias por EPIS.
