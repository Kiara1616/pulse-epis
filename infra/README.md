# Infraestructura GCP de Pulse EPIS

Terraform describe el ambiente demostrativo: Cloud Run, Cloud Run Job, Cloud SQL, Cloud Scheduler, Artifact Registry, Storage, Secret Manager, IAM, Logging y presupuesto opcional.

## Validación local

```bash
cd infra/environments/demo
terraform init -backend-config=backend.hcl
terraform fmt -check -recursive
terraform validate
terraform plan -var-file=terraform.tfvars
```

Copiar `terraform.tfvars.example` como un archivo local no versionado y sustituir proyecto, imágenes y cuenta de facturación. El plan puede validarse sin aplicar. `apply` requiere un proyecto GCP, APIs, facturación y credenciales con privilegios aprobados.

Copiar también `backend.hcl.example` como `backend.hcl` y apuntarlo a un bucket de estado creado una sola vez por el responsable cloud. En CI de validación se usa `-backend=false`; en plan y aplicación se exige estado remoto GCS. La imagen del frontend debe construirse con `NEXT_PUBLIC_API_URL=<api_public_url>/api/v1`, porque esa variable forma parte del bundle del navegador.

## Costos

Los supuestos están en `infra/costs/assumptions.json`. Antes del despliegue se deben generar:

```bash
infracost breakdown --path infra/environments/demo --format json --out-file infra/costs/infracost.json
infracost output --path infra/costs/infracost.json --format table
```

El reporte final adjunta además una exportación fechada de GCP Pricing Calculator y diferencia costo bruto, créditos y costo neto.
