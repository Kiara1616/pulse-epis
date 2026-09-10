# Informe de Factibilidad

## Pulse EPIS Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS

**Universidad Privada de Tacna**  
**Facultad de Ingeniería**  
**Escuela Profesional de Ingeniería de Sistemas**  
**Curso:** Inteligencia de Negocios  
**Docente:** Patrick Cuadros Quiroga  
**Integrantes:**

- Kiara Holly Zapana Murillo (2023077087)
- Vincenzo Rafael Lllanos Niño (2023076796)

**Tacna Perú 2026**

## Control de versiones

| Versión | Autores | Fecha | Motivo |
|---|---|---|---|
| 2.0 | Kiara Zapana y Vincenzo Lllanos | 09/09/2026 | Adaptación integral al proyecto Pulse EPIS |

## 1 Descripción del proyecto

### 1.1 Nombre

**Pulse EPIS Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS**.

### 1.2 Problema y propuesta

La EPIS necesita demostrar, para sus procesos de mejora continua y acreditación, qué proporción de sus estudiantes posee certificaciones de la industria, cómo evoluciona el indicador y qué brechas existen frente al mercado laboral. La información puede encontrarse dispersa entre formularios, hojas de cálculo, certificados PDF, plataformas de insignias y registros académicos. Una cifra agregada publicada en el portal institucional permite conocer el universo, pero no identifica de forma confiable a cada estudiante ni prueba que una credencial le pertenezca.

Pulse EPIS centralizará el padrón académico autorizado y las evidencias de certificación, validará cada registro y producirá indicadores trazables. La fuente de identidad será un padrón entregado por EPIS o Secretaría Académica con código universitario, correo institucional, estado y ciclo; no se obtendrán identidades mediante scraping de páginas públicas.

### 1.3 Objetivo general

Diseñar e implementar una plataforma de inteligencia de negocios que consolide, valide y visualice las certificaciones de los estudiantes de la EPIS para apoyar la acreditación, la mejora curricular y la identificación de talento.

### 1.4 Objetivos específicos

1. Integrar el padrón oficial con certificaciones reportadas y credenciales digitales verificables.
2. Calcular indicadores por periodo, cohorte, ciclo, proveedor, nivel y área tecnológica.
3. Mantener evidencia y trazabilidad del origen y estado de validación.
4. Proteger datos personales mediante control de acceso, seudonimización y publicación agregada.
5. Comparar competencias certificadas con señales documentadas de demanda laboral.
6. Generar reportes exportables para calidad y acreditación.

### 1.5 Alcance

Incluye autenticación institucional, carga del padrón, registro de certificaciones, evidencias, validación administrativa, ETL, almacén analítico, dashboard, filtros, exportación y auditoría. El MVP atenderá a la EPIS y podrá ampliarse a otras escuelas. No incluye acceso no autorizado al sistema académico, extracción de perfiles privados, verificación biométrica ni rankings nominales públicos.

## 2 Identificación de estudiantes

La identificación utilizará un **identificador interno estable**. El código universitario será la clave natural de ingreso, pero en analítica se reemplazará por `student_key`, sin significado externo.

| Fuente | Datos mínimos | Uso | Tratamiento |
|---|---|---|---|
| Padrón oficial EPIS | código, correo, ciclo, estado y periodo | Denominador y vinculación | Acceso restringido |
| Formulario institucional | código, credencial, URL o PDF y consentimiento | Evidencia | Validación contra padrón |
| Credly u Open Badges | URL pública, emisor, emisión y expiración | Verificación | Sin búsqueda por correo no autorizada |
| Portal EPIS | totales agregados publicados | Contraste | No identifica personas |

El correo puede ayudar a validar el código, pero inferir el ciclo desde el año contenido en él es aproximado y no sustituye la matrícula. El flujo será: importar padrón, crear `student_key`, registrar evidencia, verificar emisor y fechas, resolver duplicados y cargar solo atributos necesarios al almacén analítico.

## 3 Factibilidad técnica

El prototipo demuestra viabilidad visual con Next.js, TypeScript, Tailwind CSS y Recharts, y posee un ETL inicial en Python. Para producción se propone PostgreSQL, una API en FastAPI o Next.js, almacenamiento privado de evidencias y tareas programadas. La API pública de Credly no debe asumirse capaz de buscar libremente por correo; se usará URL pública, Open Badges cuando esté disponible o revisión humana.

## 4 Factibilidad económica

| Concepto | Alternativa inicial | Costo estimado |
|---|---|---:|
| Desarrollo | Trabajo académico del equipo | S/ 0 directo |
| Frontend y API | Servicio gratuito o educativo | S/ 0 a S/ 150 mensuales |
| PostgreSQL | Plan educativo o gratuito | S/ 0 a S/ 120 mensuales |
| Evidencias | Almacenamiento restringido | Según volumen |
| Dominio y monitoreo | Opcional para MVP | S/ 0 a S/ 150 anuales |

Los montos son rangos de planificación y deberán cotizarse. El beneficio principal es reducir consolidación manual y producir evidencia reutilizable.

## 5 Factibilidad operativa legal y social

La operación requiere un responsable de datos, validadores y un cierre semestral. El tratamiento debe respetar la Ley peruana 29733: finalidad definida, acceso mínimo, consentimiento cuando corresponda, retención limitada y derechos del titular. Los reportes públicos serán agregados; nombres y rankings solo estarán disponibles para roles autorizados y una finalidad académica explícita.

## 6 Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Padrón incompleto | Media | Alto | Corte semestral y conciliación |
| Certificados falsos o duplicados | Media | Alto | URL, hash, revisión y unicidad |
| Restricciones de API | Alta | Medio | Formulario, CSV y revisión manual |
| Exposición de datos | Baja | Crítico | RBAC, cifrado, seudonimización y auditoría |
| Datos laborales sesgados | Media | Medio | Varias fuentes y metodología visible |
| Dependencia de dos desarrolladores | Alta | Medio | CI, pruebas y documentación |

## 7 Plan de ejecución

| Fase | Semanas | Resultado |
|---|---:|---|
| Gobierno y acceso | 1 a 2 | Convenio, diccionario, roles y padrón de prueba |
| Modelo y backend | 3 a 5 | PostgreSQL, API y autenticación |
| Ingesta y validación | 6 a 8 | Formulario, CSV, deduplicación y revisión |
| BI y reportes | 9 a 11 | KPIs reales, filtros y exportación |
| Calidad y seguridad | 12 a 13 | Pruebas, auditoría y restauración |
| Piloto y producción | 14 a 16 | Piloto, capacitación y despliegue |

## 8 Criterios de éxito

- Al menos 95 por ciento del padrón activo conciliado.
- Cien por ciento de certificaciones mostradas con fuente y estado.
- Duplicados inferiores al 1 por ciento después del ETL.
- Consultas principales en menos de dos segundos.
- Reportes reproducibles por periodo y fecha de corte.
- Cero datos personales en vistas públicas.

## 9 Conclusión

Pulse EPIS es viable si la Escuela proporciona un padrón autorizado y responsables de validación. La prioridad no es raspar identidades del portal, sino conectar padrón, evidencia y métricas mediante un proceso institucional. El prototipo requiere persistencia, autenticación, gobierno de datos, integraciones reales y pruebas antes de producción.

## 10 Referencias

- https://github.com/Kiara1616/pulse-epis
- http://epis.upt.edu.pe/acreditacion/index.php/inicio/concursoproyectos
- Ley 29733 Ley de Protección de Datos Personales del Perú.
- https://www.1edtech.org/standards/open-badges
