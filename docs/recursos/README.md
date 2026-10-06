# Recursos compartidos

| Recurso | Uso y autoridad |
|---|---|
| [Plantilla padron.csv](templates/padron.csv) | Ejemplo sintético; siete columnas para importación autorizada |
| [dashboard-spec.json](schemas/dashboard-spec.json) | JSON Schema extraído de AnalyticsOverview; contrato vigente de indicadores |
| [dashboard-spec-objetivo.json](schemas/dashboard-spec-objetivo.json) | Propuesta histórica camelCase preservada; no es respuesta actual de la API |
| [migracion.json](migracion.json) | Ubicaciones anteriores y actuales con SHA-256 original |

El generador exporta OpenAPI desde FastAPI sin conexión a datos institucionales. El validador compara el esquema vigente con Pydantic para detectar cambios sin documentar. Las referencias académicas externas se usan para estructura; no se añaden sus datos al producto.
