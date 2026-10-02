# Entregables académicos del curso

Esta carpeta contiene exclusivamente los cinco formatos académicos de Pulse EPIS. Los manuales necesarios para desarrollar y operar el producto se mantienen en [Documentación del proyecto](../proyecto/README.md).

| Código | Fuente | Contenido |
|---|---|---|
| FD01 | [Factibilidad](FD01-Informe-Factibilidad.md) | Riesgos, situación actual, seis dimensiones de factibilidad y análisis financiero |
| FD02 | [Visión](FD02-Informe-Vision.md) | Posicionamiento, interesados, usuarios, capacidades, costos, calidad y restricciones |
| FD03 | [SRS](FD03-Especificacion-Requerimientos.md) | Requisitos funcionales y no funcionales, reglas, escenarios, modelos y trazabilidad |
| FD04 | [SAD](FD04-Arquitectura-Software.md) | Cinco vistas de arquitectura, diagramas y escenarios de calidad |
| FD05 | [Informe final](FD05-Informe-Final.md) | Síntesis, metodología, cronograma, presupuesto, resultados verificables y anexos |

## Referencias de formato y evidencia

Las cinco referencias DOCX aportadas describen otro proyecto. Su [matriz de cobertura](Matriz-de-cobertura.md) relaciona apartados con contenido adaptado de Pulse EPIS. No son instrucciones operativas ni pruebas de entrevistas, contratos o resultados de este proyecto. Los documentos distinguen implementación, propuesta y validación pendiente.

La base de código revisada es main `cf7ab75`, y el antecedente documental es el PR 51 `a618c3e`. El manifiesto generado registra además el commit de trabajo, estado de cambios y hash de cada fuente; no etiqueta la rama actual como main. Revisión docente y aceptación institucional requieren sus propias actas.

Desde la raíz: `python scripts/build_academic_pdfs.py`. Los cinco PDF quedan en `artifacts/docs/academico`, con portada, control de versiones, contenido, numeración y diagramas renderizados. No se requieren Pandoc ni TeX.
