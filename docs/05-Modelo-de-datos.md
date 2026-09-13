# Modelo de datos inicial

## Pulse EPIS — esquema operacional y analítico

Este modelo corresponde a los issues [#10 — Diseñar PostgreSQL y crear migraciones reproducibles](https://github.com/Kiara1616/pulse-epis/issues/10) y [#11 — Implementar autenticación Google institucional y RBAC](https://github.com/Kiara1616/pulse-epis/issues/11). Las migraciones se encuentran en `backend/migrations/versions/` y se ejecutan con Alembic.

El esquema separa la operación institucional de los hechos usados para indicadores. Las tablas analíticas conservan una fecha de corte para que los reportes sean reproducibles y no copian directamente el correo o código institucional.

```mermaid
erDiagram
    USERS ||--o| STUDENTS : "representa"
    USERS ||--o{ VALIDATIONS : "decide"
    USERS ||--o{ AUDIT_LOGS : "origina"
    STUDENTS ||--o{ ENROLLMENTS : "tiene"
    ACADEMIC_PERIODS ||--o{ ENROLLMENTS : "contiene"
    STUDENTS ||--o{ CERTIFICATIONS : "declara"
    ISSUERS ||--o{ CERTIFICATIONS : "emite"
    CERTIFICATIONS ||--o{ EVIDENCES : "respalda"
    CERTIFICATIONS ||--o{ VALIDATIONS : "recibe"
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
        string google_subject UK,nullable
        string role
        boolean is_active
        datetime created_at
    }
    STUDENTS {
        uuid id PK
        uuid user_id FK,UK
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
        string status
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
        uuid certification_id PK,FK
        uuid skill_id PK,FK
        string level
    }
    EVIDENCES {
        uuid id PK
        uuid certification_id FK
        string evidence_type
        string source_url
        string object_key
        string sha256
    }
    VALIDATIONS {
        uuid id PK
        uuid certification_id FK
        uuid validator_user_id FK
        string decision
        string comment
        datetime decided_at
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
        uuid period_id PK,FK
        date cutoff_date PK
        string cohort
        integer certification_count
        integer approved_certification_count
    }
    FACT_CERTIFICATION {
        uuid certification_id PK,FK
        uuid skill_id PK,FK
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
- Una matrícula es única por estudiante y periodo (`student_id`, `period_id`).
- Una certificación es única por estudiante, emisor, nombre y fecha de emisión.
- El identificador externo de una certificación es único dentro de su emisor cuando existe.
- Una evidencia exige una URL o una clave de objeto y evita repetir el mismo hash para una certificación.
- Las fechas de periodo y certificación son consistentes; los contadores analíticos no pueden ser negativos ni superar el total.
- Las tablas de hechos incluyen fecha de corte y claves compuestas para evitar snapshots duplicados.
- Los índices cubren estados, periodos, estudiantes, emisores, validaciones, auditoría y consultas analíticas frecuentes.

Las migraciones se prueban con datos sintéticos contra PostgreSQL en CI y se revierten a `base` al finalizar la prueba. La conexión de identidad desde la API usa Google OIDC sin scopes de Gmail, sesiones firmadas y autorización RBAC en backend. El almacenamiento privado de evidencias y los respaldos pertenecen a issues posteriores.
