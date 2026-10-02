# Pulse EPIS

Pulse EPIS es una plataforma web de inteligencia de negocios para consolidar certificaciones tecnológicas verificadas de estudiantes de la EPIS de la Universidad Privada de Tacna. Relaciona padrón por periodo, credenciales, evidencia privada, revisión humana y snapshots reproducibles para acreditación y mejora curricular.

## Estado del proyecto

El frontend consume FastAPI y PostgreSQL; existen sesión local/OIDC, RBAC, importación de padrón, registro, evidencia privada, validación, ETL, indicadores, filtros y exportación CSV. La evolución compara cortes del mismo periodo y las brechas miden cobertura interna. El entorno local y las pruebas usan datos sintéticos.

No hay un cierre institucional aprobado: se requieren padrón autorizado, responsables, configuración externa y recuperación conjunta probada. Siguen pendientes PDF operativo, demanda laboral externa, perfil analítico independiente, vista pública y algunas operaciones de UI. El [SRS](docs/academico/FD03-Especificacion-Requerimientos.md) conserva el estado de cada requisito.

## Inicio local con Docker Compose

Requisitos: Git, Docker con Compose v2. Para desarrollar fuera de contenedores: Node.js 20+, npm y Python 3.12+.

```powershell
Copy-Item .env.compose.example .env
```

Reemplazar contraseñas y secretos de ejemplo antes de iniciar; la plantilla activa cuentas sintéticas locales solo en development.

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Portal: http://localhost:3000. API: http://localhost:8000. Swagger: http://localhost:8000/docs. Readiness: http://localhost:8000/ready. PostgreSQL no publica puertos al host. Las cuentas locales son admin@local.pulse-epis.test, validator@local.pulse-epis.test y student@local.pulse-epis.test; utilizan PULSE_LOCAL_AUTH_PASSWORD.

```bash
docker compose down
```

down conserva datos. down -v elimina base y evidencia local y no es un procedimiento de recuperación. La [guía de desarrollo](docs/proyecto/12-Desarrollo-local.md) explica API/frontend separados, migraciones, semilla, CORS y diagnóstico.

## Estructura

```text
pulse-epis/
  backend/                  API, servicios, migraciones, ETL y pruebas
  dashboard-app/            Portal Next.js conectado a la API
  deploy/                   Proxy HTTPS Caddy
  docs/
    academico/              FD01 a FD05 y cobertura de formatos del curso
    proyecto/               Fundamentos, manuales técnicos y operación
    recursos/               Contratos, plantilla sintética y migración
    tooling/                Dependencias y configuración documental
    catalogo.json           Inventario de fuentes generado y validado
  scripts/                  Generación y validación
  pilot/                    Contrato de evidencia y notas de release
  .github/workflows/        CI, despliegue, ETL, monitor, backup y release
  compose.yaml              Frontend, API, PostgreSQL y proxy por perfil
```

## Documentación y generación

El [índice documental](docs/README.md) separa [entregables del curso](docs/academico/README.md) y [documentación del proyecto](docs/proyecto/README.md). Las fuentes se versionan; el paquete HTML/PDF contiene diagramas reales, OpenAPI, recursos y manifiesto con hashes y commit. Las referencias NODIEX orientan los formatos, sin transferir sus cifras o resultados.

```bash
python -m pip install -r backend/requirements-dev.txt
npm ci --prefix docs/tooling
python scripts/validate_docs.py
python scripts/build_docs.py
python scripts/validate_docs.py --artifacts
```

Abrir artifacts/docs/index.html. Solo FD: python scripts/build_academic_pdfs.py. La [guía de generación](docs/proyecto/18-Generacion-documental.md) describe dependencias y artefactos. CI publica project-manuals y la release adjunta el paquete completo.

## Pruebas y operación

```bash
python -m pytest backend/tests
python scripts/validate_release.py
```

Frontend: desde dashboard-app ejecutar npm ci, npm run lint, npx tsc --noEmit, npm run build y npm run test:e2e con Chromium instalado. La [guía de pruebas](docs/proyecto/17-Pruebas-y-aceptacion.md) explica suites y límites de la verificación. Para PostgreSQL, configurar una base de prueba descartable: la suite de migraciones no debe apuntar a producción.

Staging y producción usan hosts y secretos externos separados. Los workflows no prueban por sí mismos operación activa. [Despliegue y recuperación](docs/proyecto/16-Despliegue-y-recuperacion.md) distingue backup de base, copia de evidencia, rollback de aplicación y restauración. La [seguridad](docs/proyecto/13-Autenticacion-y-seguridad.md) documenta proveedores, permisos y controles pendientes.

El ETL se ejecuta con python -m backend.scripts_etl.main --period-code y --cutoff-date, sobre una base migrada. Su [guía](docs/proyecto/14-ETL-y-calidad.md) describe idempotencia y calidad. El [contrato API](docs/proyecto/15-API-y-contratos.md) y el [diccionario](docs/proyecto/09-Diccionario-indicadores.md) definen campos y fórmulas actuales.

## Contribución equipo y licencia

Issue, rama, PR, revisión cruzada, CI y merge forman el flujo de [CONTRIBUTING.md](CONTRIBUTING.md) y [Gobierno del repositorio](docs/proyecto/REPOSITORY-GOVERNANCE.md). Actualizar requisitos, manuales y contratos al cambiar comportamiento. No subir secretos, padrones reales, códigos, correos ni evidencias privadas.

Equipo: Kiara Holly Zapana Murillo (2023077087) y Vincenzo Rafael Lllanos Niño (2023076796). Proyecto del curso Inteligencia de Negocios, Universidad Privada de Tacna. El repositorio no declara LICENSE; no se atribuye una licencia o transferencia de derechos no acordada.
