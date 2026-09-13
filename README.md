# Pulse EPIS

<p align="center">
  <img src="dashboard-app/public/epis-logo.png" alt="Logo de la Escuela Profesional de Ingeniería de Sistemas de la UPT" width="180">
</p>

<p align="center">
  <strong>Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS</strong>
</p>

<p align="center">
  Aplicación de Inteligencia de Negocios para consolidar, validar y analizar las certificaciones obtenidas por estudiantes de la Escuela Profesional de Ingeniería de Sistemas de la Universidad Privada de Tacna.
</p>

[![CI](https://github.com/Kiara1616/pulse-epis/actions/workflows/ci.yml/badge.svg)](https://github.com/Kiara1616/pulse-epis/actions/workflows/ci.yml)

## Descripción

Pulse EPIS busca proporcionar información confiable para la toma de decisiones académicas y los procesos de acreditación. La solución permitirá integrar el padrón institucional de estudiantes con las certificaciones declaradas y validadas, calcular indicadores reproducibles y detectar tendencias o brechas de competencias tecnológicas.

El proyecto no pretende descubrir estudiantes mediante scraping de redes profesionales. La población deberá obtenerse de un padrón EPIS autorizado, mientras que cada certificación deberá contar con evidencia y un estado de validación antes de ingresar en los indicadores oficiales.

## Estado del proyecto

> **Prototipo en desarrollo.** El frontend y los documentos académicos ya cuentan con una base funcional. El backend dispone de una API FastAPI con health checks, OpenAPI, Google OIDC, sesiones y RBAC; los datos del dashboard todavía son demostrativos y la persistencia de negocio pertenece a los siguientes issues.

| Componente | Estado |
|---|---|
| Dashboard y navegación | Prototipo funcional con datos simulados |
| Roles principales | Interfaz para administrador, validador y estudiante |
| Documentos FD01–FD04 | Versionados en `docs/` |
| ETL | Pipeline reproducible desde la base operacional, con calidad e idempotencia |
| API backend | Base FastAPI con `/health`, `/ready`, OpenAPI y errores uniformes |
| Base de datos | Esquema PostgreSQL y migración inicial reversible; entorno pendiente |
| Autenticación institucional | Google OIDC, sesión firmada y RBAC backend; frontend aún usa selector de demo |
| CI | Workflow de PR para frontend, ETL, documentación y auditoría |
| Docker y despliegue | Planificados en el backlog |
| Despliegue público | Pendiente |

Consulta el [backlog del proyecto](https://github.com/Kiara1616/pulse-epis/issues) para conocer el avance y los criterios de aceptación.

## Funcionalidades previstas

- Autenticación con cuenta institucional y validación contra el padrón EPIS.
- Tres roles principales: administrador, validador y estudiante.
- Importación y conciliación del padrón por periodo académico.
- Registro de certificaciones y almacenamiento privado de evidencias.
- Flujo de observación, aprobación, rechazo y expiración.
- Indicadores por periodo, ciclo, cohorte, proveedor, nivel y tecnología.
- Análisis de cobertura, evolución y brechas de competencias.
- Exportaciones con filtros y fecha de corte.
- Auditoría de operaciones y decisiones de validación.
- Generación automática de diagramas y manuales desde el repositorio.

## Tecnologías

### Implementadas actualmente

| Capa | Tecnología | Uso |
|---|---|---|
| Frontend | Next.js 16 | Aplicación web y enrutamiento |
| Interfaz | React 19 y TypeScript | Componentes y lógica de presentación |
| Estilos | Tailwind CSS 4 | Sistema visual y diseño adaptable |
| Visualización | Recharts | Gráficos e indicadores |
| ETL | Python, SQLAlchemy y Alembic | Extracción operacional, normalización, calidad y publicación BI |
| API backend | FastAPI, Pydantic y Uvicorn | Servicio REST, health checks, OpenAPI, OIDC y RBAC |
| Persistencia inicial | SQLAlchemy, Alembic y PostgreSQL | Modelo operacional/analítico y migraciones versionadas |

### Arquitectura objetivo

| Capa | Tecnología prevista | Uso |
|---|---|---|
| API | FastAPI y Pydantic | Servicios REST, validación y OpenAPI |
| Persistencia | PostgreSQL | Datos operacionales, históricos y analíticos |
| Acceso a datos | SQLAlchemy y Alembic | ORM y migraciones versionadas |
| Identidad | Google OpenID Connect | Inicio de sesión institucional sin acceso a Gmail |
| Evidencias | Almacenamiento compatible con S3 | Archivos privados y acceso temporal |
| Pruebas | Pytest y Playwright | Pruebas del backend y recorridos web |
| Contenedores | Docker y Docker Compose | Entornos reproducibles |
| Automatización | GitHub Actions | Calidad, documentación y despliegue |
| Diagramas | Mermaid | Arquitectura como código |

Las tecnologías de la arquitectura objetivo se incorporarán mediante los issues y pull requests correspondientes; su inclusión en esta tabla no implica que ya estén implementadas.

## Arquitectura prevista

```mermaid
flowchart LR
    PADRON[Padrón EPIS autorizado] --> STAGING[Staging y calidad]
    EST[Portal del estudiante] --> API[API FastAPI]
    VAL[Portal del validador] --> API
    ADM[Portal del administrador] --> API
    API --> DB[(PostgreSQL)]
    API --> FILES[Almacenamiento privado]
    STAGING --> ETL[Pipeline ETL]
    DB --> ETL
    ETL --> BI[Modelo analítico]
    BI --> WEB[Dashboard Next.js]
```

## Estructura actual

```text
pulse-epis/
├── backend/
│   ├── app/                # API FastAPI: API, dominio, servicios y repositorios
│   ├── tests/              # Pruebas de API y ETL
│   ├── migrations/         # Migraciones Alembic reversibles
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── scripts_etl/        # Comando ETL reproducible
├── dashboard-app/
│   ├── public/             # Recursos gráficos institucionales
│   └── src/                # Aplicación Next.js
├── docs/
│   ├── 00-Problema-y-linea-base.md
│   ├── 01-Objetivos-medibles.md
│   ├── FD01-Informe-Factibilidad.md
│   ├── FD02-Informe-Vision.md
│   ├── FD03-EPIS-Informe Especificación Requerimientos.md
│   ├── FD04-EPIS-Informe Arquitectura de Software.md
│   ├── 06-Plantilla-padron.md
│   ├── 07-Certificaciones-evidencias.md
│   └── schemas/            # Contratos y especificaciones
├── .gitignore
└── README.md
```

La estructura seguirá evolucionando para incorporar migraciones, persistencia, diagramas, manuales, contenedores y workflows de despliegue.

## Ejecución actual del frontend

### Requisitos

- Node.js 20 o superior.
- npm 10 o superior.

### Instalación

```bash
git clone https://github.com/Kiara1616/pulse-epis.git
cd pulse-epis/dashboard-app
npm ci
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

### Comprobaciones disponibles

```bash
npm run lint
npm run build
```

## Ejecución de la API backend

### Requisitos

- Python 3.12 o superior.

### Instalación y ejecución

Desde la raíz del repositorio:

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS/Linux
# source .venv/bin/activate

pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

La API queda disponible en `http://localhost:8000`. Para consumirla desde el dashboard local, `PULSE_CORS_ALLOWED_ORIGINS` acepta por defecto `http://localhost:3000` y `http://127.0.0.1:3000`; en otros ambientes debe configurarse explícitamente. El frontend usa `NEXT_PUBLIC_API_URL` y por defecto apunta a `http://localhost:8000/api/v1`. Sus endpoints iniciales son:

| Ruta | Propósito |
|---|---|
| `GET /health` | Liveness del proceso |
| `GET /ready` | Readiness de las dependencias configuradas |
| `GET /api/v1/` | Metadatos de la instancia |
| `GET /api/v1/auth/google/login` | Inicia el flujo Google OIDC |
| `GET /api/v1/auth/google/callback` | Valida el código, el padrón y crea la sesión |
| `GET /api/v1/auth/me` | Devuelve identidad, rol y permisos de la sesión |
| `POST /api/v1/auth/logout` | Invalida la sesión actual |
| `POST /api/v1/padron/imports` | Carga un CSV del padrón para un periodo; requiere `PADRON_MANAGE` |
| `GET /api/v1/padron/imports?period_code=...` | Consulta el historial no nominal de cargas |
| `POST /api/v1/certifications` | Registra una certificación propia en estado `PENDING` |
| `GET /api/v1/certifications` | Lista las certificaciones del estudiante autenticado |
| `PATCH /api/v1/certifications/{id}` | Corrige una certificación `PENDING`, `OBSERVED` o `RESUBMITTED` |
| `POST /api/v1/certifications/{id}/evidence` | Adjunta una URL o evidencia privada validada |
| `POST /api/v1/certifications/{id}/evidence/{evidence_id}/access` | Genera un enlace temporal de evidencia |
| `GET /api/v1/validations` | Lista la bandeja de certificaciones para el validador al corte solicitado |
| `POST /api/v1/validations/{id}` | Ejecuta una transición autorizada de validación |
| `GET /api/v1/validations/{id}/history` | Consulta el historial inmutable de estados |
| `POST /api/v1/validations/{id}/evidence/{evidence_id}/access` | Genera un enlace temporal para revisar evidencia |
| `GET /docs` | Swagger UI generado por FastAPI |
| `GET /openapi.json` | Contrato OpenAPI |

La configuración no contiene secretos y usa variables con prefijo `PULSE_`. Se puede copiar [`.env.example`](backend/.env.example) a `.env` para configurar la base de datos, Google OIDC, la sesión y las evidencias privadas. Google solo solicita `openid email profile`; el backend además exige que la cuenta esté provisionada en `users` y, para `STUDENT`, vinculada a `students`. El dominio permitido es un filtro adicional, no prueba de pertenencia a EPIS. En producción se requiere un secreto de sesión y de acceso a evidencias aleatorios, cookies seguras y credenciales fuera del repositorio. La política de evidencias está en [`docs/07-Certificaciones-evidencias.md`](docs/07-Certificaciones-evidencias.md).

### Pruebas del backend

Desde la raíz del repositorio:

```bash
python -m pytest backend/tests
```

## Modelo y migraciones de base de datos

El [modelo de datos inicial](docs/05-Modelo-de-datos.md) cubre usuarios, estudiantes, periodos, matrículas, importaciones del padrón, rechazos, emisores, certificaciones, evidencias, validaciones, historial de estados, habilidades, auditoría y hechos analíticos. La [plantilla del padrón](docs/06-Plantilla-padron.md) documenta el CSV autorizado, [`docs/07-Certificaciones-evidencias.md`](docs/07-Certificaciones-evidencias.md) documenta el registro privado y [`docs/08-Validacion-certificaciones.md`](docs/08-Validacion-certificaciones.md) documenta la máquina de estados. Las migraciones se ejecutan con Alembic y pueden revertirse:

```bash
# Desde la raíz, con PULSE_DATABASE_URL apuntando a PostgreSQL
alembic -c backend/alembic.ini upgrade head
alembic -c backend/alembic.ini downgrade base
```

El test `backend/tests/test_database_migrations.py` crea el esquema desde cero, inserta datos sintéticos, verifica restricciones contra duplicados y ejecuta el rollback. En GitHub Actions se ejecuta contra un servicio PostgreSQL; localmente usa SQLite si no se define `PULSE_DATABASE_URL`.

## ETL de certificaciones

El ETL productivo lee las certificaciones, habilidades y matrículas autorizadas de la base operacional; no realiza búsquedas por correo ni llamadas simuladas a Credly. Cada ejecución calcula un SHA-256 determinista de la extracción, registra su estado en `etl_runs`, conserva rechazos sin PII en `etl_rejections` y reemplaza el snapshot de hechos solo dentro de una transacción completa.

Las reejecuciones con la misma fuente, periodo y fecha de corte devuelven la corrida existente. Los catálogos de emisores, habilidades y niveles se normalizan antes de cargar `fact_certification`. Una corrida con errores no toca el último snapshot publicado.

```bash
python -m venv backend/.venv

# Windows PowerShell
backend/.venv\Scripts\Activate.ps1

pip install -r backend/requirements.txt

# PULSE_DATABASE_URL debe apuntar a una base migrada con Alembic
$env:PULSE_DATABASE_URL = "postgresql+psycopg://pulse:pulse@localhost:5432/pulse_epis"
python -m backend.scripts_etl.main --period-code 2026-II --cutoff-date 2026-09-13
```

La ejecución programada está declarada en `.github/workflows/etl-scheduled.yml`. Requiere configurar el secreto `PULSE_DATABASE_URL` y las variables `ETL_PERIOD_CODE` y `ETL_CUTOFF_DATE`; también puede iniciarse manualmente desde GitHub Actions.

## Estrategia Docker

Docker será el mecanismo estándar para reproducir la solución completa en desarrollo, pruebas y despliegue. No sustituye las tecnologías del proyecto: empaqueta el frontend, la API y sus dependencias.

La composición prevista será:

```text
Docker Compose
├── frontend    Next.js
├── backend     FastAPI
├── database    PostgreSQL
└── storage     Servicio S3 compatible para desarrollo
```

Cuando se complete la [contenerización](https://github.com/Kiara1616/pulse-epis/issues/19), la aplicación podrá iniciarse con:

```bash
docker compose up --build
```

Actualmente este comando aún no está disponible porque los archivos Docker forman parte del trabajo pendiente.

## Automatización y despliegue

La documentación técnica se genera con un único comando desde la raíz:

```bash
pip install -r backend/requirements-dev.txt
cd docs/tooling && npm ci && cd ../..
python scripts/build_docs.py
```

El resultado queda en `artifacts/docs`: manuales HTML/PDF, diagramas Mermaid SVG, OpenAPI JSON/HTML y un manifiesto con el commit de origen. CI publica el directorio como el artefacto `project-manuals`.

El flujo objetivo del repositorio es:

```text
Issue → rama → pull request → revisión → CI → merge → despliegue
```

GitHub Actions deberá automatizar:

1. Lint, tipos, pruebas y build del frontend.
2. Validaciones y pruebas del backend y ETL.
3. Comprobación de migraciones y contratos de datos.
4. Generación de diagramas Mermaid.
5. Generación de OpenAPI y manuales técnicos.
6. Construcción de imágenes de contenedor.
7. Despliegue a staging y, con aprobación, a producción.
8. Publicación de reportes, diagramas y manuales como artefactos.

Consulta los issues de [integración continua](https://github.com/Kiara1616/pulse-epis/issues/8), [documentación automática](https://github.com/Kiara1616/pulse-epis/issues/18) y [despliegue público](https://github.com/Kiara1616/pulse-epis/issues/20).

## Gobierno del repositorio

El flujo de contribución, la convención de ramas, los commits, la plantilla de PR, los formularios de issues, CODEOWNERS y la Definition of Done están documentados en [CONTRIBUTING.md](CONTRIBUTING.md) y [Gobierno del repositorio](docs/REPOSITORY-GOVERNANCE.md). Cada cambio debe llegar mediante un PR vinculado a un issue y con revisión cruzada.

La protección efectiva de `main` y el bloqueo por checks de CI requieren permisos de administrador y se activarán junto con el workflow del [issue #8](https://github.com/Kiara1616/pulse-epis/issues/8). Mientras tanto, la política versionada sirve como guía obligatoria del proyecto.

## Plan académico

| Periodo | Entregables |
|---|---|
| Semana 1 | Título, problema sustentado y objetivos medibles |
| Semana 2 | FD01 Informe de Factibilidad y FD02 Informe de Visión |
| Semana 3 | FD03 SRS y FD04 SAD |
| Semanas 4–6 | Construcción, pruebas, documentación automática y despliegue público |

Los entregables están organizados mediante [milestones de GitHub](https://github.com/Kiara1616/pulse-epis/milestones).

## Flujo de contribución

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo completo. En resumen: seleccionar un issue, crear una rama independiente, implementar con pruebas, abrir un PR con `Closes #N`, solicitar revisión cruzada y fusionar únicamente cuando los criterios y verificaciones estén completos.

No deben subirse credenciales, tokens, padrones reales, correos personales ni evidencias de estudiantes al repositorio.

## Documentación

- [Problema, población y línea base](docs/00-Problema-y-linea-base.md)
- [Objetivos e indicadores medibles](docs/01-Objetivos-medibles.md)
- [FD01 — Informe de Factibilidad](docs/FD01-Informe-Factibilidad.md)
- [FD02 — Informe de Visión](docs/FD02-Informe-Vision.md)
- [FD03 — Especificación de Requisitos](docs/FD03-EPIS-Informe%20Especificación%20Requerimientos.md)
- [FD04 — Arquitectura de Software](docs/FD04-EPIS-Informe%20Arquitectura%20de%20Software.md)
- [Contribuir al proyecto](CONTRIBUTING.md)
- [Gobierno del repositorio](docs/REPOSITORY-GOVERNANCE.md)
- [Especificación del dashboard](docs/schemas/dashboard-spec.json)
- [Modelo de datos inicial](docs/05-Modelo-de-datos.md)
- [Manual de usuario por roles](docs/10-Manual-de-usuario.md)

## Equipo

- **Kiara Holly Zapana Murillo** — 2023077087
- **Vincenzo Rafael Lllanos Niño** — 2023076796

Proyecto académico de la Escuela Profesional de Ingeniería de Sistemas de la Universidad Privada de Tacna.

## Licencia

El repositorio todavía no declara una licencia de software. Hasta que se incorpore un archivo `LICENSE`, el código conserva los derechos de sus autores y no debe asumirse autorización de reutilización o redistribución.
