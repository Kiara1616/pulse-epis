# Cierre del MVP de Pulse EPIS: siete fases

**Revisión:** 15/11/2026
**Alcance:** completar las siete fases funcionales, integrarlas en `main`, desplegarlas en Render gratuito y cerrar la aceptación de datos antes de activar infraestructura adicional.
**Criterio de costos:** no ejecutar `terraform apply`, crear servicios AWS/GCP ni habilitar facturación como parte de este cierre.

## Estado de las fases

| Fase | Resultado que debe poder demostrarse | Estado en el código | Cierre operativo pendiente |
|---|---|---|---|
| 1. Contrato de datos y padrón | Importar el Excel o CSV del periodo, detectar encabezados y previsualizar filas sin cargar hojas de resumen. | Implementado y ejecutado en Render: el 12/11/2026 se registraron dos importaciones de 309 filas aceptadas y 0 rechazadas para 2026-II. La migración `0018_roster_reconciliation_counts` añade el conteo de ausentes y la pantalla ofrece una conciliación explícita. | Conciliar por separado las 19 filas incompletas del libro; no sumarlas a matrículas ni habilitar accesos hasta verificar sus datos. |
| 2. Conciliación y acceso | Administrar personas incompletas sin crear cuentas prematuramente; actualizar ciclo por periodo y conservar historiales anteriores. | La aplicación incorpora edición, confirmación individual, exclusión con motivo y auditoría; el archivo de trabajo identifica 19 filas sin completar. La opción «Conciliar ausentes» marca como `INACTIVE` únicamente las matrículas activas que no aparecen en un padrón completo, sin borrar historia ni tocar otros periodos. | Confirmar si esas 19 filas corresponden a alumnos vigentes y verificar correo/código con la fuente institucional antes de registrarlas. Completar la prueba de acceso con una cuenta estudiantil activa. |
| 3. Certificaciones y validación | El estudiante declara su propia certificación y evidencia; el validador o administrador decide y deja trazabilidad. | Implementado en los flujos de certificaciones, evidencias y decisiones. Las cifras BI incluyen solo registros elegibles y aprobados. | Completar una demostración con cuentas institucionales permitidas y evidencia de prueba. |
| 4. Radar de cursos | Consultar fuentes autorizadas, agrupar el resultado por proveedor y permitir al admin revisar, editar, asignar ciclos y publicar. | El código agrupa los cursos por proveedor canónico y sincroniza semanalmente feeds autorizados. La migración `0017_authorized_course_feed` registra el feed JSON curado y versionado; el PR #117 mantiene el conector API oficial de DataCamp y retiro auditado de cursos archivados. El primer `SYNC` productivo se registró con 0 nuevos, 0 actualizados, 0 archivados y 14 omitidos por duplicidad con el catálogo publicado. En producción DataCamp aparece como una sola tarjeta con 5 cursos y 4 publicados; las detecciones siguen requiriendo revisión del administrador. | Revisar periódicamente los enlaces oficiales y, si un proveedor autoriza una API/feed propio, registrarlo como fuente separada. La API de DataCamp continúa siendo opcional y requiere una clave organizacional; no se raspa HTML sin autorización. |
| 5. Oportunidades y talleres | Publicar oportunidades para ciclos seleccionados, recibir solicitudes y gestionar cupos desde backend. | Implementado: oferta y taller tienen estados separados; el backend aplica audiencia y cupos; el estudiante ve las tarjetas con el estilo azul de Pulse. | Ejecutar el recorrido Admin → estudiante → solicitud → decisión con registros de demostración. |
| 6. ETL, almacén y BI | Publicar hechos por periodo y fecha de corte, validar calidad y mostrar seis reportes con filtros temporales. | Implementado: hechos Gold, publicación idempotente, ETL diario en workflow y seis reportes con filtros de año, mes y día. La página de publicación coteja la última importación con el último ETL, detecta cortes anteriores o conteos distintos y no modifica matrículas. El resumen combina el histórico agregado UPT/GPAD (`2023-I`–`2026-II`) con el snapshot vigente de Pulse; el ETL productivo #43237986208 (`APPLIED`, `2026-II`, corte `2026-11-11`) publicó 310 matrículas activas y cero filas de certificación. Los seis reportes fueron abiertos en producción y aceptan agrupamientos Año/Mes/Día. | Ejecutar la conciliación explícita sobre el padrón autorizado y volver a publicar el corte. La cobertura de certificaciones solo puede cambiar después de registrar evidencia real y obtener una decisión de validación. |
| 7. Arquitectura, costos y revisión de entrega | Explicar Bronze/Silver/Gold, el diagrama de proceso e infraestructura, Terraform y costos; cerrar con revisión reproducible. | Arquitectura, diagramas, Terraform y estimación de costos están versionados. El PR #128 integró la conciliación explícita del padrón y el PR #130 corrigió la agrupación del Radar; CI pasó y Render está en el merge `d9f8ff5` con la migración `0018_roster_reconcile` aplicada. | Mantener GCP/AWS sin desplegar hasta aprobar alcance y presupuesto. La prueba conectada de los tres roles, la conciliación del padrón y el alta de una evidencia institucional real siguen siendo aceptación operativa pendiente. |

## Estado productivo comprobado

