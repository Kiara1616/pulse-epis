# Diccionario de indicadores

Los indicadores se calculan exclusivamente desde el último snapshot ETL publicado para el periodo y la fecha de corte solicitados. Nunca se exponen códigos, correos ni identificadores de estudiantes.

| ID | Indicador | Fórmula | Filtros |
|---|---|---|---|
| `active_students` | Estudiantes activos | Estudiantes distintos con matrícula `ACTIVE` | periodo, corte, cohorte, ciclo |
| `certified_students` | Estudiantes certificados | Estudiantes activos distintos con al menos una certificación `APPROVED` | todos |
| `coverage_percent` | Cobertura | `certified_students / active_students * 100` | todos |
| `approved_certifications` | Certificaciones aprobadas | Certificaciones distintas con estado `APPROVED` | todos |
| `expiring_soon` | Próximas a vencer | Certificaciones aprobadas que vencen entre el corte y los siguientes 90 días | todos |

`GET /api/v1/indicators/overview` acepta `period_code`, `cutoff_date`, `cohort`, `cycle`, `issuer` y `level`. Si se omite la fecha de corte se selecciona la más reciente publicada. `GET /api/v1/indicators/dictionary` expone estas definiciones como contrato legible por máquina.

Una certificación asociada a varias habilidades cuenta una sola vez en el KPI, aunque aparece una vez por habilidad en `by_skill`. El porcentaje retorna `0` cuando el denominador es cero.

`evolution` presenta estudiantes certificados y certificaciones aprobadas para cada corte publicado. `skill_gaps` expresa la brecha interna de cobertura como estudiantes activos menos estudiantes certificados por habilidad; no representa demanda laboral externa hasta que exista una fuente autorizada, fechada y versionada para ella.
