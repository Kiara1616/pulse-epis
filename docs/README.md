# Documentación de Pulse EPIS

La documentación se organiza por propósito. Las fuentes Markdown se versionan; los documentos HTML/PDF y OpenAPI se generan desde esas fuentes. Los ejemplos académicos proporcionados orientan la estructura, sin transferir datos de NODIEX al proyecto.

| Carpeta | Contenido | Punto de entrada |
|---|---|---|
| academico | Entregables del curso FD01 a FD05 | [Índice académico](academico/README.md) |
| proyecto | Fundamentos, arquitectura, desarrollo, datos, seguridad y operación | [Índice técnico](proyecto/README.md) |
| recursos | Contratos JSON, plantilla sintética y registro de migración | [Recursos compartidos](recursos/README.md) |
| tooling | Dependencias y configuración de diagramas | [Generación documental](proyecto/18-Generacion-documental.md) |

## Generación y conservación

`python scripts/build_docs.py` construye el paquete completo en `artifacts/docs`: académicos, proyecto, recursos, diagramas, OpenAPI, fuentes y manifiesto. `python scripts/build_academic_pdfs.py` selecciona solo los cinco FD. Los PDF no se versionan; los artefactos de CI y release conservan el paquete generado por commit.

La [migración](recursos/migracion.json) registra cada ubicación anterior, ubicación actual y hash previo al cambio. Los archivos se trasladaron mediante Git, que conserva su historial. El catálogo `docs/catalogo.json` define las fuentes y se valida recursivamente para detectar archivos omitidos. Un documento nuevo debe registrarse en su índice y catálogo, y generarse con sus enlaces y figuras.
