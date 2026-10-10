"""Shared synthetic certification catalog used by local demos and seed data."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DemoCertificationSpec:
    """A provider credential and the skills it demonstrates in the pilot."""

    issuer_name: str
    credential_name: str
    website_url: str
    skills: tuple[tuple[str, str], ...]


DEMO_CERTIFICATION_CATALOG: tuple[DemoCertificationSpec, ...] = (
    DemoCertificationSpec(
        issuer_name="AWS",
        credential_name="AWS Certified Cloud Practitioner",
        website_url="https://aws.amazon.com/certification/",
        skills=(("Computación en la nube", "Fundamentos"), ("Seguridad en la nube", "Fundamentos")),
    ),
    DemoCertificationSpec(
        issuer_name="Cisco",
        credential_name="Cisco CCNA",
        website_url="https://www.cisco.com/site/us/en/learn/training-certifications/certifications/index.html",
        skills=(("Redes", "Fundamentos"), ("Ciberseguridad", "Fundamentos")),
    ),
    DemoCertificationSpec(
        issuer_name="Oracle",
        credential_name="Oracle Database SQL Certified Associate",
        website_url="https://education.oracle.com/oracle-certification",
        skills=(("Bases de datos", "Intermedio"), ("SQL", "Intermedio")),
    ),
    DemoCertificationSpec(
        issuer_name="Neo4j",
        credential_name="Neo4j Certified Professional",
        website_url="https://graphacademy.neo4j.com/certification/",
        skills=(("Bases de datos", "Intermedio"), ("Bases de datos de grafos", "Intermedio")),
    ),
    DemoCertificationSpec(
        issuer_name="Grafana",
        credential_name="Grafana Certified Professional",
        website_url="https://grafana.com/training/certification/",
        skills=(("Observabilidad", "Fundamentos"), ("Visualización de datos", "Fundamentos")),
    ),
)


__all__ = ["DEMO_CERTIFICATION_CATALOG", "DemoCertificationSpec"]
