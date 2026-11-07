# Obtención de datos y trazabilidad para Pulse EPIS

**Estado al 07/11/2026:** este documento distingue las fuentes que ya alimentan Pulse EPIS de las integraciones propuestas. Los indicadores académicos nacen de datos institucionales y decisiones verificadas; los catálogos externos sirven para recomendar cursos, no para afirmar que un estudiante obtuvo una certificación.

## Fuentes y responsables

| Dato | Cómo ingresa | Responsable | Frecuencia | Comprobación y destino | Estado |
|---|---|---|---|---|---|
| Padrón EPIS, periodo, ciclo, código, correo y estado | El administrador prepara un CSV desde el Excel institucional, previsualiza e importa por periodo en `/admin/estudiantes` | Administración EPIS | Cada actualización oficial del padrón | Formato, duplicados, correo institucional y periodo; tablas de estudiantes y matrículas | Implementado; nombre completo está en la PR #99 y el padrón de producción debe importarse en Render |
| Certificación y evidencia | El estudiante autenticado declara la credencial y adjunta archivo o URL | Estudiante | Al obtener una credencial | Fechas, emisor, duplicados y vínculo con su propia cuenta; tablas operativas de certificaciones y evidencias | Implementado |
| Decisión de validación | El validador o administrador revisa evidencia y registra aprobación, observación o rechazo | Validador/administrador | Por solicitud | Historial con actor y fecha; solo aprobaciones elegibles entran al KPI | Implementado |
| Oferta de cursos y talleres | El administrador registra y publica opciones | Administración EPIS | Al cambiar la oferta | Catálogo con estado, proveedor, URL y fecha de revisión | Registro manual implementado |
| Cursos externos de Cisco, DataCamp u otros | Feed/API oficial o lectura acotada de páginas públicas que la fuente permita; hallazgos pasan a revisión antes de publicarse | Administración EPIS | Semanal o según proveedor | URL canónica, título, proveedor, fecha, hash y estado `DETECTED`; no se crean certificaciones estudiantiles desde esta fuente | Descubrimiento automatizado en la PR #99; no desplegado en Render |
| Lista pública de alumnos EPIS | Consulta auxiliar a la página pública de la escuela, si está disponible para el periodo vigente | Administración EPIS | Por periodo | Comparar nombre y ciclo contra padrón institucional; nunca asignar código o correo por coincidencia de nombre | Propuesta; no importada automáticamente |

El **Excel no se convierte directamente en un dashboard**: primero se exporta a la plantilla de padrón, se previsualiza, se resuelven errores y se importa. El correo identifica la cuenta institucional; el código se conserva como dato del padrón. Una persona fuera del padrón activo no debe aparecer como estudiante autenticado ni incrementar la población activa.

### Nombres públicos y correos institucionales

La [página pública de alumnos de Ingeniería de Sistemas](https://eped.upt.edu.pe/upt/web/modulos/alumno.php?depe=314048000) muestra nombres y ciclos, pero la versión recuperable durante esta revisión estaba marcada **2025-I** y no exponía código ni correo. El [reporte oficial de matriculados 2026-II](https://portal.upt.edu.pe/site/web/contenido/oficina-de-gestion-de-procesos-academicos-y-docencia-gpad/reportes-de-estudiantes-pregrado) publica un total por carrera, no la correspondencia persona–correo. Por tanto, ninguna de esas páginas basta para crear cuentas del periodo actual ni asignar correos.

Como referencia de cobertura, el PDF oficial de **2026-II** informa **324 matriculados en Ingeniería de Sistemas**, con fuente OPLA al **28/09/2026**. Esa cifra sirve para contrastar el número de alumnos importados, pero no prueba que los 324 tengan correo confirmado, hayan ingresado en Pulse o posean certificaciones. El tablero debe mostrar por separado: población oficial reportada, padrón importado, cuentas con acceso y certificaciones aprobadas. Una diferencia entre esos números es una brecha de datos que se investiga, no se rellena automáticamente.

El flujo objetivo sería: **(1)** el administrador prepara el CSV institucional con periodo, código, nombre, correo, ciclo y estado; **(2)** antes de cargarlo, un conversor comprueba que el código explícito corresponda a los dígitos confirmados del correo; **(3)** una lectura opcional de la lista pública genera un informe de diferencias de nombre/ciclo para revisión; **(4)** el administrador resuelve diferencias y confirma la importación. El importador actualmente exige una columna `code`; no la deduce del correo. La columna `full_name` está en la PR #99, todavía sin publicar. Nunca se combinan dos personas por similitud de nombres: pueden existir homónimos o cambios ortográficos. El dato público no sustituye al padrón que determina quién puede entrar.

## Del dato operacional al reporte

```mermaid
flowchart LR
    A[Admin: padrón CSV] --> O[(PostgreSQL operacional)]
    E[Estudiante: declaración y evidencia] --> O
    V[Validador/Admin: decisión] --> O
    O --> T[ETL por periodo y corte]
    T --> Q{Calidad y duplicados}
    Q -->|válido| F[(Hechos analíticos)]
    Q -->|inválido| R[Rechazos y último corte conservado]
    F --> API[API de indicadores]
    API --> D[Seis reportes BI]
    X[Catálogos externos] --> C[Revisión y publicación de cursos]
    C --> O
```

El ETL lee la base operacional: estudiantes matriculados, certificaciones, emisores, habilidades y decisiones. Genera un **snapshot** identificado por periodo, fecha de corte y hash de fuente. Repetir la misma entrada debe devolver la misma corrida; un error no reemplaza el último corte válido. Los seis reportes deben leer hechos publicados del corte seleccionado y mostrar si la fuente es demostrativa o institucional. Véanse [reglas ETL](14-ETL-y-calidad.md) y [diccionario de indicadores](09-Diccionario-indicadores.md).

## Obtención externa: qué aporta y qué no

La captura externa recupera **metadatos de oportunidades**: nombre del curso, proveedor, URL, modalidad, precio público si existe y fecha de revisión. Puede alimentar el radar de cursos y las recomendaciones del administrador. No permite deducir identidad, matrícula, finalización, nota ni certificación aprobada de un estudiante. Esos hechos requieren declaración y evidencia del estudiante más validación humana o una integración institucional verificable.

Orden de integración: API/feed del proveedor; importación de catálogo proporcionado por convenio; lectura de HTML público cuando corresponda; carga manual del administrador como alternativa. Los hallazgos externos quedan en revisión y el administrador decide qué publicar. Una página que cambie, falle o retire un curso no debe borrar silenciosamente el historial académico.

## Evidencia sin gasto de nube

La [prueba BigQuery Sandbox](../../infra/bigquery/README.md) contiene **solo hechos sintéticos** y demuestra una consulta de Data Warehouse en GCP sin facturación. No está conectada a la base de Render. La arquitectura completa con Cloud SQL, Cloud Storage y Cloud Run permanece definida en la PR #99, pendiente de integración y de un proyecto con facturación; no debe describirse como desplegada.

## Datos que aún faltan para un corte institucional

1. Padrón oficial importado en la base de Render para el periodo correspondiente, con correo, código, nombre, ciclo y estado conciliados.
2. Declaraciones de certificaciones y evidencias de los estudiantes, más decisiones de validación.
3. Una corrida ETL aplicada y un responsable que apruebe publicar el corte como institucional.

Hasta entonces, los ejemplos y la prueba BigQuery se etiquetan como demostrativos.
