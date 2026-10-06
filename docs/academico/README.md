# Entregables académicos del curso

Esta carpeta contiene exclusivamente los cinco formatos académicos de Pulse EPIS. Los manuales necesarios para desarrollar y operar el producto se mantienen en [Documentación del proyecto](../proyecto/README.md).

| Código | Fuente | Contenido |
|---|---|---|
| FD01 | [Factibilidad](FD01-Informe-Factibilidad.md) | Riesgos, situación actual, seis dimensiones de factibilidad y análisis financiero |
| FD02 | [Visión](FD02-Informe-Vision.md) | Posicionamiento, interesados, usuarios, capacidades, costos, calidad y restricciones |
| FD03 | [SRS](FD03-Especificacion-Requerimientos.md) | Requisitos funcionales y no funcionales, reglas, escenarios, modelos y trazabilidad |
| FD04 | [SAD](FD04-Arquitectura-Software.md) | Cinco vistas de arquitectura, diagramas y escenarios de calidad |
| FD05 | [Informe final](FD05-Informe-Final.md) | Síntesis, metodología, cronograma, presupuesto, resultados verificables y anexos |

## Presentación y evidencia

Los cinco informes de Pulse EPIS incluyen escudo de la Universidad Privada de Tacna, facultad, escuela, curso, docente, integrantes con sus códigos, versión y fecha. El paquete PDF utiliza tamaño A4, tipografía Times, cuerpo de 12 puntos, párrafos justificados, control de versiones, índice, numeración y diagramas renderizados. Los documentos distinguen implementación, propuesta y validación institucional pendiente.

La base técnica es main `d123bea`, que incorpora la documentación académica y la preparación del piloto. El manifiesto generado registra el commit de trabajo, estado de cambios y hash de cada fuente. La revisión docente y la aceptación institucional requieren sus propias actas; los resultados sintéticos se identifican como tales.

Desde la raíz: `python scripts/build_docs.py` genera el paquete completo y `python scripts/build_academic_pdfs.py` genera únicamente FD01–FD05. Los PDF y HTML quedan en `artifacts/docs/academico`. No se requieren Pandoc ni TeX. La validación de fuentes y de artefactos forma parte de CI.
