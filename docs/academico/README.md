# Entregables académicos del curso

![Escudo institucional](../recursos/imagenes/upt-logo.png)

**Universidad Privada de Tacna**<br>
**Facultad de Ingeniería · Escuela Profesional de Ingeniería de Sistemas**<br>
**Proyecto: Pulse EPIS**

Esta carpeta contiene los seis formatos académicos de Pulse EPIS. Los manuales necesarios para desarrollar y operar el producto se mantienen en [Documentación del proyecto](../proyecto/README.md).

| Código | Fuente | Contenido |
|---|---|---|
| FD01 | [Factibilidad](FD01-Informe-Factibilidad.md) | Riesgos, situación actual, seis dimensiones de factibilidad y análisis financiero |
| FD02 | [Visión](FD02-Informe-Vision.md) | Posicionamiento, interesados, usuarios, capacidades, costos, calidad y restricciones |
| FD03 | [SRS](FD03-Especificacion-Requerimientos.md) | Requisitos funcionales y no funcionales, reglas, escenarios, modelos y trazabilidad |
| FD04 | [SAD](FD04-Arquitectura-Software.md) | Cinco vistas de arquitectura, diagramas y escenarios de calidad |
| FD05 | [Informe final](FD05-Informe-Final.md) | Síntesis, metodología, cronograma, presupuesto, resultados verificables y anexos |
| FD06 | [Propuesta de proyecto](FD06-Propuesta-Proyecto.md) | Resumen ejecutivo, problema, solución, alcance, arquitectura BI, plan, presupuesto, riesgos y criterios de éxito |

## Presentación y evidencia

Los seis informes de Pulse EPIS incluyen escudo de la Universidad Privada de Tacna, facultad, escuela, curso, docente, integrantes con sus códigos, versión y fecha. El paquete PDF utiliza tamaño A4, tipografía Times, cuerpo de 12 puntos, párrafos justificados, títulos y texto negros, tablas sin sombreado, control de versiones, índice, numeración y diagramas renderizados. Los documentos distinguen implementación, propuesta y validación institucional pendiente.

El manifiesto generado registra el commit de trabajo, el estado de cambios y el hash de cada fuente. La revisión docente y la aceptación institucional requieren sus propias actas; los resultados sintéticos se identifican como tales. La infraestructura GCP y los seis reportes temporales corresponden a la segunda unidad y se distinguen de una operación cloud aún no verificada.

Desde la raíz: `python scripts/build_docs.py` genera el paquete completo y `python scripts/build_academic_pdfs.py` genera únicamente FD01–FD06. Los PDF y HTML quedan en `artifacts/docs/academico`. No se requieren Pandoc ni TeX. La validación de fuentes y de artefactos forma parte de CI.
