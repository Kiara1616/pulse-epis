# Entregables académicos

Esta carpeta documenta la edición académica del proyecto Pulse EPIS. Las fuentes de contenido se mantienen en `docs/FD01-*.md` a `docs/FD04-*.md`; los PDF se generan de forma reproducible con `scripts/build_academic_pdfs.py`.

## Documentos

| Código | Fuente |
|---|---|
| FD01 | [Informe de Factibilidad](../FD01-Informe-Factibilidad.md) |
| FD02 | [Informe de Visión](../FD02-Informe-Vision.md) |
| FD03 | [Informe de Especificación de Requerimientos](../FD03-EPIS-Informe%20Especificaci%C3%B3n%20Requerimientos.md) |
| FD04 | [Informe de Arquitectura de Software](../FD04-EPIS-Informe%20Arquitectura%20de%20Software.md) |

## Corte documentado

- Fecha: 01/10/2026.
- Rama base: `main`.
- Commit de referencia: `cf7ab75`.
- Alcance: edición académica basada en el estado verificable del repositorio, con versión 3.0 en cada documento.

Los PDF se generan en `output/pdf/` con nombres `FD01_PULSE_EPIS_FACTIBILIDAD.pdf`, `FD02_PULSE_EPIS_VISION.pdf`, `FD03_PULSE_EPIS_ESPECIFICACION_REQUERIMIENTOS.pdf` y `FD04_PULSE_EPIS_ARQUITECTURA_SOFTWARE.pdf`. El repositorio los mantiene fuera de control de versiones por la regla global `*.pdf`; el generador permite recrearlos cuando se necesiten para la entrega. Incluyen portada institucional, control de versiones, tabla de contenido, encabezado/pie de página y las tablas del documento fuente. Los diagramas Mermaid se conservan como referencia textual para que el documento siga siendo reproducible sin depender de un servicio externo de renderizado.
