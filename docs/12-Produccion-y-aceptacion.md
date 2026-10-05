# Producción y aceptación del piloto

## Estado verificable

Las issues #21 y #22 tienen implementación técnica, pero su cierre requiere
comprobar el hosting real, Google OIDC y la aceptación del piloto público.
`pilot/synthetic-report.json` contiene el resultado del recorrido automatizado:
20 estudiantes conciliados (100 %), dos credenciales aprobadas contabilizadas
(100 %), una rechazada excluida y cobertura contrastada de 5 %.
El proveedor Google se sustituye solamente en pruebas. Este resultado no
demuestra autorización institucional, login real ni disponibilidad pública.

## Publicación en Render sin comprar un dominio

El archivo [`render.yaml`](../render.yaml) crea un servicio Docker que aloja
Next.js, FastAPI y Nginx en un mismo origen HTTPS, PostgreSQL administrado y un
disco privado para evidencias. Render asigna el subdominio `onrender.com`;
se debe copiar la URL realmente asignada, sin asumir un nombre disponible.

1. En Render, conectar GitHub y seleccionar **New → Blueprint** con este
   repositorio, rama `main` y archivo `render.yaml`, después del merge del PR.
2. Revisar el costo mostrado: esta configuración utiliza recursos **de pago**.
   El plan gratis no conserva archivos locales y su PostgreSQL expira a los
   30 días; no satisface la operación durable requerida por la issue #21.
3. Proporcionar `PULSE_GOOGLE_CLIENT_ID` y `PULSE_GOOGLE_CLIENT_SECRET` mediante
   los campos secretos del proveedor. Los secretos de sesión, pseudónimos y
   evidencia se generan automáticamente. Nunca copiarlos en issues o commits.
4. Crear en Google Cloud un cliente OAuth de aplicación web con scopes
   `openid email profile`. Registrar como callback la URL asignada seguida de
   `/api/v1/auth/google/callback`. Autorizar los usuarios de prueba si el
   consentimiento OAuth aún está en modo testing.
5. El arranque normaliza la URL PostgreSQL al driver `psycopg`, configura los
   redirects a partir de `RENDER_EXTERNAL_URL`, migra la base y escucha en
   `PORT`. `/api/v1` utiliza el mismo origen del frontend; evita cookies entre
   dominios y configuraciones manuales de CORS.
6. Provisionar el periodo y las cuentas autorizadas ADMIN y VALIDATOR; importar
   el padrón autorizado para provisionar STUDENT. La autenticación Google por
   sí sola no concede pertenencia a EPIS. No habilitar el seed local en producción.
7. Verificar `/`, `/ready`, login de los tres roles, evidencias y exportaciones.
   Conservar enlaces de ejecución y resultados agregados del piloto.

