# Despliegue y recuperación

## Ambientes e infraestructura

El repositorio define desarrollo, staging y producción. Staging/producción necesitan un host Linux con Docker Compose, dominio DNS, acceso SSH y GitHub Environments separados. Caddy termina TLS usando el perfil staging en ambos ambientes. Backend y frontend se exponen por loopback; database permanece en red private sin puerto publicado.

| Ambiente | Archivo de ejemplo | Identidad | Condición |
|---|---|---|---|
| Desarrollo | .env.compose.example | Local sintética u OIDC | Datos sintéticos |
| Staging | .env.staging.example | Google OIDC | Host y dominio de ensayo |
| Producción | .env.production.example | Google OIDC | Aprobación, secretos y recuperación probada |

Variables de Environments: STAGING_DOMAIN/HOST/USER/PATH o PRODUCTION_DOMAIN/HOST/USER/PATH. Secretos: STAGING_SSH_KEY/STAGING_ENV_FILE y PRODUCTION_SSH_KEY/PRODUCTION_ENV_FILE. Las plantillas no son credenciales; archivos efectivos no se suben a Git. El archivo debe incluir PUBLIC_DOMAIN, identidad OIDC, secretos, origen CORS y cookies seguras. NEXT_PUBLIC_API_URL se fija durante build.

## Pipeline y verificación

Deploy staging despliega main y comprueba HTTPS y /ready. Deploy production acepta main, tags vX.Y.Z o ref manual permitida, conserva release anterior y aplica Alembic. La protección del Environment determina la aprobación externa; tener un workflow no demuestra que haya un host activo ni que la aprobación esté configurada.

Antes de promover, revisar CI, configuración, respaldo y compatibilidad de migraciones. Después, comprobar portada, readiness, inicio de sesión, permisos, registro, evidencia y snapshot con datos sintéticos. Registrar commit, dominio real, fecha y responsable. No ejecutar despliegue real para verificar documentación.

## Monitoreo disponible

Monitor production sondea HTTPS y readiness cada 15 minutos. La frecuencia corresponde al workflow versionado, y la disponibilidad exige conservar resultados y acordar ventana. Los logs estructurados correlacionan request_id; responsables y canales de alerta deben configurarse y probarse, evitando PII.

## Respaldo disponible y brechas

Backup production está programado diariamente a las 02:30 UTC (21:30 del día anterior en Lima). Ejecuta pg_dump de PostgreSQL, comprime el SQL con gzip y conserva 30 días en el host. Revisar su resolución de directorio de trabajo frente a current/compose.yaml antes de considerarlo operativo.

El workflow no respalda evidence-data, no demuestra cifrado de copia ni destino fuera del host. Una copia de base sola no recupera el expediente completo. Antes de datos reales, crear copia consistente de base y evidencia, manifiesto de hashes, cifrado, acceso restringido, destino separado y ensayo. RPO objetivo es 24 h y RTO objetivo 4 h; no se declaran medidos.

## Procedimiento propuesto de restauración

1. Identificar incidente, último corte recuperable y conjunto coherente de base/evidencias.
2. Preparar un ambiente de ensayo aislado, con configuración de la misma versión y sin usuarios reales conectados.
3. Verificar integridad de SQL y binarios contra el manifiesto de respaldo, sin imprimir datos nominales.
4. Restaurar PostgreSQL en la base descartable con el procedimiento autorizado y cargar el volumen de evidencia asociado.
5. Comprobar Alembic, conteos, FK, hashes, acceso temporal, sesiones y snapshot al corte recuperado.
6. Medir datos perdidos y tiempo total frente a RPO/RTO; registrar prueba y autorización antes de una restauración real.

Este procedimiento cubre el diseño de recuperación; no hay script completo de restore base/evidencia ensayado en el repositorio. Evitar comandos destructivos genéricos en producción y nunca usar down -v como restauración.

## Rollback de aplicación y release

Rollback production solicita una release y confirmación ROLLBACK, restaura código previo y verifica readiness. No revierte automáticamente datos, migraciones ni evidencia. Si una migración es incompatible, detener promoción y preparar migración correctiva o restauración autorizada. Probar el procedimiento con una release retenida en staging antes de confiar en él.

El workflow release valida pilot/acceptance.json con --strict y exige URL HTTPS real, roles, KPI contrastados y limitaciones. El ejemplo sintético no permite aprobar un piloto institucional. La documentación final FD05 conserva esta diferencia.
