# Reporte de costos de infraestructura

El estimado reproducible parte de `assumptions.json`. El escenario demo usa Cloud Run con escala a cero, un Cloud Run Job diario, Cloud SQL zonal de tamaño mínimo, dos buckets y operaciones de observabilidad.

## Procedimiento auditable

1. Copiar `terraform.tfvars.example` a `terraform.tfvars` y completar proyecto y cuenta de facturación.
2. Ejecutar `terraform plan -out=tfplan` en `infra/environments/demo`.
3. Ejecutar `infracost breakdown --path tfplan --format json --out-file ../../costs/infracost.json`.
4. Adjuntar el JSON y la captura del presupuesto de GCP a la entrega.

El presupuesto Terraform genera alertas al 50 %, 80 % y 100 %. No se presenta una cifra fija como costo oficial porque los precios dependen de región, consumo, moneda e impuestos; `infracost.json` será la evidencia calculada para el proyecto real.
