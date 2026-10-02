# Gobierno del repositorio

## Propósito

Pulse EPIS utiliza issues, ramas, pull requests y revisiones para mantener trazabilidad entre necesidades académicas, cambios de código y evidencias de validación.

## Archivos de gobierno

| Archivo | Función |
|---|---|
| `CONTRIBUTING.md` | Flujo de trabajo, ramas, commits, PR y Definition of Done |
| `.github/PULL_REQUEST_TEMPLATE.md` | Información y checklist obligatorios en cada PR |
| `.github/ISSUE_TEMPLATE/*.yml` | Formularios estructurados para bugs, funcionalidades y documentación |
| `.github/CODEOWNERS` | Revisión automática de los dos integrantes del proyecto |
| `.github/branch-protection.json` | Política reproducible aplicada a la rama `main` mediante la API de GitHub |
| `.github/ISSUE_TEMPLATE/config.yml` | Deshabilita issues sin estructura y enlaza el backlog |

## Política de ramas

- `main` es la rama de integración y no recibe pushes directos.
- Cada issue se trabaja en una rama independiente: `issue-<N>-<slug>` o un prefijo equivalente (`feat`, `fix`, `docs`, `chore`).
- Un PR no debe mezclar issues no relacionados.
- Las ramas se eliminan después del merge si no contienen trabajo pendiente.
- No se permite `force push` sobre `main`.

## Política de pull requests

Cada PR debe incluir:

1. `Closes #N` o `Refs #N`.
2. Resumen, alcance fuera del PR y riesgos.
3. Pruebas ejecutadas con resultado.
4. Capturas/GIF para cambios de UI, o `No aplica` justificado.
5. Migraciones, datos afectados y rollback cuando corresponda.
6. Revisión cruzada del otro integrante.

La plantilla no reemplaza una regla de GitHub: la aprobación y los checks deben ser requisitos de la rama protegida.

## Configuración requerida para un administrador

La cuenta que administra `Kiara1616/pulse-epis` debe abrir **Settings → Branches → Add branch protection rule** para `main` y activar:

- Require a pull request before merging.
- Require at least 1 approving review.
- Dismiss stale pull request approvals when new commits are pushed.
- Require review from Code Owners.
- Require conversation resolution before merging.
- Require status checks to pass before merging: `frontend`, `backend` y `docs` del workflow de [#8 — CI](https://github.com/Kiara1616/pulse-epis/issues/8).
- Restrict force pushes y branch deletion.
- Mantener los administradores sujetos a las reglas cuando la política institucional lo permita.

No se deben escribir nombres de checks inexistentes como obligatorios: primero se implementa #8, se observa el nombre exacto de cada job y luego se selecciona en la protección de `main`.

## Aplicación y auditoría de la protección

Un administrador puede aplicar de forma reproducible la política versionada con:

```bash
gh api --method PUT repos/Kiara1616/pulse-epis/branches/main/protection \
  --input .github/branch-protection.json
```

La comprobación posterior se realiza con `gh api repos/Kiara1616/pulse-epis/branches/main/protection`. La respuesta debe declarar una aprobación, revisión de CODEOWNERS, descarte de aprobaciones obsoletas, resolución de conversaciones y los checks `frontend`, `backend` y `docs`.

## Estado verificado el 13/09/2026

- Repositorio público: `Kiara1616/pulse-epis`.
- Rama por defecto: `main`.
- Colaboradores confirmados: `Kiara1616` y `Vinny-13`.
- El workflow `.github/workflows/ci.yml` ejecuta `frontend`, `backend` y `docs` en PR/push a `main`.
- CI publica `backend-coverage` y `project-manuals` como artefactos.
- La política versionada exige PR, revisión cruzada de CODEOWNERS, aprobación posterior al último push, conversaciones resueltas y CI exitoso.
- Los pushes forzados y la eliminación de `main` permanecen deshabilitados; las reglas también aplican a administradores.

## Definition of Done del repositorio

Un issue puede cerrarse cuando su PR:

- cumple los criterios del issue;
- pasa las verificaciones aplicables;
- contiene evidencia y revisión cruzada;
- referencia el issue correctamente;
- actualiza documentación o contratos afectados;
- no introduce secretos, PII o datos institucionales reales;
- deja un rollback razonable si modifica datos, despliegue o migraciones.
