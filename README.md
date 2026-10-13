<div align="center">
  <img src="https://raw.githubusercontent.com/Kiara1616/pulse-epis/main/dashboard-app/public/epis-logo.png" alt="Pulse EPIS" width="88">
  <h1>Pulse EPIS</h1>
  <p><strong>De las credenciales verificadas a nuevas oportunidades de formación.</strong></p>
  <p>Gestión de certificaciones, seguimiento de competencias e información para la toma de decisiones.</p>
  <p><a href="https://pulse-epis.onrender.com/"><strong>Acceder a Pulse EPIS</strong></a></p>
</div>

---

Pulse EPIS es una plataforma web que conecta el registro de certificaciones tecnológicas con su validación, el análisis de cobertura y la gestión de oportunidades de formación. Está orientada a la Escuela Profesional de Ingeniería de Sistemas de la Universidad Privada de Tacna.

Su propósito es ofrecer una visión trazable del avance formativo: cada credencial conserva su evidencia y sus decisiones de revisión, mientras los indicadores permiten explorar resultados agregados por periodo y fecha de corte.

## Valor para la comunidad

- **Para estudiantes:** un espacio para registrar logros, atender observaciones, definir intereses y solicitar participación en talleres.
- **Para validadores:** una bandeja de trabajo con filtros, evidencias privadas e historial de decisiones.
- **Para administradores:** herramientas para organizar el padrón, publicar indicadores y gestionar cursos, oportunidades y talleres.

Las brechas expresan ausencia de evidencia aprobada dentro de la cobertura analizada; no constituyen una evaluación de conocimientos. Las oportunidades publicadas forman un catálogo general y no una recomendación personalizada.

## Capacidades principales

| Área | Funcionalidad |
|---|---|
| Certificaciones | Registro, consulta, corrección y reenvío de credenciales propias. |
| Revisión | Aprobación, observación y rechazo mediante transiciones controladas y comentarios. |
| Evidencias | Archivos privados y acceso temporal autorizado para consulta. |
| Analítica | Indicadores agregados, filtros, evolución entre cortes y exportación CSV. |
| Gestión de datos | Importación de padrón, controles de calidad y publicación reproducible por periodo. |
| Formación | Preferencias persistentes, rutas publicadas y catálogo de oportunidades. |
| Talleres | Oferta, solicitudes, decisiones con motivo y control de cupos al aceptar. |
| Acceso | Sesiones autenticadas y autorización aplicada en el backend según el rol. |

## Un recorrido conectado

1. El estudiante registra una certificación y adjunta su evidencia.
2. El validador revisa el envío y registra una decisión. Las observaciones orientan la corrección.
3. El estudiante consulta su estado y actualiza sus preferencias de formación.
4. El administrador revisa y publica oportunidades, y abre talleres asociados.
5. El estudiante solicita participar y consulta la decisión registrada.

La solicitud no reserva un cupo: la aceptación se valida en el backend. Las certificaciones aprobadas pueden alimentar los indicadores mediante el proceso de publicación correspondiente.

## Arquitectura

| Componente | Tecnología y responsabilidad |
|---|---|
| Portal web | Next.js, React y TypeScript: experiencias diferenciadas por rol. |
| API | FastAPI y Python: contratos, autorización y reglas de negocio. |
| Persistencia | PostgreSQL y SQLAlchemy: datos operativos y trazabilidad. |
| Migraciones | Alembic: evolución versionada del esquema. |
| Calidad y analítica | Procesos ETL: validación y generación de cortes reproducibles. |
| Verificación | Pytest, Playwright y GitHub Actions: pruebas y controles de integración. |

## Probar en local

Se requieren Git y Docker con Compose v2. Para desarrollo sin contenedores, consultar la [guía de desarrollo local](docs/proyecto/12-Desarrollo-local.md).

**1. Preparar la configuración**

Copiar `.env.compose.example` como `.env` y reemplazar las contraseñas y secretos de ejemplo.

```powershell
Copy-Item .env.compose.example .env
```

**2. Iniciar los servicios**

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

| Servicio | Dirección local |
|---|---|
| Portal | [localhost:3000](http://localhost:3000) |
| Documentación interactiva de la API | [localhost:8000/docs](http://localhost:8000/docs) |
| Disponibilidad de la API | [localhost:8000/ready](http://localhost:8000/ready) |

La configuración de desarrollo habilita cuentas sintéticas para recorrer los tres roles:

| Rol | Cuenta local |
|---|---|
| Administrador | `admin@local.pulse-epis.test` |
| Validador | `validator@local.pulse-epis.test` |
| Estudiante | `student@local.pulse-epis.test` |

La contraseña se define en `PULSE_LOCAL_AUTH_PASSWORD`. Estas cuentas son exclusivas del entorno local y no representan personas reales.

Para detener los servicios conservando los datos:

```bash
docker compose down
```

## Calidad y verificación

El repositorio incluye pruebas unitarias, de API, de permisos y de interfaz. El recorrido integral también se ejecuta en navegador con sesiones reales y una base temporal de datos sintéticos.

```bash
python -m pip install -r backend/requirements-dev.txt
python -m pytest backend/tests
```

Desde `dashboard-app`:

```bash
npm ci
npx playwright install chromium
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
npx playwright test --config playwright.real.config.ts
```

Las suites de migraciones y concurrencia requieren una base PostgreSQL de pruebas. La configuración y los límites de cada verificación se describen en la [guía de pruebas y aceptación](docs/proyecto/17-Pruebas-y-aceptacion.md).

## Documentación

- [Manual de usuario](docs/proyecto/10-Manual-de-usuario.md): recorridos y acciones de cada rol.
- [API y contratos](docs/proyecto/15-API-y-contratos.md): interfaces y reglas de integración.
- [Autenticación y seguridad](docs/proyecto/13-Autenticacion-y-seguridad.md): identidad, permisos y protección de evidencias.
- [ETL y calidad](docs/proyecto/14-ETL-y-calidad.md): procesamiento y publicación de indicadores.
- [Despliegue y recuperación](docs/proyecto/16-Despliegue-y-recuperacion.md): ambientes, respaldos y restauración.
- [Índice de documentación](docs/README.md): especificaciones y referencias del proyecto.

## Alcance y despliegue

**Proyecto desplegado:** [pulse-epis.onrender.com](https://pulse-epis.onrender.com/).

Las funcionalidades descritas están implementadas y cuentan con pruebas automatizadas. La demostración utiliza datos sintéticos; la puesta en operación institucional requiere datos autorizados, configuración de identidad, responsables y validación de recuperación.

El repositorio incluye configuración para Docker Compose y Render. El [manual de producción y aceptación](docs/12-Produccion-y-aceptacion.md) detalla los requisitos de publicación. Los informes de prueba no equivalen a una aceptación institucional ni acreditan disponibilidad de un servicio público.

## Equipo y contribución

Desarrollado por **Kiara Holly Zapana Murillo** y **Vincenzo Rafael Lllanos Niño**.

Las contribuciones se gestionan mediante issues, ramas, pull requests, revisión y CI. Consulta [CONTRIBUTING.md](CONTRIBUTING.md) y el [gobierno del repositorio](docs/proyecto/REPOSITORY-GOVERNANCE.md). Los cambios deben mantener actualizados los contratos y manuales, y utilizar datos sintéticos en pruebas y capturas.

El repositorio no declara actualmente una licencia de distribución.
