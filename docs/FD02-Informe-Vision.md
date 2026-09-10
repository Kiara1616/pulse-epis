# Informe de Visión

## Pulse EPIS Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS

**Integrantes:** Kiara Holly Zapana Murillo (2023077087) y Vincenzo Rafael Lllanos Niño (2023076796)  
**Curso:** Inteligencia de Negocios  
**Versión:** 2.0  
**Fecha:** 09/09/2026

## 1 Propósito

Este documento define la visión de Pulse EPIS, una plataforma institucional para conocer el nivel de certificación tecnológica de los estudiantes, conservar evidencia verificable y producir información útil para acreditación y mejora curricular.

## 2 Oportunidad

La EPIS dispone de información académica y publica algunos datos agregados, mientras que las certificaciones se encuentran distribuidas en distintas plataformas y archivos. La oportunidad consiste en relacionar de forma gobernada el universo oficial de estudiantes con credenciales verificadas para responder cuántos están certificados, en qué tecnologías, nivel y vigencia, y qué brechas existen frente al mercado.

## 3 Definición del problema

| Elemento | Definición |
|---|---|
| Problema | No existe una fuente consolidada y trazable de certificaciones EPIS |
| Afecta a | Dirección, Comité de Calidad, estudiantes y acreditación |
| Consecuencia | Reportes manuales e indicadores no reproducibles |
| Solución | BI con padrón oficial, evidencias, validación, ETL y dashboard por roles |

## 4 Visión del producto

Para la Dirección y el Comité de Calidad que necesitan evidencia cuantitativa auditable, Pulse EPIS es un sistema web de inteligencia de negocios que consolida estudiantes y certificaciones verificadas, calcula indicadores y genera reportes por periodo. A diferencia de una hoja aislada, mantiene trazabilidad, reglas de calidad, seguridad por roles e historial.

## 5 Interesados y usuarios

| Actor | Necesidad | Acceso |
|---|---|---|
| Dirección EPIS | Indicadores y reportes | Agregado y nominal autorizado |
| Comité de Calidad | Evidencias y series históricas | Analítico |
| Responsable de datos | Importar padrón y corregir errores | Administrativo |
| Validador | Revisar autenticidad y vigencia | Operativo |
| Estudiante | Registrar y consultar credenciales | Solo datos propios |
| Público | Consultar indicadores generales | Agregado y anonimizado |

## 6 Capacidades

1. Autenticación institucional y roles.
2. Importación de padrón mediante CSV o integración autorizada.
3. Auto registro de certificaciones y evidencias.
4. Verificación por URL, metadatos o revisión manual.
5. Clasificación de proveedor, nivel, tecnología y vigencia.
6. KPIs de cobertura, actividad, crecimiento y diversidad.
7. Análisis por periodo, cohorte, ciclo, proveedor y área.
8. Demanda laboral con fuente y fecha.
9. Exportación PDF, CSV y paquete de evidencias.
10. Auditoría y calidad de datos.

## 7 Indicadores

| Indicador | Fórmula |
|---|---|
| Cobertura | estudiantes activos con certificación válida / estudiantes activos |
| Certificaciones vigentes | validadas con expiración nula o posterior al corte |
| Crecimiento | variación respecto al periodo anterior |
| Diversidad | proveedores con al menos una certificación válida |
| Nivel avanzado | credenciales profesionales o expertas / credenciales válidas |
| Brecha | demanda normalizada menos oferta certificada |

Cada indicador mostrará fecha de corte, población y reglas. El total publicado en la web EPIS será referencia agregada; el denominador oficial procederá del padrón.

## 8 Entregas

### MVP

- Padrón CSV, formulario, revisión manual y dashboard interno.
- KPIs, proveedores, estudiantes, vigencia y CSV.
- Seudonimización y auditoría básica.

### Versión institucional

- Inicio institucional, evidencias y notificaciones.
- Integraciones de insignias y automatización semestral.
- PDF de acreditación y seguimiento de metas.

### Escalamiento

- Varias escuelas, permisos por unidad y almacén histórico.
- Catálogo común de competencias y API institucional.

## 9 Suposiciones y restricciones

- EPIS entregará un padrón mínimo y responsable de tratamiento.
- Los estudiantes podrán registrar evidencia con consentimiento.
- Los proveedores pueden restringir sus APIs.
- El portal público no es fuente de identidad individual.
- No se almacenan contraseñas externas ni se publican códigos o nombres.
- Cifras simuladas no se usarán en reportes oficiales.
- El análisis del mercado es una aproximación documentada, no garantía de empleabilidad.

## 10 Prioridades y éxito

| Prioridad | Resultado |
|---|---|
| Crítica | Identidad confiable, privacidad, validez y denominador correcto |
| Alta | Dashboard, filtros, historial y exportación |
| Media | Automatización y análisis laboral |
| Posterior | Recomendaciones y extensión multiescuela |

El producto estará completo cuando opere con datos reales autorizados, cubra registro y validación, reproduzca indicadores, controle acceso, exporte reportes y tenga pruebas, respaldo, monitoreo y responsables operativos.

## 11 Recomendación

Iniciar con un piloto de un semestre. La primera mejora debe eliminar la duplicidad de JSON simulados y crear una fuente servida por API. El ranking nominal debe ser privado y opcional; para difusión pública se usarán cohortes y porcentajes.
