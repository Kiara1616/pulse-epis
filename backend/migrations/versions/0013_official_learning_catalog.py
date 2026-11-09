"""Seed the reviewed official learning catalog used by the EPIS pilot."""

from __future__ import annotations

from datetime import date
from uuid import uuid4

import sqlalchemy as sa
from alembic import op


revision = "0013_official_learning_catalog"
down_revision = "0012_learning_catalog_sync"
branch_labels = None
depends_on = None


INTERESTS = (
    "Python y análisis de datos",
    "Computación en la nube",
    "Bases de datos",
    "Observabilidad",
    "DevOps y CI/CD",
    "Ciberseguridad",
    "Grafos y conocimiento",
    "Ingeniería de datos",
)

COURSES = (
    {
        "title": "Python Essentials 1",
        "provider": "Cisco Networking Academy",
        "url": "https://www.skillsforall.com/course/python-essentials-1?courseLang=en-US",
        "skills": ["Python", "Programación", "Resolución de problemas"],
        "requirements": ["Sin requisitos previos"],
        "cycles": ["III", "IV", "V", "VI", "VII", "VIII", "IX", "X"],
        "interests": ["Python y análisis de datos"],
        "relevance": "Catálogo oficial U2: fortalece programación en Python y prepara al estudiante para rutas técnicas posteriores de Cisco.",
    },
    {
        "title": "Oracle Cloud Infrastructure Foundations",
        "provider": "Oracle University",
        "url": "https://education.oracle.com/midtier/html/OUCollectionsProducts/pillar.html",
        "skills": ["OCI", "Arquitectura cloud", "Seguridad cloud"],
        "requirements": ["Fundamentos de TI"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Computación en la nube"],
        "relevance": "Catálogo oficial U2: introduce servicios OCI y sirve como preparación para una credencial oficial de fundamentos cloud.",
    },
    {
        "title": "Data Analyst with Python",
        "provider": "DataCamp",
        "url": "https://www.datacamp.com/tracks/data-analyst-with-python",
        "skills": ["Python", "Pandas", "Visualización", "Análisis de datos"],
        "requirements": ["Programación básica"],
        "cycles": ["VI", "VII", "VIII", "IX", "X"],
        "interests": ["Python y análisis de datos", "Ingeniería de datos"],
        "relevance": "Catálogo oficial U2: desarrolla análisis práctico con Python y una ruta de aprendizaje orientada a credenciales profesionales.",
    },
    {
        "title": "AWS Cloud Practitioner Essentials",
        "provider": "AWS Skill Builder",
        "url": "https://explore.skillbuilder.aws/learn/courses/134/aws-cloud-practitioner-essentials",
        "skills": ["AWS", "Arquitectura cloud", "Seguridad", "Costos cloud"],
        "requirements": ["Conocimientos generales de TI"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Computación en la nube", "Ciberseguridad"],
        "relevance": "Catálogo oficial U2: curso oficial gratuito de fundamentos y preparación inicial para AWS Certified Cloud Practitioner.",
    },
    {
        "title": "Introduction to Grafana Cloud",
        "provider": "Grafana Labs",
        "url": "https://grafana.com/docs/learning-journeys/intro-to-grafana-cloud/",
        "skills": ["Grafana", "Observabilidad", "Dashboards", "Métricas"],
        "requirements": ["Fundamentos de sistemas"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Observabilidad", "DevOps y CI/CD"],
        "relevance": "Catálogo oficial U2: recorrido práctico oficial para comprender monitoreo, métricas y visualización en Grafana Cloud.",
    },
    {
        "title": "Neo4j Certified Professional",
        "provider": "Neo4j GraphAcademy",
        "url": "https://graphacademy.neo4j.com/certifications/neo4j-certification",
        "skills": ["Neo4j", "Cypher", "Modelado de grafos", "Importación de datos"],
        "requirements": ["Fundamentos de bases de datos"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Grafos y conocimiento", "Bases de datos"],
        "relevance": "Catálogo oficial U2: certificación gratuita que valida Cypher, modelado, índices, importación y desarrollo con drivers.",
    },
    {
        "title": "MongoDB Associate Developer",
        "provider": "MongoDB University",
        "url": "https://learn.mongodb.com/pages/mongodb-associate-developer-exam",
        "skills": ["MongoDB", "NoSQL", "Modelado documental", "Agregaciones"],
        "requirements": ["Programación", "Fundamentos de bases de datos"],
        "cycles": ["VI", "VII", "VIII", "IX", "X"],
        "interests": ["Bases de datos"],
        "relevance": "Catálogo oficial U2: preparación y examen oficial para validar desarrollo de aplicaciones modernas con MongoDB.",
    },
    {
        "title": "Redis Insight",
        "provider": "Redis University",
        "url": "https://university.redis.io/course/ibjgkshzhox41u?tab=details",
        "skills": ["Redis", "Redis Insight", "Análisis de rendimiento", "NoSQL"],
        "requirements": ["Fundamentos de Redis"],
        "cycles": ["VI", "VII", "VIII", "IX", "X"],
        "interests": ["Bases de datos", "Observabilidad"],
        "relevance": "Catálogo oficial U2: curso oficial con certificado de finalización sobre análisis, operación y optimización de Redis.",
    },
    {
        "title": "Fundamentals of Liquibase (LB101)",
        "provider": "Liquibase University",
        "url": "https://learn.liquibase.com/",
        "skills": ["Liquibase", "Migraciones", "Versionado de base de datos", "CI/CD"],
        "requirements": ["SQL", "Fundamentos de bases de datos"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["DevOps y CI/CD", "Bases de datos"],
        "relevance": "Catálogo oficial U2: fundamentos con certificado de finalización y credencial digital verificable de Liquibase University.",
    },
    {
        "title": "Microsoft Certified: Azure Fundamentals (AZ-900)",
        "provider": "Microsoft Learn",
        "url": "https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/",
        "skills": ["Azure", "Arquitectura cloud", "Gobernanza", "Seguridad"],
        "requirements": ["Fundamentos de TI"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Computación en la nube", "Ciberseguridad"],
        "relevance": "Catálogo oficial U2: ruta oficial para demostrar conocimientos de servicios, arquitectura y gobierno de Microsoft Azure.",
    },
    {
        "title": "Cloud Digital Leader Learning Path",
        "provider": "Google Cloud Skills Boost",
        "url": "https://www.cloudskillsboost.google/paths/9",
        "skills": ["Google Cloud", "Transformación digital", "Datos", "IA"],
        "requirements": ["Sin requisitos técnicos avanzados"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Computación en la nube", "Ingeniería de datos"],
        "relevance": "Catálogo oficial U2: ruta sin costo administrada por Google Cloud para preparar la certificación Cloud Digital Leader.",
    },
    {
        "title": "SnowPro Core Certification Prep",
        "provider": "Snowflake University",
        "url": "https://learn.snowflake.com/en/courses/OD-COREPREP/",
        "skills": ["Snowflake", "Data warehouse", "Carga de datos", "Optimización"],
        "requirements": ["SQL", "Experiencia básica con Snowflake"],
        "cycles": ["VIII", "IX", "X"],
        "interests": ["Ingeniería de datos", "Bases de datos", "Computación en la nube"],
        "relevance": "Catálogo oficial U2: curso oficial gratuito de preparación para la certificación SnowPro Core sobre Snowflake AI Data Cloud.",
    },
    {
        "title": "GitHub Foundations Certification",
        "provider": "GitHub Skills",
        "url": "https://resources.github.com/learn/certifications/",
        "skills": ["Git", "GitHub", "Colaboración", "CI/CD"],
        "requirements": ["Fundamentos de control de versiones"],
        "cycles": ["V", "VI", "VII", "VIII", "IX", "X"],
        "interests": ["DevOps y CI/CD"],
        "relevance": "Catálogo oficial U2: certificación inicial para validar repositorios, colaboración, gestión de proyectos y prácticas modernas con GitHub.",
    },
)


def _scalar_id(connection, table: str, column: str, value: str):
    return connection.execute(
        sa.text(f"SELECT id FROM {table} WHERE {column} = :value"),
        {"value": value},
    ).scalar_one()


def upgrade():
    connection = op.get_bind()
    checked_on = date(2026, 11, 9)

    for name in INTERESTS:
        connection.execute(
            sa.text(
                "INSERT INTO learning_interests (id, name, active) "
                "VALUES (:id, :name, true) ON CONFLICT (name) DO NOTHING"
            ),
            {"id": str(uuid4()), "name": name},
        )

    offer_ids: dict[str, str] = {}
    for course in COURSES:
        connection.execute(
            sa.text(
                "INSERT INTO learning_courses "
                "(id, title, provider, source_url, checked_on, requirements, skills, status) "
                "VALUES (:id, :title, :provider, :url, :checked_on, :requirements, :skills, 'PUBLISHED') "
                "ON CONFLICT (source_url) DO NOTHING"
            ).bindparams(
                sa.bindparam("requirements", type_=sa.JSON()),
                sa.bindparam("skills", type_=sa.JSON()),
            ),
            {
                "id": str(uuid4()),
                "title": course["title"],
                "provider": course["provider"],
                "url": course["url"],
                "checked_on": checked_on,
                "requirements": course["requirements"],
                "skills": course["skills"],
            },
        )
        course_id = _scalar_id(connection, "learning_courses", "source_url", course["url"])
        existing_offer = connection.execute(
            sa.text("SELECT id FROM learning_offers WHERE course_id = :course_id"),
            {"course_id": str(course_id)},
        ).scalar_one_or_none()
        if existing_offer is None:
            offer_id = str(uuid4())
            connection.execute(
                sa.text(
                    "INSERT INTO learning_offers "
                    "(id, course_id, title, cycles, relevance, status) "
                    "VALUES (:id, :course_id, :title, :cycles, :relevance, 'PUBLISHED')"
                ).bindparams(sa.bindparam("cycles", type_=sa.JSON())),
                {
                    "id": offer_id,
                    "course_id": str(course_id),
                    "title": course["title"],
                    "cycles": course["cycles"],
                    "relevance": course["relevance"],
                },
            )
        else:
            offer_id = str(existing_offer)
        offer_ids[course["title"]] = offer_id

        for interest_name in course["interests"]:
            interest_id = _scalar_id(connection, "learning_interests", "name", interest_name)
            connection.execute(
                sa.text(
                    "INSERT INTO learning_offer_interests (id, offer_id, interest_id) "
                    "VALUES (:id, :offer_id, :interest_id) "
                    "ON CONFLICT (offer_id, interest_id) DO NOTHING"
                ),
                {"id": str(uuid4()), "offer_id": offer_id, "interest_id": str(interest_id)},
            )

    workshop_offer = offer_ids["Data Analyst with Python"]
    connection.execute(
        sa.text(
            "INSERT INTO learning_workshops (id, offer_id, title, capacity, requirements, status) "
            "SELECT :id, :offer_id, :title, 30, :requirements, 'OPEN' "
            "WHERE NOT EXISTS (SELECT 1 FROM learning_workshops WHERE title = :title)"
        ).bindparams(sa.bindparam("requirements", type_=sa.JSON())),
        {
            "id": str(uuid4()),
            "offer_id": workshop_offer,
            "title": "Taller de preparación: Análisis de datos con Python",
            "requirements": ["Ser estudiante activo de EPIS", "Contar con acceso a un entorno Python"],
        },
    )


def downgrade():
    connection = op.get_bind()
    connection.execute(
        sa.text("DELETE FROM learning_workshops WHERE title = :title"),
        {"title": "Taller de preparación: Análisis de datos con Python"},
    )
    connection.execute(
        sa.text("DELETE FROM learning_offers WHERE relevance LIKE 'Catálogo oficial U2:%'")
    )

