# Contribuir a Pulse EPIS

Gracias por contribuir al dashboard de certificaciones de la EPIS. Este documento define el flujo mínimo para que cada cambio sea trazable, revisable y reproducible.

## Antes de comenzar

1. Selecciona o crea un issue con objetivo, alcance y criterios de aceptación.
2. Comprueba que no exista otra rama o PR trabajando el mismo alcance.
3. Crea la rama desde `origin/main` y vincúlala al issue.
4. No uses datos reales del padrón, correos personales, certificados ni secretos en el repositorio.

## Convención de ramas

Usa una rama por issue y no trabajes directamente sobre `main`:

```text
issue-<numero>-<slug>
feat/<numero>-<slug>
fix/<numero>-<slug>
docs/<numero>-<slug>
chore/<numero>-<slug>
```

Ejemplos: `issue-12-importar-padron`, `feat/14-validacion-certificaciones` y `docs/7-gobierno-repositorio`.

## Commits

Se recomienda Conventional Commits:

```text
<tipo>(<alcance opcional>): <descripcion en imperativo>
```

Tipos permitidos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore` y `ci`.

Ejemplos:

```text
docs: completar especificación de requisitos
feat(api): validar carga del padrón por periodo
test(etl): cubrir deduplicación de credenciales
```

Cada commit debe ser pequeño, compilable cuando sea posible y explicar una sola intención.

## Pull requests

Todo PR debe:

- apuntar a `main` desde una rama de issue;
- incluir `Closes #N` o `Refs #N` en el cuerpo;
- resumir qué cambió y qué queda fuera del alcance;
- reportar comandos de prueba y sus resultados;
- incluir capturas o GIF cuando cambia la interfaz; para documentación o backend, indicar `No aplica` y explicar por qué;
- describir riesgos, migraciones, datos afectados y plan de rollback cuando correspondan;
- solicitar revisión cruzada al otro integrante antes del merge;
- conservar el checklist de la plantilla de PR;
- no incluir secretos, PII, padrones reales ni evidencias de estudiantes.

El PR debe recibir al menos una aprobación de un colaborador distinto del autor. Los conflictos se resuelven en la rama del PR y se vuelven a ejecutar las verificaciones antes de fusionar.

## Pruebas locales

Para el frontend actual:

```bash
cd dashboard-app
npm ci
npm run lint
npm run build
```

Cuando se incorporen backend, base de datos y documentación automática, el PR debe ejecutar también las comprobaciones descritas en el workflow de CI y en el issue correspondiente. No se debe marcar una prueba como exitosa si solo se revisó visualmente.

## Definition of Done

Un cambio está terminado cuando:

- los criterios de aceptación del issue están cubiertos o tienen una excepción documentada;
- el código, documentación, contratos y migraciones afectados están actualizados;
- lint, tipos, pruebas y build aplicables pasan;
- los permisos y datos nominales fueron revisados;
- la evidencia del cambio está en el PR;
- existe revisión cruzada aprobada;
- CI está exitoso y configurado como requisito de `main`;
- el PR referencia el issue y tiene una decisión de rollback si el cambio puede fallar;
- no quedan archivos temporales, artefactos generados o secretos.

## Datos y seguridad

Usa datos sintéticos o anonimizados. El padrón EPIS, códigos, correos, documentos y enlaces privados no se copian al repositorio, issues, logs, capturas ni artefactos públicos. Si un caso necesita datos sensibles, descríbelo con fixtures ficticios y registra la revisión de privacidad.

## Reglas de `main`

`main` debe recibir cambios únicamente mediante PR. La configuración exacta de protección, revisiones, CODEOWNERS y checks se encuentra en [Gobierno del repositorio](docs/REPOSITORY-GOVERNANCE.md). La protección de la rama requiere permisos de administrador de GitHub y no puede activarse desde una cuenta sin ese permiso.
