# Pruebas y aceptación

## Verificación del repositorio

Ejecutar pruebas desde la raíz en base de datos sintética/descartable; no apuntar suites de migraciones a producción.

```bash
python -m pytest backend/tests
npm run lint --prefix dashboard-app
npm exec --prefix dashboard-app -- tsc --noEmit
npm run build --prefix dashboard-app
npm run test:e2e --prefix dashboard-app
python scripts/validate_docs.py
python scripts/validate_release.py
```

Para TypeScript y E2E también se puede entrar a dashboard-app y ejecutar npx tsc --noEmit y npm run test:e2e. Las suites configuran sus fixtures; se requiere instalar Chromium para Playwright según configuración del proyecto. CI valida además Compose, migraciones contra PostgreSQL, contratos y generación documental.

| Suite | Comportamiento verificado |
|---|---|
| test_auth | Provisión, local/OIDC, sesiones y permisos |
| test_roster | CSV válido/inválido, idempotencia, HMAC y atomicidad |
| test_certifications | Propiedad, fechas, duplicados, archivo, acceso temporal y corrección |
| test_validation | Transiciones, comentarios, decisiones e historial |
| test_etl | Normalización, calidad, hash, repetición y conservación del snapshot |
| test_analytics | Denominador, filtros, múltiples habilidades, cortes y ausencia de PII |
| test_database_migrations | Esquema, restricciones y reversibilidad en base de prueba |
| test_compose_configuration | Configuración de servicios y variables |
| E2E | Acceso y páginas por rol implementado |

## Evidencia de ejecución

Registrar comando, commit, entorno, fecha, resultado y fallas. La existencia de test no es resultado aprobado. Las pruebas locales SQLite no sustituyen el servicio PostgreSQL de CI; prueba sintética no sustituye autorización, acta ni medición institucional. Los resultados de esta reorganización se conservan en el [registro de validación](19-Registro-de-validacion.md).

## Aceptación del piloto

Antes de operación real se requieren padrón autorizado, responsables, fecha de corte y conciliación manual. La evidencia debe demostrar conciliación al menos 95%, contabilización de 100% de credenciales incluidas, aplicación de tres roles, contraste de KPI, URL HTTPS real y limitaciones. scripts/validate_release.py --strict impide aceptar placeholders, pero el archivo validado debe respaldarse por evidencia real.

Quedan pendientes mediciones de p95, disponibilidad institucional, accesibilidad completa, exportación PDF operativa, demanda externa y restauración conjunta. El SRS mantiene sus escenarios y prioridades. No cerrar esos requisitos solo por tener un workflow o botones visibles.
