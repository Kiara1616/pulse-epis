# Prueba gratuita del Data Warehouse en BigQuery Sandbox

Esta prueba carga **solo datos sintéticos** en BigQuery Sandbox, sin cuenta de facturación. Es una alternativa demostrativa al despliegue objetivo de Cloud SQL y Cloud Storage descrito en `../environments/demo`. No se conecta a Pulse EPIS en Render ni contiene padrón o correos reales.

El [diagrama de esta prueba](architecture.mmd) distingue la carga sintética activa de la integración futura con Pulse EPIS. El diagrama completo con Cloud SQL y Data Lake sigue siendo el diseño objetivo.

```powershell
bq --project_id=pulse-epis-bi-sandbox-20261107 mk --dataset --location=US --default_table_expiration=5184000 pulse_epis_demo
python infra/bigquery/sandbox_demo.py pulse-epis-bi-sandbox-20261107
```

El proyecto de demostración se creó el 07/11/2026 sin facturación. La consulta verificada devolvió 2 estudiantes activos y 1 certificado para cada corte (`2026-11-01` y `2026-11-02`). El dataset puede verse en [BigQuery Studio](https://console.cloud.google.com/bigquery?project=pulse-epis-bi-sandbox-20261107).

Tablas: `pulse_epis_demo.fact_student_period` y `pulse_epis_demo.fact_certification`. Los registros tienen dos fechas de corte. La consulta final muestra estudiantes activos y certificados por corte; una credencial `PENDING` no se cuenta como aprobada.

El sandbox limita el almacenamiento a 10 GiB de por vida, las consultas a 1 TiB mensual y las tablas caducan después de 60 días. No incluye DML ni transferencias programadas. Por eso la carga reproducible usa `bq load --replace`; el ETL programado con Cloud Run y Cloud Scheduler sigue pendiente de un proyecto con facturación. No se debe presentar esta prueba como despliegue completo de la arquitectura objetivo.
