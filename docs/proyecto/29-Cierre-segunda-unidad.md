# Cierre de requisitos de la segunda unidad

**Fecha de revisión:** 12/11/2026
**Plataforma elegida:** Google Cloud Platform
**Regla de cierre:** una configuración local no equivale a un recurso desplegado. Los estados distinguen implementación, validación local y evidencia cloud.

El proyecto separado [BigQuery Sandbox](../../infra/bigquery/README.md) demuestra sin facturación dos tablas de hechos con datos sintéticos y una consulta por fecha de corte. No está conectado a la base de Render y no sustituye Cloud SQL, Cloud Storage ni el ETL programado de esta arquitectura objetivo.

El workflow diario a las 03:00 de Lima (08:00 UTC; GitHub Actions puede iniciar con retraso) `.github/workflows/etl-scheduled.yml` llama por HTTPS a un endpoint ETL de Render. GitHub conserva la credencial del programador y Pulse accede a PostgreSQL por la red privada de Render. El 12/11/2026 se ejecutó manualmente y respondió `APPLIED` para `2026-II`, corte `2026-11-11`; el manifiesto registró cero filas de certificación y no informa el total de matrículas. Debe confirmarse ese total en Pulse antes de presentar los seis dashboards como conciliados con el Excel. El workflow semanal `.github/workflows/course-radar-scheduled.yml` consulta feeds JSON/RSS públicos que el administrador haya autorizado. La prueba productiva terminó `SKIPPED` porque no hay fuentes activas; no extrae HTML ni publica cursos automáticamente.

```mermaid
flowchart LR
    G[GitHub Actions diario 03:00 Lima] -->|HTTPS y secreto| R[Pulse EPIS en Render]
    R -->|red interna| P[(PostgreSQL Render)]
    P --> E[ETL por periodo y corte]
    E --> F[(Hechos analíticos)]
    F --> D[Seis reportes BI]
    E --> A[Resultado y artefacto de la corrida]
```

## Matriz de cumplimiento

| Requisito | Implementación disponible | Evidencia local | Brecha para cierre total | Estado |
|---|---|---|---|---|
| Arquitectura Data Warehouse o Data Lake | PostgreSQL de Render como warehouse operacional/analítico lógico; GCP Cloud SQL y Cloud Storage como diseño futuro de DW/Data Lake | Mermaid, SVG, modelo de hechos y exportación JSONL probada | Captura de buckets, Cloud SQL y una partición creada en GCP | Diseño local listo; GCP no desplegado |
| ETL automatizado en nube | ETL diario por GitHub Actions dentro de Render; futuro Cloud Run Job/Cloud Scheduler en Terraform; Radar con workflow semanal para feeds autorizados | API, workflows versionados, suites locales y dos corridas manuales verificadas en producción | Confirmar conteo de matrículas y reportes con datos del padrón; registrar un feed autorizado para Radar | Workflows productivos conectados; aceptación de datos y feed pendiente |
| Infraestructura como código y costos | Terraform para Cloud Run, Cloud SQL, Storage, IAM, secretos, monitoreo, presupuesto y Scheduler | `terraform validate` correcto; USD 11.36 demo y USD 155.69 piloto | `terraform plan`, `apply`, Infracost ligado al plan y factura/Billing Export del piloto | Completo local; cloud pendiente |
| Diagramas de proceso e infraestructura | Data Warehouse/Data Lake, ETL periódico e infraestructura GCP | Tres fuentes Mermaid y tres SVG renderizados | Comparación visual contra recursos desplegados | Completo local |
| Seis reportes con tiempo | Panorama, Evolución, Certificaciones, Habilidades, Cohortes y Calidad | Rutas, API día/mes/año y filtros temporales | Importación oficial, publicación de Gold y prueba contra esos datos en Render | Implementado local; corte institucional pendiente |

## Evidencia técnica vigente

