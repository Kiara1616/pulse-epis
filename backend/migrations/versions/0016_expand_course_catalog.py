"""Expand the reviewed learning catalog with multiple official provider links."""

from __future__ import annotations

from datetime import date
from uuid import uuid4

import sqlalchemy as sa
from alembic import op


revision = "0016_expand_course_catalog"
down_revision = "0015_database_evidence_content"
branch_labels = None
depends_on = None

COURSES_EXPANSION = (
    # Cisco Networking Academy
    {
        "title": "Python Essentials 2",
        "provider": "Cisco Networking Academy",
        "url": "https://www.skillsforall.com/course/python-essentials-2",
        "skills": ["Python", "POO", "Estructuras de datos"],
        "requirements": ["Python Essentials 1 o conocimientos equivalentes"],
        "cycles": ["IV", "V", "VI", "VII", "VIII", "IX", "X"],
        "interests": ["Python y análisis de datos"],
        "relevance": "Catálogo oficial: profundiza en programación orientada a objetos, módulos y excepciones con Python.",
    },
    {
        "title": "CCNA: Introduction to Networks",
        "provider": "Cisco Networking Academy",
        "url": "https://www.netacad.com/courses/networking/ccna-introduction-networks",
        "skills": ["Redes", "TCP/IP", "Enrutamiento", "Conmutación"],
        "requirements": ["Fundamentos de computación"],
        "cycles": ["V", "VI", "VII", "VIII", "IX", "X"],
        "interests": ["Computación en la nube", "Ciberseguridad"],
        "relevance": "Catálogo oficial: primer módulo formativo oficial hacia la certificación industrial Cisco CCNA.",
    },
    {
        "title": "CyberOps Associate",
        "provider": "Cisco Networking Academy",
        "url": "https://www.netacad.com/courses/cybersecurity/cyberops-associate",
        "skills": ["Ciberseguridad", "Monitoreo de seguridad", "SOC", "Análisis de amenazas"],
        "requirements": ["Fundamentos de redes y sistemas operativos"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Ciberseguridad"],
        "relevance": "Catálogo oficial: formación para analistas en centros de operaciones de ciberseguridad (SOC).",
    },
    {
        "title": "JavaScript Essentials 1",
        "provider": "Cisco Networking Academy",
        "url": "https://www.skillsforall.com/course/javascript-essentials-1",
        "skills": ["JavaScript", "Desarrollo web", "Algoritmos"],
        "requirements": ["Sin requisitos previos"],
        "cycles": ["III", "IV", "V", "VI", "VII", "VIII"],
        "interests": ["Python y análisis de datos", "DevOps y CI/CD"],
        "relevance": "Catálogo oficial: fundamentos de programación interactiva y algoritmia con JavaScript.",
    },

    # AWS Skill Builder
    {
        "title": "AWS Technical Essentials",
        "provider": "AWS Skill Builder",
        "url": "https://explore.skillbuilder.aws/learn/courses/132/aws-technical-essentials",
        "skills": ["AWS", "Compute EC2", "Almacenamiento S3", "IAM"],
        "requirements": ["Fundamentos de TI"],
        "cycles": ["VI", "VII", "VIII", "IX", "X"],
        "interests": ["Computación en la nube"],
        "relevance": "Catálogo oficial: fundamentos técnicos de cómputo, almacenamiento, redes y seguridad en AWS.",
    },
    {
        "title": "Architecting on AWS - Solutions Architect Associate Learning Plan",
        "provider": "AWS Skill Builder",
        "url": "https://explore.skillbuilder.aws/learn/courses/1039/architecting-on-aws",
        "skills": ["AWS", "Arquitectura cloud", "Alta disponibilidad", "VPC"],
        "requirements": ["AWS Technical Essentials o experiencia previa en AWS"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Computación en la nube", "DevOps y CI/CD"],
        "relevance": "Catálogo oficial: ruta de preparación oficial para AWS Certified Solutions Architect - Associate.",
    },
    {
        "title": "Developing on AWS - Developer Associate Learning Plan",
        "provider": "AWS Skill Builder",
        "url": "https://explore.skillbuilder.aws/learn/courses/1040/developing-on-aws",
        "skills": ["AWS", "Serverless", "Lambda", "DynamoDB"],
        "requirements": ["Programación básica en Python, Java o Node.js"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Computación en la nube", "Bases de datos"],
        "relevance": "Catálogo oficial: diseño e implementación de aplicaciones escalables y serverless en AWS.",
    },
    {
        "title": "AWS Cloud Quest: Cloud Practitioner",
        "provider": "AWS Skill Builder",
        "url": "https://explore.skillbuilder.aws/learn/courses/11458/aws-cloud-quest-cloud-practitioner",
        "skills": ["AWS", "Práctica guiada", "Soluciones cloud"],
        "requirements": ["Conocimientos generales de tecnología"],
        "cycles": ["IV", "V", "VI", "VII", "VIII", "IX", "X"],
        "interests": ["Computación en la nube"],
        "relevance": "Catálogo oficial: juego de rol educativo oficial de AWS con soluciones prácticas reales.",
    },

    # Microsoft Learn
    {
        "title": "Microsoft Certified: Azure AI Fundamentals (AI-900)",
        "provider": "Microsoft Learn",
        "url": "https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-fundamentals/",
        "skills": ["Azure", "Inteligencia artificial", "Machine Learning", "Visión artificial"],
        "requirements": ["Fundamentos de TI"],
        "cycles": ["VI", "VII", "VIII", "IX", "X"],
        "interests": ["Python y análisis de datos", "Computación en la nube"],
        "relevance": "Catálogo oficial: validación oficial de conceptos clave de IA y servicios Azure AI.",
    },
    {
        "title": "Microsoft Certified: Azure Data Fundamentals (DP-900)",
        "provider": "Microsoft Learn",
        "url": "https://learn.microsoft.com/en-us/credentials/certifications/azure-data-fundamentals/",
        "skills": ["Azure", "Bases de datos relacionales", "NoSQL", "Analítica de datos"],
        "requirements": ["Fundamentos de bases de datos"],
        "cycles": ["V", "VI", "VII", "VIII", "IX", "X"],
        "interests": ["Bases de datos", "Ingeniería de datos"],
        "relevance": "Catálogo oficial: fundamentos de almacenamiento de datos relacional, no relacional y big data en Azure.",
    },
    {
        "title": "Microsoft Certified: Security, Compliance, and Identity Fundamentals (SC-900)",
        "provider": "Microsoft Learn",
        "url": "https://learn.microsoft.com/en-us/credentials/certifications/security-compliance-and-identity-fundamentals/",
        "skills": ["Azure", "Ciberseguridad", "Identidad", "Microsoft Entra"],
        "requirements": ["Fundamentos de redes e infraestructura"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Ciberseguridad", "Computación en la nube"],
        "relevance": "Catálogo oficial: principios de ciberseguridad, gestión de identidades y cumplimiento normativo.",
    },
    {
        "title": "Microsoft Certified: Power BI Data Analyst Associate (PL-300)",
        "provider": "Microsoft Learn",
        "url": "https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/",
        "skills": ["Power BI", "Modelado de datos", "DAX", "Visualización"],
        "requirements": ["Excel avanzado o conceptos de análisis de datos"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Python y análisis de datos", "Ingeniería de datos"],
        "relevance": "Catálogo oficial: diseño de modelos tabulares, visualización y paneles analíticos con Power BI.",
    },

    # Oracle University
    {
        "title": "Oracle Cloud Infrastructure Architect Associate",
        "provider": "Oracle University",
        "url": "https://learn.oracle.com/ols/learning-path/become-an-oci-architect-associate/163512/162234",
        "skills": ["OCI", "Arquitectura cloud", "Redes virtuales", "Seguridad"],
        "requirements": ["OCI Foundations"],
        "cycles": ["VIII", "IX", "X"],
        "interests": ["Computación en la nube"],
        "relevance": "Catálogo oficial: arquitectura, despliegue y migración de soluciones empresariales en OCI.",
    },
    {
        "title": "Java SE 11 Developer Complete Course",
        "provider": "Oracle University",
        "url": "https://learn.oracle.com/ols/home/big-data-java-and-database-learning-subscription/42305",
        "skills": ["Java", "POO", "Concurrencia", "JVM"],
        "requirements": ["Programación básica"],
        "cycles": ["V", "VI", "VII", "VIII", "IX", "X"],
        "interests": ["DevOps y CI/CD"],
        "relevance": "Catálogo oficial: formación completa oficial para la credencial Java SE 11 Developer.",
    },
    {
        "title": "Oracle AI Cloud Database Services Professional",
        "provider": "Oracle University",
        "url": "https://learn.oracle.com/ols/learning-path/become-an-oracle-ai-cloud-database-services-professional-2025/146553/148509",
        "skills": ["Oracle AI Database", "Servicios cloud", "SQL", "Administración cloud"],
        "requirements": ["Fundamentos de SQL y bases de datos relacionales"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Bases de datos", "Computación en la nube"],
        "relevance": "Catálogo oficial: administración de servicios Oracle AI Database en entornos cloud.",
    },

    # Google Cloud Skills Boost
    {
        "title": "Associate Cloud Engineer Learning Path",
        "provider": "Google Cloud Skills Boost",
        "url": "https://www.cloudskillsboost.google/paths/11",
        "skills": ["Google Cloud", "Compute Engine", "GKE", "VPC"],
        "requirements": ["Conocimientos de Linux y redes"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Computación en la nube", "DevOps y CI/CD"],
        "relevance": "Catálogo oficial: despliegue de soluciones, gestión de Kubernetes y operaciones en GCP.",
    },
    {
        "title": "Data Engineering on Google Cloud",
        "provider": "Google Cloud Skills Boost",
        "url": "https://www.cloudskillsboost.google/paths/16",
        "skills": ["Google Cloud", "BigQuery", "Dataflow", "Dataproc"],
        "requirements": ["SQL y fundamentos de procesamiento de datos"],
        "cycles": ["VIII", "IX", "X"],
        "interests": ["Ingeniería de datos", "Bases de datos"],
        "relevance": "Catálogo oficial: construcción de canalizaciones de procesamiento y almacenamiento analítico en BigQuery.",
    },
    {
        "title": "Google Cloud Cybersecurity Certificate Prep",
        "provider": "Google Cloud Skills Boost",
        "url": "https://www.cloudskillsboost.google/paths/21",
        "skills": ["Google Cloud", "IAM", "Seguridad de redes", "SIEM"],
        "requirements": ["Fundamentos de computación en la nube"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Ciberseguridad"],
        "relevance": "Catálogo oficial: diseño de controles de seguridad, gestión de accesos y monitorización en la nube.",
    },

    # DataCamp
    {
        "title": "Introduction to SQL for Data Science",
        "provider": "DataCamp",
        "url": "https://www.datacamp.com/courses/introduction-to-sql",
        "skills": ["SQL", "Consultas", "Filtrado", "Agregaciones"],
        "requirements": ["Sin requisitos previos"],
        "cycles": ["IV", "V", "VI", "VII", "VIII", "IX", "X"],
        "interests": ["Bases de datos", "Python y análisis de datos"],
        "relevance": "Catálogo oficial: consultas estructuradas, joins y agregaciones de bases de datos relacionales.",
    },
    {
        "title": "Machine Learning Scientist with Python",
        "provider": "DataCamp",
        "url": "https://www.datacamp.com/tracks/machine-learning-scientist-with-python",
        "skills": ["Python", "Scikit-Learn", "Modelos predictivos", "Feature Engineering"],
        "requirements": ["Python y análisis de datos"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Python y análisis de datos"],
        "relevance": "Catálogo oficial: construcción, evaluación y optimización de modelos supervisados y no supervisados.",
    },
    {
        "title": "Data Engineering Career Track",
        "provider": "DataCamp",
        "url": "https://www.datacamp.com/tracks/data-engineer-with-python",
        "skills": ["Python", "Pipelines ETL", "PySpark", "Airflow"],
        "requirements": ["Python intermedio y SQL"],
        "cycles": ["VIII", "IX", "X"],
        "interests": ["Ingeniería de datos", "DevOps y CI/CD"],
        "relevance": "Catálogo oficial: diseño de pipelines automatizados de datos y procesamiento distribuido.",
    },

    # MongoDB University
    {
        "title": "MongoDB Associate Database Administrator (DBA)",
        "provider": "MongoDB University",
        "url": "https://learn.mongodb.com/pages/mongodb-associate-database-administrator-exam",
        "skills": ["MongoDB", "Administración NoSQL", "Replicación", "Sharding"],
        "requirements": ["Bases de datos NoSQL"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Bases de datos"],
        "relevance": "Catálogo oficial: preparación y validación para administración de clusters y alta disponibilidad con MongoDB.",
    },
    {
        "title": "Node.js Developer Path with MongoDB",
        "provider": "MongoDB University",
        "url": "https://learn.mongodb.com/learning-paths/mongodb-nodejs-developer-path",
        "skills": ["MongoDB", "Node.js", "Express", "Mongoose"],
        "requirements": ["JavaScript básico"],
        "cycles": ["V", "VI", "VII", "VIII", "IX", "X"],
        "interests": ["Bases de datos", "DevOps y CI/CD"],
        "relevance": "Catálogo oficial: construcción de APIs y servicios backend usando Node.js y MongoDB Atlas.",
    },
    {
        "title": "MongoDB Data Modeling",
        "provider": "MongoDB University",
        "url": "https://learn.mongodb.com/courses/mongodb-data-modeling",
        "skills": ["MongoDB", "Modelado de datos", "Esquemas", "Patrones de diseño"],
        "requirements": ["Fundamentos de MongoDB"],
        "cycles": ["VI", "VII", "VIII", "IX", "X"],
        "interests": ["Bases de datos"],
        "relevance": "Catálogo oficial: modelado documental eficiente y patrones de esquema de alto rendimiento.",
    },

    # Grafana Labs
    {
        "title": "Prometheus Fundamentals with Grafana",
        "provider": "Grafana Labs",
        "url": "https://grafana.com/docs/learning-paths/prometheus/",
        "skills": ["Grafana", "Prometheus", "PromQL", "Métricas de infraestructura"],
        "requirements": ["Fundamentos de servidores y redes"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Observabilidad", "DevOps y CI/CD"],
        "relevance": "Catálogo oficial: monitoreo de infraestructura con Prometheus y visualización avanzada en Grafana.",
    },
    {
        "title": "Core Grafana Concepts",
        "provider": "Grafana Labs",
        "url": "https://grafana.com/docs/learning-paths/core-grafana-concepts/",
        "skills": ["Grafana", "Consultas", "Dashboards", "Alertas"],
        "requirements": ["Fundamentos de observabilidad"],
        "cycles": ["VIII", "IX", "X"],
        "interests": ["Observabilidad"],
        "relevance": "Ruta oficial: flujo desde fuentes y consultas hasta paneles, dashboards y alertas.",
    },

    # Neo4j GraphAcademy
    {
        "title": "Graph Data Science Fundamentals",
        "provider": "Neo4j GraphAcademy",
        "url": "https://graphacademy.neo4j.com/courses/gds-fundamentals/",
        "skills": ["Neo4j", "Graph Data Science", "Algoritmos de grafos", "Embeddings"],
        "requirements": ["Cypher y bases de datos"],
        "cycles": ["VIII", "IX", "X"],
        "interests": ["Grafos y conocimiento", "Python y análisis de datos"],
        "relevance": "Catálogo oficial: analítica avanzada y algoritmos predictivos sobre redes y grafos de conocimiento.",
    },
    {
        "title": "Cypher Intermediate Queries",
        "provider": "Neo4j GraphAcademy",
        "url": "https://graphacademy.neo4j.com/courses/cypher-intermediate-queries/",
        "skills": ["Neo4j", "Cypher", "Optimización de consultas", "Subconsultas"],
        "requirements": ["Neo4j Fundamentals"],
        "cycles": ["VI", "VII", "VIII", "IX", "X"],
        "interests": ["Grafos y conocimiento", "Bases de datos"],
        "relevance": "Catálogo oficial: escritura y optimización de consultas complejas en Cypher.",
    },

    # Snowflake University
    {
        "title": "Snowflake Data Fundamentals - Part 1",
        "provider": "Snowflake University",
        "url": "https://learn.snowflake.com/en/courses/spn-dfp1/",
        "skills": ["Snowflake", "OLTP", "OLAP", "Movimiento de datos"],
        "requirements": ["SQL y fundamentos de almacenes de datos"],
        "cycles": ["VII", "VIII", "IX", "X"],
        "interests": ["Ingeniería de datos", "Bases de datos"],
        "relevance": "Curso oficial: fundamentos de bases de datos, movimiento de datos y canalizaciones analíticas.",
    },

    # GitHub Skills
    {
        "title": "GitHub Actions: Automate Your Workflow",
        "provider": "GitHub Skills",
        "url": "https://learn.github.com/certification/ACTIONS",
        "skills": ["GitHub Actions", "CI/CD", "Automatización", "Workflows"],
        "requirements": ["Git básico y conceptos de testing"],
        "cycles": ["V", "VI", "VII", "VIII", "IX", "X"],
        "interests": ["DevOps y CI/CD"],
        "relevance": "Catálogo oficial: automatización de integración y entrega continua en entornos cloud.",
    },

    # Redis University
    {
        "title": "Redis Data Structures Deep Dive",
        "provider": "Redis University",
        "url": "https://university.redis.io/course/ru101/",
        "skills": ["Redis", "Estructuras de datos", "Caché", "Pub/Sub"],
        "requirements": ["Bases de datos y programación"],
        "cycles": ["VI", "VII", "VIII", "IX", "X"],
        "interests": ["Bases de datos"],
        "relevance": "Catálogo oficial: uso avanzado de estructuras en memoria para alta velocidad y caché.",
    },
)


def _scalar_id(connection, table: str, column: str, value: str):
    return connection.execute(
        sa.text(f"SELECT id FROM {table} WHERE {column} = :value"),
        {"value": value},
    ).scalar_one()


def upgrade():
    connection = op.get_bind()
    checked_on = date(2026, 11, 14)

    for course in COURSES_EXPANSION:
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

        for interest_name in course["interests"]:
            interest_id = connection.execute(
                sa.text("SELECT id FROM learning_interests WHERE name = :name"),
                {"name": interest_name},
            ).scalar_one_or_none()
            if interest_id is not None:
                connection.execute(
                    sa.text(
                        "INSERT INTO learning_offer_interests (id, offer_id, interest_id) "
                        "VALUES (:id, :offer_id, :interest_id) "
                        "ON CONFLICT (offer_id, interest_id) DO NOTHING"
                    ),
                    {"id": str(uuid4()), "offer_id": offer_id, "interest_id": str(interest_id)},
                )


def downgrade():
    connection = op.get_bind()
    for course in COURSES_EXPANSION:
        connection.execute(
            sa.text(
                "DELETE FROM learning_offer_interests WHERE offer_id IN ("
                "SELECT learning_offers.id FROM learning_offers "
                "JOIN learning_courses ON learning_courses.id = learning_offers.course_id "
                "WHERE learning_courses.source_url = :url)"
            ),
            {"url": course["url"]},
        )
        connection.execute(
            sa.text(
                "DELETE FROM learning_offers WHERE course_id IN ("
                "SELECT id FROM learning_courses WHERE source_url = :url)"
            ),
            {"url": course["url"]},
        )
        connection.execute(
            sa.text("DELETE FROM learning_courses WHERE source_url = :url"),
            {"url": course["url"]},
        )
