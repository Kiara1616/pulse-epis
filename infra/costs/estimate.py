"""Generate a transparent pre-deployment GCP cost report from versioned inputs."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def money(value: float) -> str:
    return f"${value:,.2f}"


def calculate() -> dict[str, dict[str, float]]:
    assumptions = json.loads((ROOT / "assumptions.json").read_text(encoding="utf-8"))
    prices = json.loads((ROOT / "gcp-price-snapshot.json").read_text(encoding="utf-8"))
    rates = prices["rates"]
    hours = prices["hours_per_month"]
    seconds = hours * 3600
    result: dict[str, dict[str, float]] = {}
    for name, scenario in assumptions["scenarios"].items():
        if scenario["cloud_sql_tier"] == "db-f1-micro":
            sql_compute = rates["cloud_sql_f1_micro_hour"] * hours
        else:
            sql_compute = (
                rates["cloud_sql_custom_vcpu_hour"]
                + rates["cloud_sql_custom_gib_hour"] * 3.75
            ) * hours
        sql_storage = rates["cloud_sql_ssd_gib_hour"] * hours * scenario["database_storage_gb"]
        object_storage = (
            scenario["data_lake_storage_gb"] + scenario["evidence_storage_gb"]
        ) * rates["cloud_storage_standard_gib_hour"] * hours
        etl_seconds = scenario["etl_runs"] * scenario["etl_minutes_per_run"] * 60
        etl = etl_seconds * (
            rates["cloud_run_vcpu_second"] + 0.5 * rates["cloud_run_gib_second"]
        )
        # Two 1-vCPU/512-MiB services. Demo scales to zero; pilot reserves one
        # instance of each as a conservative gross-cost ceiling.
        services = 0.0
        if scenario["cloud_run_min_instances"]:
            services = 2 * seconds * (
                rates["cloud_run_vcpu_second"] + 0.5 * rates["cloud_run_gib_second"]
            )
        artifacts = max(1.0 - 0.5, 0) * rates["artifact_registry_gib_hour"] * hours
        components = {
            "Cloud SQL compute": sql_compute,
            "Cloud SQL SSD": sql_storage,
            "Cloud Storage": object_storage,
            "Cloud Run ETL": etl,
            "Cloud Run reserved services": services,
            "Artifact Registry": artifacts,
        }
        components["Total bruto estimado"] = sum(components.values())
        result[name] = components
    return result


def render(result: dict[str, dict[str, float]]) -> str:
    prices = json.loads((ROOT / "gcp-price-snapshot.json").read_text(encoding="utf-8"))
    lines = [
        "# Estimación mensual de costos GCP — Pulse EPIS",
        "",
        f"**Corte de precios:** {prices['captured_on']}  ",
        f"**Región:** `{prices['region']}`  ",
        "**Moneda:** USD, antes de impuestos, créditos y descuentos.",
        "",
        "| Componente | Demo | Piloto |",
        "|---|---:|---:|",
    ]
    components = list(result["demo"])
    for component in components:
        lines.append(f"| {component} | {money(result['demo'][component])} | {money(result['pilot'][component])} |")
    lines.extend([
        "",
        "El escenario demo tiene escala a cero para frontend y API; el cálculo bruto de Cloud Run puede reducirse por la capa gratuita. Cloud SQL permanece encendido y concentra el costo base. El escenario piloto usa un techo conservador con una instancia reservada para cada servicio.",
        "",
        "No se incluyen egreso a Internet, impuestos, dominio, soporte ni crecimiento no previsto. Secret Manager y Scheduler permanecen dentro de sus capas gratuitas bajo estos supuestos. La factura real se valida tras el piloto con Billing Export.",
        "",
        "## Fuentes oficiales",
        "",
        *[f"- [{name.replace('_', ' ').title()}]({url})" for name, url in prices["sources"].items()],
        "",
        "## Reproducción",
        "",
        "```powershell",
        "py infra/costs/estimate.py",
        "```",
        "",
        "Infracost está instalado localmente, pero su salida oficial requiere una API key y un `terraform plan` asociado al proyecto GCP real. Ese artefacto debe sustituir o acompañar esta estimación antes de la aceptación cloud.",
    ])
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    calculated = calculate()
    (ROOT / "estimate.json").write_text(json.dumps(calculated, indent=2), encoding="utf-8")
    (ROOT / "estimate.md").write_text(render(calculated), encoding="utf-8")
    print(render(calculated))
