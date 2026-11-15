# Guía de presentación de la segunda unidad

## Objetivo de la demostración

Demostrar que Pulse EPIS transforma el padrón autorizado y fuentes institucionales agregadas en indicadores temporales reproducibles. La interfaz desplegada no presenta fixtures sintéticos: el histórico de matrícula proviene de totales UPT/GPAD y el periodo vigente proviene del snapshot ETL publicado en Pulse.

## Preparación rápida

Con backend y frontend activos, ejecutar desde la raíz:

```powershell
.\scripts\preflight_u2.ps1
```

La revisión rápida comprueba salud de API, dashboard, formato y validez de Terraform y regeneración del reporte de costos. Para repetir toda la aceptación:

```powershell
.\scripts\preflight_u2.ps1 -Full
```

## Recorrido recomendado

1. Abrir `http://127.0.0.1:3000/` o la URL de Render y señalar **Matrícula por periodo**.
2. Explicar que `2023-I` a `2026-II` son totales agregados publicados por UPT/GPAD; `2026-II` se resalta con el snapshot vigente de Pulse.
3. Explicar la diferencia visible entre el total GPAD y el padrón ETL de Pulse como conciliación institucional pendiente; no se infieren identidades históricas.
4. Cambiar la granularidad entre día, mes y año. Explicar que el mes y el año toman el último snapshot válido para métricas de estado.
5. Recorrer Panorama, Evolución, Certificaciones, Habilidades, Cohortes y Calidad.
6. Mostrar los diagramas de Data Lake, proceso ETL e infraestructura GCP.
7. Ejecutar `terraform validate` y mostrar el reporte de costos reproducible.
8. Cerrar aclarando que el código está preparado para GCP, mientras `terraform apply` y las corridas cloud necesitan proyecto, facturación y autenticación configurados.

## Respuestas breves para la sustentación

### ¿Por qué GCP?

Cloud Run, Cloud SQL, Cloud Storage y Scheduler permiten conservar la arquitectura de contenedores y PostgreSQL ya utilizada por Pulse EPIS. La solución sigue siendo portable porque el ETL, la API y el frontend se empaquetan como contenedores y la infraestructura está declarada en Terraform.

### ¿Por qué Data Lake y Data Warehouse?

El Data Lake conserva exportaciones seudonimizadas y manifiestos por periodo y fecha de corte. El Data Warehouse conserva snapshots listos para indicadores. Esta separación facilita auditoría, reproceso y consumo analítico.

### ¿Cómo se evita duplicar información?

Cada corrida calcula un hash de la fuente y lo combina con periodo y corte. Una repetición exacta se reconoce como idempotente y no vuelve a publicar hechos.

### ¿Qué ocurre si la calidad falla?

El ETL registra los rechazos, conserva el último snapshot válido y no publica resultados parciales. Los registros pendientes o rechazados no ingresan a los KPI aprobados.

### ¿Cómo se controla el costo?

Terraform limita instancias y configura alertas presupuestarias. La estimación versionada compara demo y piloto; la factura real se verificará mediante Billing Export después del despliegue.

## Evidencia disponible

- Tres diagramas Mermaid con versiones SVG y PNG para exposición.
- Terraform válido para Cloud Run, Cloud SQL, Storage, Scheduler, secretos, IAM, monitoreo y presupuesto.
- Reporte reproducible de costos para demo y piloto.
- Seis rutas BI con filtros temporales y exportación CSV.
- Pruebas backend, lint, build y prueba E2E de navegación de los seis reportes.
- Presentación editable y PDF en `artifacts/presentacion`.

## Pendientes que dependen del padrón o de GCP

- Recibir el padrón autorizado con código estable, correo, plan, ciclo, estado y periodo.
- Conciliar nombres públicos únicamente como referencia; no usarlos como identidad oficial.
- Configurar Google Cloud CLI, proyecto, facturación y autenticación.
- Ejecutar `terraform plan` y `apply`, luego conservar dos corridas ETL cloud y una prueba de fallo.
- Revisar la conciliación del padrón vigente antes de presentar el conteo de `2026-II` como definitivo; el histórico agregado UPT/GPAD ya se muestra con su fuente y no habilita accesos.