Guías oficiales: [web services](https://render.com/docs/web-services),
[Blueprints](https://render.com/docs/blueprint-spec),
[límites gratuitos](https://render.com/docs/free).

## Despliegue aprobado desde GitHub

El environment `production` debe exigir aprobación de un integrante distinto
del autor y aceptar solo la rama `main` o tags `v*.*.*`. La protección efectiva
se consulta en Settings → Environments; no basta declararla en un YAML.

En Render, mantener Auto Deploy desactivado. Guardar el Deploy Hook como
`RENDER_DEPLOY_HOOK_URL` en los secretos del environment `production`; guardar
la URL pública como variable `PRODUCTION_PUBLIC_URL`. Ejecutar **Deploy Render
production** desde `main` con el ref deseado. El workflow exige CI exitoso y
solicita el commit exacto. El artefacto de la solicitud no certifica que el
despliegue terminó: comprobar el estado Live y el commit en Render antes de
firmar la aceptación. [Deploy hooks](https://render.com/docs/deploy-hooks).

Staging debe usar recursos, credenciales Google y secretos propios, con
`PULSE_ENVIRONMENT=staging`. Nunca conectar un staging a la base productiva.

## Monitoreo, respaldo y restauración en Render

El health check `/ready` forma parte del Blueprint. Tras publicar, guardar la
URL en la variable del repositorio `PRODUCTION_PUBLIC_URL` y habilitar
`PRODUCTION_MONITOR_ENABLED=true` para el monitor externo de GitHub Actions.
No activar los workflows SSH si se utiliza Render.

PostgreSQL de pago incluye recuperación a un punto en el tiempo. Para el
simulacro, crear una instancia recuperada, contrastar las cantidades y el
snapshot de KPIs y registrar la fecha y el resultado antes de cambiar la
conexión. Render permite validar la instancia recuperada en aislamiento.
Restaurar también un snapshot del disco en un entorno de prueba y comprobar
los hashes de los archivos; restaurar solo PostgreSQL no recupera evidencias.
Los backups deben almacenarse fuera del servicio activo y permanecer privados.
[Recuperación PostgreSQL](https://render.com/docs/postgresql-backups).

Para rollback, seleccionar un despliegue previo exitoso en Render → Deploys →
Rollback; comprobar después `/ready`, `/` y los roles. Esto revierte código,
no los datos del disco ni las migraciones. Una migración incompatible requiere
un plan específico y un respaldo previo. Registrar los IDs del despliegue de
origen y destino y el resultado. [Rollback](https://render.com/docs/rollbacks).

## Alternativa: servidor Linux con Compose

Los workflows SSH usan los secretos separados del environment `production`:
`PRODUCTION_SSH_KEY`, `PRODUCTION_KNOWN_HOSTS` (identidad SSH verificada por otro
canal) y `PRODUCTION_ENV_FILE`, y las variables `PRODUCTION_HOST`,
`PRODUCTION_USER`, `PRODUCTION_PATH` y `PRODUCTION_DOMAIN`.
Las tareas programadas SSH permanecen desactivadas hasta configurar
`PRODUCTION_ENABLED=true` como variable del repositorio.

`deploy/operations.sh` emplea el archivo Compose de `current/`, un único nombre
de proyecto y un lock compartido. El respaldo contiene el dump PostgreSQL y
las evidencias privadas, hashes de integridad y retención de 30 días.
`verify-backup` restaura PostgreSQL en una base temporal y archivos en un
directorio temporal; conserva intactos los datos activos y rechaza backups
corruptos antes de restaurar. `rollback` valida el nombre de release, reconstruye
la revisión seleccionada y recupera la anterior si falla el arranque.

```bash
bash deploy/operations.sh backup /srv/pulse-epis
bash deploy/operations.sh verify-backup /srv/pulse-epis pulse-AAAAMMDDTHHMMSSZ-PID
bash deploy/operations.sh rollback /srv/pulse-epis previous-AAAAMMDDHHMMSS
```

El backup debe copiarse además a almacenamiento privado fuera del host: la
retención local no cubre la pérdida total del servidor. No ejecutar una
restauración destructiva sobre producción para demostrar el simulacro.

## Verificación reproducible

```bash
python -m pytest backend/tests
docker build -f deploy/render/Dockerfile -t pulse-epis-completion:verify .
python scripts/smoke_operations.py
python scripts/validate_release.py
python scripts/validate_release.py --strict
```

La última orden **debe fallar mientras la aceptación pública está pendiente**.
No es un fallo de CI: evita publicar una release con una URL o resultados
inventados. El piloto se reproduce con `PULSE_PILOT_REPORT` apuntando a un
archivo de artefactos y `pytest backend/tests/test_pilot.py`.

## Publicar v1.0.0

Actualizar `pilot/acceptance.json` con la URL pública real, `acceptance_status`
igual a `accepted`, verificaciones de Google OIDC, despliegue, documentos,
rollback y restauración exitosas, y enlaces de CI, despliegue y aceptación.
Conservar la distinción entre piloto sintético y evidencia institucional.
Tras revisión cruzada, CI exitoso y aceptación registrada, crear el tag
`v1.0.0` sobre el commit aceptado. Publish release valida la evidencia estricta
y genera manuales, diagramas y OpenAPI antes de publicar en GitHub.
