# Pulse EPIS · Segunda Unidad de Inteligencia de Negocios

Este README es el guion técnico de demostración de la segunda unidad. Distingue lo que funciona hoy en Render de la arquitectura GCP que está versionada en Terraform, pero que no se ha creado para evitar costos sin una aprobación previa.

**Aplicación desplegada:** [pulse-epis-rirr.onrender.com](https://pulse-epis-rirr.onrender.com/)

**Repositorio:** [Kiara1616/pulse-epis](https://github.com/Kiara1616/pulse-epis)

**Regla de presentación:** los datos de referencia se identifican como demostrativos; los datos publicados proceden del padrón y de certificaciones validadas.

## 1. Cumplimiento de requisitos

| Requisito de la unidad | Evidencia disponible | Estado real |
|---|---|---|
| Arquitectura Data Warehouse / Data Lake | [Diseño DW](docs/proyecto/26-Arquitectura-Data-Warehouse.md), [diagrama](docs/recursos/diagramas/data-warehouse.svg) | Warehouse lógico y ETL funcionan sobre PostgreSQL privado en Render. Data Lake GCP está definido, no desplegado. |
| ETL automatizado en nube | [Reglas ETL](docs/proyecto/14-ETL-y-calidad.md), [workflow diario](.github/workflows/etl-scheduled.yml), [diagrama](docs/recursos/diagramas/etl-periodico.svg) | Funciona mediante GitHub Actions + Render diariamente a las 03:00 Lima; también puede ejecutarse manualmente por administrador. |
| IaC y costos | [Terraform](infra/environments/demo), [estimación](infra/costs/estimate.md), [workflow](.github/workflows/infrastructure.yml) | Terraform valida; `apply`, Cloud Billing e Infracost oficial siguen pendientes para evitar gasto no autorizado. |
| Diagramas de procesos e infraestructura | [ETL](docs/recursos/diagramas/etl-periodico.svg), [GCP](docs/recursos/diagramas/infraestructura-gcp.svg) | Listos en Mermaid y SVG para exposición. |
| Seis reportes y filtros temporales | [Rutas de reportes](dashboard-app/src/app/reportes) | Implementados con periodo académico, fecha de corte, cohorte, ciclo y proveedor. |

## 2. Explicación simple: Bronze, Silver y Gold

No son tres programas ni tres pagos distintos: son **capas que ordenan la transformación del dato**.

```text
Padrón CSV + certificaciones + decisiones
                ↓
Bronze: dato recibido y conservado con su fecha/fuente
                ↓
Silver: dato limpio, normalizado y validado
                ↓
Gold: indicadores y tablas listas para dashboards
```

| Capa | En Pulse EPIS | Ejemplo |
|---|---|---|
| Bronze | Datos que llegan desde la fuente y que aún no se usan como KPI | CSV del padrón recibido, declaración de certificación, evidencia, fecha de consulta de un curso. |
| Silver | Datos transformados y con reglas de calidad | Correo institucional validado, ciclo normalizado, proveedor canónico, certificación aprobada/rechazada. |
| Gold | Datos agregados y temporales para consumo BI | `fact_student_period`, `fact_certification`, cobertura, brechas, evolución y seis reportes. |

En el despliegue actual, Bronze y Silver viven en el modelo operacional protegido de PostgreSQL; Gold son los snapshots que publica el ETL. El futuro Data Lake GCP guardará exportaciones seudonimizadas por periodo y fecha de corte.

## 3. Arquitectura y ETL

![Arquitectura Data Warehouse](docs/recursos/diagramas/data-warehouse.svg)

El flujo de operación es:

1. Administrador importa el padrón autorizado por periodo.
2. Estudiante declara una certificación y adjunta evidencia.
3. Validador aprueba, observa o rechaza.
4. El ETL valida, calcula el hash de fuente y publica un snapshot atómico.
5. Los seis reportes leen únicamente el snapshot Gold publicado.
6. Si la fuente no cambia, la corrida es idempotente; si falla calidad, se conserva el último corte válido.

![Proceso ETL](docs/recursos/diagramas/etl-periodico.svg)

## 4. Infraestructura como código y costo

![Infraestructura propuesta en GCP](docs/recursos/diagramas/infraestructura-gcp.svg)

Terraform define Cloud Storage, Cloud SQL, Cloud Run, Cloud Run Job, Cloud Scheduler, Secret Manager, IAM, monitoreo y presupuesto. Estos comandos son seguros y **no crean recursos ni generan cobro**:

```powershell
cd infra/environments/demo
terraform init -backend=false
terraform fmt -check -recursive ../..
terraform validate
terraform plan
```

El costo inicia solo al ejecutar `terraform apply`, porque ese comando crea recursos reales. Antes de ello se debe habilitar facturación y aprobar el presupuesto.

### Cómo leer esta estimación

- **USD:** moneda en la que se estiman los servicios de GCP.
- **S/:** conversión referencial para exponer el presupuesto en Perú.
- **Mensual:** costo estimado de un mes de operación.
- **Anual:** mensual × 12. Sirve para presupuestar, no es una factura adelantada.
- **Bruto:** no descuenta créditos gratuitos, descuentos, impuestos ni tráfico de salida.

Para la presentación se usa un tipo de cambio redondeado de **S/ 3.50 por USD**, únicamente como supuesto reproducible. Antes de una compra se debe actualizar con la [serie de tipo de cambio del BCRP](https://estadisticas.bcrp.gob.pe/estadisticas/series/diarias/tipo-de-cambio-nominal) y cotizaciones vigentes de GCP.

| Escenario | USD mensual | S/ mensual | USD anual | S/ anual | Uso previsto |
|---|---:|---:|---:|---:|---|
| **Demo** | **USD 11.36** | **S/ 39.76** | **USD 136.32** | **S/ 477.12** | Presentación, pocas corridas ETL y servicios Cloud Run con escala a cero. |
| **Piloto** | **USD 155.69** | **S/ 544.92** | **USD 1,868.28** | **S/ 6,548.98** | Uso continuo, mayor disponibilidad y capacidad reservada. |

```mermaid
xychart-beta
    title "Costo bruto estimado de Pulse EPIS (USD)"
    x-axis ["Demo mensual", "Piloto mensual", "Demo anual", "Piloto anual"]
    y-axis "USD" 0 --> 2000
    bar [11.36, 155.69, 136.32, 1868.28]
```

La principal decisión de costo es **Cloud SQL**: mantiene la base de datos encendida. Cloud Run puede bajar a cero cuando no hay visitas; por eso su costo de demo es reducido.

| Componente GCP | Demo mensual USD | Demo mensual S/ | Piloto mensual USD | Piloto mensual S/ | Qué cubre |
|---|---:|---:|---:|---:|---|
| Cloud SQL: cómputo | 7.67 | 26.85 | 83.27 | 291.45 | Base de datos PostgreSQL operativa y analítica. |
| Cloud SQL: SSD | 3.40 | 11.90 | 8.50 | 29.75 | Almacenamiento persistente de la base de datos. |
| Cloud Storage | 0.14 | 0.49 | 1.20 | 4.20 | Data Lake y evidencias privadas. |
| Cloud Run Job: ETL | 0.11 | 0.39 | 0.32 | 1.12 | Ejecución programada del proceso ETL. |
| Cloud Run reservado | 0.00 | 0.00 | 62.34 | 218.19 | Disponibilidad continua del portal y API. |
| Artifact Registry | 0.05 | 0.18 | 0.05 | 0.18 | Imágenes de contenedores. |
| **Total bruto estimado** | **11.36** | **39.76** | **155.69** | **544.92** | **Total mensual antes de impuestos.** |

> Ejemplo para explicarlo: “El escenario Demo costaría aproximadamente S/ 39.76 al mes, o S/ 477.12 al año, si se mantuvieran los mismos recursos, consumo y tipo de cambio. No se ejecutará `terraform apply` sin aprobar este presupuesto.”

Precios de referencia al 2026-11-07, antes de impuestos, tráfico de salida y descuentos. Para reproducirlos:

```powershell
python infra/costs/estimate.py
```

Infracost complementa la estimación después de tener un `terraform plan` válido y su API key; no se debe presentar como costo real antes de desplegar.

## 5. Los seis reportes

| Reporte | Pregunta que responde |
|---|---|
| Panorama | ¿Cuál es la cobertura general al corte? |
| Certificaciones | ¿Qué credenciales y entidades concentran aprobaciones? |
| Habilidades | ¿Qué habilidades están acreditadas? |
| Cohortes | ¿Cómo varía la certificación según año de ingreso? |
| Evolución | ¿Cómo cambian los indicadores entre cortes? |
| Calidad | ¿Qué tan confiable y completo fue el lote publicado? |

Durante la demostración, cambia **Periodo** y **Fecha de corte**. La fecha permite analizar un día; al presentar mes o año se toma el último snapshot publicado de ese mes o año, sin sumar porcentajes de distintos cortes.

## 6. Guion de presentación (5 minutos)

1. Abrir Pulse EPIS y mostrar el rol Administrador.
2. Explicar Bronze → Silver → Gold con la tabla de la sección 2.
3. Mostrar el padrón, una certificación validada y el proceso de publicación de indicadores.
4. Abrir los seis reportes y cambiar periodo/fecha de corte.
5. Mostrar los tres diagramas y el bloque de Terraform.
6. Mostrar la tabla de costos y aclarar: `plan` no cobra; `apply` sí crea recursos.
7. Cerrar indicando que Render ejecuta el MVP actual y GCP está listo para activarse cuando haya presupuesto institucional.

## 7. Próximos pasos verificables

- Importar el padrón 2026-II y publicar su primer corte institucional.
- Configurar los filtros explícitos de año y mes en los reportes.
- Conectar fuentes de cursos autorizadas y filtrar oportunidades por ciclo real del estudiante.
- Habilitar facturación GCP, ejecutar Terraform, generar Infracost y conservar dos ejecuciones Cloud Run Job como evidencia.

Para detalles completos, consulta la [guía de presentación U2](docs/proyecto/28-Guia-presentacion-U2.md) y el [cierre de segunda unidad](docs/proyecto/29-Cierre-segunda-unidad.md).