- Los PR #114–#119 se integraron en `main`; frontend, backend, documentación y contenedor pasaron CI.
- Render sirve `https://pulse-epis-rirr.onrender.com/`; el despliegue del commit `d9f8ff5` está `live`, la migración `0018_roster_reconcile` terminó y `/ready` respondió HTTP 200.
- La API publicada expone las rutas nuevas de padrón/conciliación y sincronización programada del Radar. El proceso de arranque ejecuta `alembic upgrade head` antes de levantar la API.
- El feed curado del Radar queda registrado por migración, sincronizado en producción y preparado para el workflow semanal; cada resultado conserva proveedor, URL y resumen de sincronización. Las filas detectadas siguen requiriendo revisión antes de publicarse.
- El PR #117 integra el ciclo de sincronización del catálogo DataCamp (vigentes y archivados); el conector requiere una clave organizacional autorizada y no implica scraping HTML.
- Render registró el 12/11/2026 dos importaciones de padrón `APPLIED`, con `total_rows=309`, `accepted_rows=309` y `rejected_rows=0` para 2026-II. La conexión directa de lectura a PostgreSQL desde esta sesión está bloqueada por la lista de IP vacía; no se modificó.
- El workflow diario ETL #43237986208 terminó `APPLIED` para 2026-II, corte 2026-11-11; su artefacto agrega 310 matrículas activas y cero filas de certificación. El registro de importación muestra 309 aceptadas, así que hay una diferencia de un registro aún por conciliar.
- La conexión directa de lectura a PostgreSQL desde esta sesión está bloqueada por la lista de IP vacía de Render. No se modificó esa configuración.
- No se aprovisionaron recursos AWS ni GCP ni se habilitó facturación.
- El gráfico de matrícula fue verificado en producción: muestra `2023-I`–`2026-I` con totales agregados UPT/GPAD y `2026-II` como snapshot vigente de Pulse, resaltado en azul oscuro. No se crean estudiantes a partir de los totales históricos.
- Los seis reportes (`panorama`, `evolucion`, `certificaciones`, `habilidades`, `cohortes`, `calidad`) cargaron sin error en producción; el selector de agrupación respondió para Año y Día, además del valor Mes por defecto.

## Flujo que se presenta

```mermaid
flowchart TD
    A[Excel institucional autorizado] --> B[Previsualización XLSX/CSV]
    B --> C{Fila completa y válida}
    C -->|Sí| D[Bronze: lote, hash y rechazos]
    D --> Q{¿Padrón completo?}
    Q -->|No| H[Silver: estudiantes y matrículas del lote]
    Q -->|Sí, opción Conciliar ausentes| R[Marcar ausentes como INACTIVE en ese periodo y auditar conteo]
    R --> H
    C -->|No| E[Bandeja de conciliación]
    E --> F[Admin verifica correo, código, ciclo y estado]
    F -->|Confirma| D
    F -->|Excluye con motivo| G[Pendiente histórico, sin cuenta]
    H --> I[ETL por periodo y fecha de corte]
    I --> J[Gold: hechos y snapshots]
    J --> K[Seis reportes BI]
    L[Feeds públicos JSON/RSS autorizados, consulta semanal] --> M[Radar: curso detectado]
    M --> N[Revisión, segmentación por ciclo y publicación del admin]
    N --> O[Catálogo del estudiante]
```

## Cómo se conserva la historia

- Una nueva importación añade o actualiza la matrícula de **ese periodo**; no borra matrículas anteriores. El ciclo puede cambiar cuando la escuela lo confirme en el siguiente padrón.
- La opción **Conciliar ausentes** es deliberada: compara el padrón completo contra las matrículas `ACTIVE` del periodo, marca las que faltan como `INACTIVE`, registra cuántas afectó y conserva las matrículas históricas. No se ejecuta por defecto ni se aplica al resolver un pendiente individual.
- Una persona solo accede como alumno cuando su correo `@virtual.upt.pe` está vinculado a un alumno activo importado. Una coincidencia de nombre nunca concede acceso.
- Las decisiones de conciliación son trazables por actor, fecha y campos cambiados. La auditoría guarda los nombres de campos y el estado, no otra copia del nombre/correo.
- Una corrección del proveedor en un curso detectado mantiene el mismo registro y deja el cambio en auditoría. Al pasar a revisión o publicarse, la sincronización externa no reemplaza la versión curada por el administrador.
- Los candidatos externos de cursos no se convierten en certificaciones. El estudiante declara su credencial y el validador decide si la evidencia es válida.

## Condición para declarar el MVP listo

El cierre funcional local se acepta cuando las pruebas backend y frontend pasan, la migración nueva puede aplicarse en una base limpia y el recorrido de los tres roles funciona en un entorno conectado. El cierre **institucional** requiere además importar el padrón completo autorizado, conciliar los pendientes, publicar un corte ETL y comparar las seis salidas con ese corte. El cierre **cloud de Data Lake** es una etapa distinta: requiere aprobación de costos y un `apply` explícito.

El padrón de 309 filas completas está aplicado en Render con 0 rechazos; las 19 filas incompletas siguen pendientes. El ETL posterior publicó 310 matrículas activas, una más que el conteo aceptado del padrón, y no registró certificaciones. La migración `0018_roster_reconcile` y la opción **Conciliar ausentes** ya están desplegadas para cerrar esa diferencia sin borrar historia; aún falta ejecutar esa carga explícita y revisar el resultado. Después deben revisarse los seis reportes y probar el recorrido de los tres roles. El feed autorizado del Radar está versionado, activo y sincronizado en producción. AWS/GCP no se desplegaron ni se habilitó facturación; esa etapa requiere revisar presupuesto y aprobar `apply` por separado.
