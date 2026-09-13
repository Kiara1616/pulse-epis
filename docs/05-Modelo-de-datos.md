# Modelo de datos inicial

## Pulse EPIS — esquema operacional y analítico

Este modelo corresponde a los issues [#10 — Diseñar PostgreSQL y crear migraciones reproducibles](https://github.com/Kiara1616/pulse-epis/issues/10), [#11 — Implementar autenticación Google institucional y RBAC](https://github.com/Kiara1616/pulse-epis/issues/11), [#12 — Implementar importación y conciliación del padrón EPIS](https://github.com/Kiara1616/pulse-epis/issues/12), [#13 — Implementar registro de certificaciones y evidencias privadas](https://github.com/Kiara1616/pulse-epis/issues/13), [#14 — Implementar flujo de validación y auditoría de certificaciones](https://github.com/Kiara1616/pulse-epis/issues/14) y [#15 — Construir ETL idempotente y controles de calidad de datos](https://github.com/Kiara1616/pulse-epis/issues/15). Las migraciones se encuentran en `backend/migrations/versions/` y se ejecutan con Alembic.

El esquema separa la operación institucional de los hechos usados para indicadores. Las tablas analíticas conservan una fecha de corte para que los reportes sean reproducibles y no copian directamente el correo o código institucional.

`fact_student_period` conserva también cohorte y ciclo, de modo que la API analítica pueda aplicar esas dimensiones sin consultar ni exponer información personal del padrón.

```mermaid
erDiagram
    USERS ||--o| STUDENTS : "representa"
    USERS ||--o{ VALIDATIONS : "decide"
    USERS ||--o{ CERTIFICATION_STATUS_HISTORY : "origina"
    USERS ||--o{ AUDIT_LOGS : "origina"
    STUDENTS ||--o{ ENROLLMENTS : "tiene"
    ACADEMIC_PERIODS ||--o{ ENROLLMENTS : "contiene"
    ACADEMIC_PERIODS ||--o{ ROSTER_IMPORTS : "recibe"
    ROSTER_IMPORTS ||--o{ ROSTER_IMPORT_REJECTIONS : "reporta"
    USERS ||--o{ ROSTER_IMPORTS : "ejecuta"
    ACADEMIC_PERIODS ||--o{ ETL_RUNS : "procesa"
    ETL_RUNS ||--o{ ETL_REJECTIONS : "explica"
    USERS ||--o{ ETL_RUNS : "ejecuta"
    STUDENTS ||--o{ CERTIFICATIONS : "declara"
    ISSUERS ||--o{ CERTIFICATIONS : "emite"
    CERTIFICATIONS ||--o{ EVIDENCES : "respalda"
    CERTIFICATIONS ||--o{ VALIDATIONS : "recibe"
    CERTIFICATIONS ||--o{ CERTIFICATION_STATUS_HISTORY : "conserva"
    CERTIFICATIONS ||--o{ CERTIFICATION_SKILLS : "desarrolla"
    SKILLS ||--o{ CERTIFICATION_SKILLS : "clasifica"
    ACADEMIC_PERIODS ||--o{ FACT_STUDENT_PERIOD : "corta"
    ACADEMIC_PERIODS ||--o{ FACT_CERTIFICATION : "corta"
    CERTIFICATIONS ||--o{ FACT_CERTIFICATION : "resume"
    ISSUERS ||--o{ FACT_CERTIFICATION : "agrupa"
    SKILLS ||--o{ FACT_CERTIFICATION : "agrupa"

    USERS {
        uuid id PK
        string email UK
        string google_subject UK "nullable"
        string role
        boolean is_active
        datetime created_at
    }
    STUDENTS {
        uuid id PK
        uuid user_id FK, UK
        string student_key UK
        smallint entry_year
        string status
    }
    ACADEMIC_PERIODS {
        uuid id PK
        string code UK
        date starts_on
        date ends_on
        string status
    }
    ENROLLMENTS {
        uuid id PK
        uuid student_id FK
        uuid period_id FK
        string cycle
        string cohort
        string school
        string study_plan
        string status
    }
    ROSTER_IMPORTS {
        uuid id PK
        uuid period_id FK
        uuid actor_user_id FK
        string source_sha256
        string status
        integer total_rows
        integer accepted_rows
        integer rejected_rows
        datetime created_at
        datetime completed_at
    }
    ROSTER_IMPORT_REJECTIONS {
        uuid id PK
        uuid import_id FK
        integer row_number
        string field_name
        string reason_code
        string message
    }
    ETL_RUNS {
        uuid id PK
        uuid period_id FK
        uuid actor_user_id FK
        date cutoff_date
        string source_sha256
        string status
        integer total_rows
        integer accepted_rows
        integer rejected_rows
        integer duplicate_rows
        json quality_report
        datetime created_at
        datetime completed_at
    }
    ETL_REJECTIONS {
        uuid id PK
        uuid run_id FK
        integer row_number
        string record_key
        string field_name
        string reason_code
        string message
    }
    ISSUERS {
        uuid id PK
        string name UK
        string website_url
    }
    SKILLS {
        uuid id PK
        string name UK
        string category
    }
    CERTIFICATIONS {
        uuid id PK
        uuid student_id FK
        uuid issuer_id FK
        string credential_name
        string external_id
        date issued_on
        date expires_on
        string status
    }
    CERTIFICATION_SKILLS {
        uuid certification_id PK, FK
        uuid skill_id PK, FK
        string level
    }
    EVIDENCES {
        uuid id PK
        uuid certification_id FK
        string evidence_type
        string source_url
        string object_key
        string sha256
        string original_filename
        string content_type
        integer byte_size
        datetime retention_until
    }
    VALIDATIONS {
        uuid id PK
        uuid certification_id FK
        uuid validator_user_id FK
        string decision
        string comment
        datetime decided_at
    }
    CERTIFICATION_STATUS_HISTORY {
        uuid id PK
        uuid certification_id FK
        uuid actor_user_id FK "nullable"
        string from_status
        string to_status
        string comment
        date cutoff_date
        datetime changed_at
    }
    AUDIT_LOGS {
        uuid id PK
        uuid actor_user_id FK
        string action
        string entity_type
        string entity_id
        json before_data
        json after_data
        string idempotency_key UK
    }
    FACT_STUDENT_PERIOD {
        string student_key PK
        uuid period_id PK, FK
        date cutoff_date PK
        string cohort
        integer certification_count
        integer approved_certification_count
    }
    FACT_CERTIFICATION {
        uuid certification_id PK, FK
        uuid skill_id PK, FK
        date cutoff_date PK
        uuid period_id FK
        uuid issuer_id FK
        string status
        string level
    }
```

## Reglas de integridad

- Los roles y estados se restringen mediante `CHECK` constraints para evitar valores fuera del contrato.
- `google_subject` es opcional hasta el primer login autorizado y luego vincula la cuenta local con el `sub` estable de Google mediante un índice único.
- El correo y el dominio de Google no reemplazan el padrón: una sesión solo se crea para un `users` provisionado y un `STUDENT` debe tener registro en `students`.
- Una importación del padrón se identifica por periodo y hash del archivo; los reintentos exactos no crean nuevos registros.
- Los lotes rechazados conservan únicamente metadatos y causas no sensibles por fila; el CSV original no se persiste.
- Una corrida ETL se identifica por periodo, fecha de corte y hash de la extracción; repetir la misma fuente es idempotente.
- `etl_runs` conserva filas, duplicados, calidad, estado y hash de fuente; `etl_rejections` conserva la causa por fila sin almacenar correos ni el extracto original.
- La publicación elimina y carga el snapshot de un periodo/corte dentro de la misma transacción; una corrida rechazada mantiene intacta la última publicación.
- El ETL extrae desde las tablas operativas autorizadas y no realiza búsqueda simulada por correo en Credly.
- `Enrollment` conserva escuela y plan por periodo para mantener el historial sin sobrescribir el contexto académico anterior.
- Una matrícula es única por estudiante y periodo (`student_id`, `period_id`).
- Una certificación es única por estudiante, emisor, nombre y fecha de emisión.
- El identificador externo de una certificación es único dentro de su emisor cuando existe.
- Una evidencia exige una URL o una clave de objeto y evita repetir el mismo hash para una certificación.
- Los archivos de evidencia se guardan con una clave aleatoria, metadatos de tipo/tamaño y `retention_until`; el acceso se entrega mediante tokens firmados de corta duración.
- La corrección de una certificación observada pasa a `RESUBMITTED` y no elimina las decisiones anteriores.
- Cada transición explícita agrega una fila en `certification_status_history`; la aplicación no ofrece actualización ni borrado de ese historial.
- `EXPIRED` es un estado derivado al evaluar una certificación `APPROVED` cuyo `expires_on` es anterior a la fecha de corte; el registro aprobado original se conserva.
- Solo `APPROVED` que siga vigente en la fecha de corte puede entrar en los KPI oficiales.
- Las fechas de periodo y certificación son consistentes; los contadores analíticos no pueden ser negativos ni superar el total.
- Las tablas de hechos incluyen fecha de corte y claves compuestas para evitar snapshots duplicados.
- Los índices cubren estados, periodos, estudiantes, emisores, validaciones, auditoría y consultas analíticas frecuentes.

Las migraciones se prueban con datos sintéticos contra PostgreSQL en CI y se revierten a `base` al finalizar la prueba. La conexión de identidad desde la API usa Google OIDC sin scopes de Gmail, sesiones firmadas y autorización RBAC en backend. El padrón se carga mediante un lote atómico, con HMAC para `student_key`, historial por periodo y reporte de rechazos sin PII. Las issues #13 y #14 cubren evidencias privadas, decisiones del validador y trazabilidad; el adaptador de almacenamiento de producción, purga programada y respaldos pertenecen a las issues #19 y #21.