- Backend: 108 pruebas aprobadas y 1 omitida por dependencia externa de PostgreSQL.
- Frontend: lint y compilación de producción correctos.
- Navegador: 60 pruebas E2E aprobadas y 1 recorrido integral con API/sesiones reales aprobado.
- Terraform: configuración válida con Google Provider 7.46.2.
- Migración: Render ejecuta `alembic upgrade head` antes de iniciar la aplicación. El despliegue `9f48691` está `live`, `/ready` respondió HTTP 200 y las rutas nuevas de padrón/conciliación están en OpenAPI.
- Repositorio: PR #114 integrado en `main` como `9f486911ce15d6e6aafe0b1069e1435095117849`; los checks de frontend, backend, documentación y contenedor terminaron correctamente.
- Ejecución productiva: Radar semanal `SKIPPED` con cero feeds activos. ETL diario de prueba `APPLIED` para `2026-II` y corte `2026-11-11`, con cero filas de certificación. El total de matrículas debe comprobarse desde la pantalla de Padrón.
- PostgreSQL: la consulta directa de esta sesión fue rechazada porque Render tiene vacía la lista de IPs permitidas; no se alteró la regla de red.
- Costos: escenario demo USD 11.36/mes y piloto USD 155.69/mes, antes de impuestos y egreso no previsto.
- Aplicación local: frontend en `http://127.0.0.1:3000` y API en `http://127.0.0.1:8000`.

## Plan de cierre de nube

El cierre funcional previo a la infraestructura se detalla en [las siete fases del MVP](31-Fases-MVP-Pulse-EPIS.md). No se debe llamar a `terraform apply` ni habilitar recursos de pago como parte del cierre local.

### Fase 1. Preparar GCP

1. Instalar Google Cloud CLI.
2. Autenticar la cuenta con `gcloud auth login` y credenciales de aplicación con `gcloud auth application-default login`.
3. Seleccionar o crear un proyecto con facturación habilitada.
4. Definir región `southamerica-west1`, propietario y centro de costo.
5. Crear el bucket de estado remoto de Terraform con versionado.

**Criterio de salida:** `scripts/preflight_gcp.ps1` confirma cuenta, proyecto, facturación, APIs y herramientas.

### Fase 2. Plan y costos reales

1. Copiar `terraform.tfvars.example` a un archivo local no versionado.
2. Completar IDs del proyecto, imágenes y configuración OIDC.
3. Ejecutar `terraform init` con backend remoto.
4. Generar un plan guardado.
5. Ejecutar Infracost sobre el plan y comparar con la estimación versionada.

**Criterio de salida:** plan revisado, costo por recurso y ausencia de secretos en archivos versionados.

### Fase 3. Despliegue controlado

1. Aplicar Terraform en el ambiente demo.
2. Publicar imágenes versionadas de frontend, backend y ETL.
3. Verificar Cloud Run, Cloud SQL, buckets, Scheduler, IAM y alertas.
4. Registrar URL, commit, fecha y salidas no sensibles.

**Criterio de salida:** portal y API responden por HTTPS y los recursos coinciden con el diagrama.

### Fase 4. Evidencia ETL

1. Ejecutar una corrida manual con datos sintéticos.
2. Esperar o disparar la corrida programada.
3. Repetir la misma fuente para demostrar idempotencia.
4. Ejecutar una entrada inválida para demostrar rechazo sin reemplazar el último corte válido.
5. Conservar logs, manifiestos y capturas sin información personal.

**Criterio de salida:** dos corridas correctas, una repetición idempotente y una falla controlada.

### Fase 5. Aceptación de dashboards

1. Ejecutar la prueba E2E contra la URL cloud.
2. Comprobar día, mes y año en los seis reportes.
3. Descargar los CSV y verificar que conservan filtros y fuente.
4. Comparar KPI con las tablas publicadas por el ETL.

**Criterio de salida:** seis reportes accesibles por HTTPS, trazables al mismo commit y ambiente.

### Fase 6. Incorporación posterior del padrón

1. Recibir código, correo, plan, ciclo, estado y periodo desde una fuente autorizada.
2. Previsualizar el CSV y resolver duplicados o faltantes.
3. Importar de forma atómica y conciliar al menos 95 %.
4. Publicar cifras institucionales únicamente después de la aprobación del responsable EPIS.

El padrón no bloquea la demostración técnica con datos sintéticos. Sí bloquea cualquier afirmación de cobertura institucional real.
