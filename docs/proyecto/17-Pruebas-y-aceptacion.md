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

## VA-14: evidencia del recorrido persistente por API

#80 incorpora `backend/tests/test_learning_complete_flow.py`: utiliza sesiones locales reales, servicios y una base SQLite aislada, sin reemplazar identidad ni llamadas por fixtures. Recorre registrar credencial y evidencia privada → iniciar revisión y aprobar → consultar credencial aprobada → actualizar ruta/intereses propios → crear y revisar curso → publicar oportunidad → abrir taller → solicitar participación → aceptar con cupo. Una nueva sesión consulta preferencias/solicitud persistidas y disponibilidad actualizada. Se verifica que VALIDATOR no administra solicitudes y STUDENT no consulta auditoría administrativa.

Una prueba adicional congela tiempos iguales para eventos consecutivos. append_status_history conserva una hora estrictamente creciente por credencial: si el reloj empata o retrocede respecto del evento anterior, incrementa un microsegundo sobre el máximo previo. Los callers de mutación mantienen el bloqueo de la credencial; también se consideran eventos pendientes de flush. No se cambian fechas de corte, permisos, decisiones ni registros históricos; los empates antiguos no se reconstruyen. Esto corrige el fallo local previamente documentado en #81 al ordenar nuevas decisiones por hora y UUID.

#77 y #78 prueban esquema y API, incluyendo aceptación simultánea en PostgreSQL. Este recorrido HTTP **no equivale al cierre visual del producto**. #79 sigue pendiente de conectar intereses, oportunidades y solicitudes a las pantallas. #69/#70/#71/#74/#76 y sus integraciones requieren revisión conjunta. Las capturas de los prototipos #83/#84 no prueban persistencia visual. La aceptación E2E de navegador, capturas integradas y aprobación de ambos integrantes siguen pendientes antes de cerrar #80.

Comandos: `python -m pytest backend/tests -q`; `LEARNING_TEST_DATABASE_URL` sobre una base PostgreSQL de pruebas para `test_learning_api.py`; `npm run lint`, `npx tsc --noEmit` y `npm run build` para regresión del frontend existente. No desplegar ni publicar release a partir de esta evidencia parcial. Rollback: revertir la corrección de historial y el test; no modifica datos ni requiere otra migración aparte de #77. Antes de revertir #77, respaldar las tablas nuevas y seguir su downgrade documentado.

Informe reproducible: ejecutar `LEARNING_FLOW_REPORT` con una ruta de salida de pruebas junto a `test_learning_complete_flow.py` exporta un resumen solo si el escenario concluye con sus aserciones aprobadas. Se conserva un [informe sintético](../recursos/learning-flow-report.json) y una [captura de evidencia HTTP](../recursos/imagenes/va80-http-evidence-demo.png). La captura representa resultados de prueba, no una pantalla integrada del producto ni una aprobación institucional.

## VA-14: navegador con API y sesiones reales

Desde `dashboard-app`, ejecutar `npx playwright test --config playwright.real.config.ts` después de instalar dependencias frontend y `backend/requirements.txt`, y Chromium. La configuración levanta frontend en 3080 y API en 8080; exige puertos libres y no reutiliza servicios externos. `scripts/browser_flow_server.py` crea una base SQLite y evidencias temporales, con usuarios locales sintéticos, y las elimina al terminar.

La prueba de `e2e-real/complete-flow.spec.ts` recorre las pantallas de estudiante, validador y administrador sin mocks de red o identidad. Solo provisiona intereses y rutas por la API real porque no tienen pantalla administrativa. Verifica registro con evidencia, aprobación, perfil aprobado, preferencias, publicación, apertura de taller, solicitud, aceptación y consulta desde otra sesión. CI ejecuta este escenario además de las suites existentes y conserva trazas y capturas como artefactos.

Capturas sintéticas del escenario: [participación](../recursos/imagenes/va80-browser-participation.png) y [perfil](../recursos/imagenes/va80-browser-profile.png). Son pantallas de la aplicación conectadas al entorno de prueba; no representan usuarios ni datos institucionales. La aprobación conjunta de Vinny y Kiara sigue siendo requisito antes del merge y cierre de #80.
