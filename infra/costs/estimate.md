# Estimación mensual de costos GCP — Pulse EPIS

**Corte de precios:** 2026-11-07
**Región:** `southamerica-west1`
**Moneda:** USD, antes de impuestos, créditos y descuentos.

| Componente | Demo | Piloto |
|---|---:|---:|
| Cloud SQL compute | $7.67 | $83.27 |
| Cloud SQL SSD | $3.40 | $8.50 |
| Cloud Storage | $0.14 | $1.20 |
| Cloud Run ETL | $0.11 | $0.32 |
| Cloud Run reserved services | $0.00 | $62.34 |
| Artifact Registry | $0.05 | $0.05 |
| Total bruto estimado | $11.36 | $155.69 |

El escenario demo tiene escala a cero para frontend y API; el cálculo bruto de Cloud Run puede reducirse por la capa gratuita. Cloud SQL permanece encendido y concentra el costo base. El escenario piloto usa un techo conservador con una instancia reservada para cada servicio.

No se incluyen egreso a Internet, impuestos, dominio, soporte ni crecimiento no previsto. Secret Manager y Scheduler permanecen dentro de sus capas gratuitas bajo estos supuestos. La factura real se valida tras el piloto con Billing Export.

## Fuentes oficiales

- [Cloud Run](https://cloud.google.com/run/pricing)
- [Cloud Sql](https://cloud.google.com/sql/pricing?hl=es-419)
- [Cloud Storage](https://cloud.google.com/storage/pricing)
- [Artifact Registry](https://cloud.google.com/artifact-registry/pricing)
- [Secret Manager](https://cloud.google.com/secret-manager/pricing)

## Reproducción

```powershell
py infra/costs/estimate.py
```

Infracost está instalado localmente, pero su salida oficial requiere una API key y un `terraform plan` asociado al proyecto GCP real. Ese artefacto debe sustituir o acompañar esta estimación antes de la aceptación cloud.
