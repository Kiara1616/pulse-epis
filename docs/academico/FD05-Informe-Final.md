# Informe Final de Pulse EPIS

**Institución:** Universidad Privada de Tacna Facultad de Ingeniería Escuela Profesional de Ingeniería de Sistemas<br>
**Curso:** Inteligencia de Negocios<br>
**Autores:** Kiara Holly Zapana Murillo (2023077087) y Vincenzo Rafael Lllanos Niño (2023076796)<br>
**Código:** FD05<br>
**Versión:** 1.0<br>
**Fecha:** 02/10/2026<br>
**Base técnica:** main cf7ab75 y documentación del PR 51 a618c3e

## Control de versiones

| Versión | Fecha | Autores | Motivo |
|---|---|---|---|
| 1.0 | 02/10/2026 | Equipo del proyecto | Síntesis final del corte técnico y anexos académicos |

Revisión y aprobación: sin acta académica o institucional registrada. El informe final describe resultados técnicos y condiciones abiertas del corte documentado.

## 1 Antecedentes

### 1.1 Título y autores

Pulse EPIS Dashboard de certificaciones tecnológicas verificadas de los estudiantes de la Escuela Profesional de Ingeniería de Sistemas de la Universidad Privada de Tacna para acreditación y mejora curricular. Los autores son Kiara Zapana y Vincenzo Lllanos, identificados en la portada.

### 1.2 Contexto

La iniciativa relaciona padrón institucional, declaración de credenciales, evidencia, revisión humana y medición por corte. El repositorio evolucionó de interfaz demostrativa a frontend conectado con API, persistencia y ETL. La [línea base](../proyecto/00-Problema-y-linea-base.md) conserva las definiciones y deja claro que no hay una medición institucional cerrada.

## 2 Planteamiento del problema

### 2.1 Problema y justificación

La consolidación de certificaciones requiere evitar conteos duplicados, evidencias no aprobadas y denominadores sin población oficial. Un snapshot trazable permite reproducir lo que se contabilizó para acreditación. La solución mejora capacidad técnica de medición, pero no afirma ahorro ni cobertura real sin padrón autorizado y evaluación del piloto.

### 2.2 Alcance

Incluye identidad por sesión y rol, importación de padrón, registro privado, revisión, historial, ETL, indicadores agregados por corte, filtros y CSV. La publicación pública, perfil analítico independiente, mercado laboral externo, PDF operativo y paquete institucional siguen abiertos. La unidad inicial es EPIS; no se reemplaza el sistema académico.

### 2.3 Objetivos

Determinar cobertura y vigencia con población conciliada y evidencia aprobada, e implementar una solución BI reproducible para responsables y estudiantes. Los objetivos específicos OBJ-01 a OBJ-07 y sus metas se mantienen en [Objetivos medibles](../proyecto/01-Objetivos-medibles.md). Las metas de conciliación 95%, evidencia 100% y duplicados menor a 1% son criterios del piloto, no resultados institucionales medidos.

## 3 Marco teórico

### 3.1 Inteligencia de negocios y calidad

La solución transforma registros operacionales en hechos por periodo/corte para consultar indicadores. La calidad exige completitud, unicidad, validez y consistencia. El denominador de cobertura proviene de población ACTIVE, mientras la credencial elegible debe estar aprobada y vigente al corte según la implementación actual.

### 3.2 Identidad evidencia y arquitectura

OIDC obtiene identidad básica y RBAC restringe operaciones; la provisión institucional determina pertenencia. Una evidencia respalda la credencial pero no equivale a una aprobación: la revisión conserva actor, fecha y estado. La arquitectura modular mantiene esas responsabilidades en servicios y transacciones.

### 3.3 Reproducibilidad y privacidad

Hash de fuente, periodo y corte identifican corridas; un lote inválido conserva el snapshot anterior. La analítica no devuelve correos, códigos ni claves internas. El tratamiento se encuadra en la Ley 29733 y el [Reglamento D.S. 016-2024-JUS](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus), sujeto a política institucional y autorización.

## 4 Desarrollo de la solución

### 4.1 Análisis de factibilidad

| Dimensión | Resultado del análisis |
|---|---|
| Técnica | Stack y flujos implementados; capacidad/seguridad institucional requieren ensayo |
| Económica | Costos estimados y escenario reproducible; beneficios reales sin medir |
| Operativa | Requiere responsable de padrón, validador titular/respaldo y cierre |
| Legal | Finalidad, acceso, retención y autorización deben acordarse |
| Social | Adopción y capacitación necesarias; no ranking nominal público |
| Ambiental | Digitalización reduce potencialmente impresiones; consumo no cuantificado |

El [FD01](FD01-Informe-Factibilidad.md) desarrolla seis dimensiones, riesgos y evaluación financiera. La conclusión es viabilidad condicionada para piloto, sin aprobación automática de producción.

### 4.2 Tecnología de desarrollo

| Capa | Tecnología verificable | Responsabilidad |
|---|---|---|
| Frontend | Next.js 16.3.3, React 19.2.8, TypeScript y Recharts | Interfaz conectada y CSV en navegador |
| API | FastAPI y Pydantic | Contratos y autorización |
| Datos | PostgreSQL 16, SQLAlchemy y Alembic | Operación y snapshots |
| ETL | Python y servicios de dominio | Normalización, calidad e idempotencia |
| Evidencia | Filesystem privado con SHA-256 y token firmado | Binarios y acceso temporal |
| Operación | Docker Compose, Caddy y GitHub Actions | Ambientes, HTTPS y tareas |
| Documentación | Markdown, Mermaid y ReportLab | Manuales, diagramas, FD y OpenAPI |

### 4.3 Resultados técnicos y limitaciones

| Capacidad | Resultado verificable | Límite |
|---|---|---|
| Identidad | Sesión local de desarrollo y OIDC/RBAC | Configuración y cuentas institucionales externas |
| Padrón | Importación atómica e idempotente desde UI/API | Periodo inicial requiere preparación |
| Credenciales | Registro propio y evidencia privada | Edición/habilidades de UI incompletas |
| Revisión | Bandeja, decisiones e historial persistente | Responsables institucionales por designar |
| Analítica | Snapshots, filtros, evolución por corte y CSV | PDF operativo y mercado externo pendientes |
| Operación | Compose y workflows versionados | Host, copia conjunta y restauración no demostrados |

Las pruebas disponibles se documentan en [Pruebas y aceptación](../proyecto/17-Pruebas-y-aceptacion.md). Los resultados ejecutados se registran por commit en el [registro de validación](../proyecto/19-Registro-de-validacion.md). No se atribuyen a este informe mediciones institucionales inexistentes ni una conformidad del cliente.

## 5 Metodología de implementación

El repositorio utiliza issues, ramas, PR, revisión y CI. Esta trazabilidad permite vincular una necesidad con requisito, código y prueba; no se afirma haber aplicado formalmente RUP/Scrum con actas que no consten. La documentación del curso organiza análisis, diseño y cierre, y la guía de contribución define Definition of Done.

| Etapa de trabajo | Producto |
|---|---|
| Análisis | Problema, objetivos, factibilidad y visión |
| Especificación | RF, RNF, reglas y escenarios |
| Diseño | Vistas, contratos y modelo de datos |
| Construcción | Frontend, API, persistencia y ETL |
| Verificación | Suites, CI y documentación reproducible |
| Piloto | Autorización, conciliación, métricas y aceptación por completar |

## 6 Cronograma

El plan del piloto comprende 16 semanas; es una secuencia propuesta, sin fechas contractuales ni cierre institucional probado.

| Fase | Semanas | Puerta de control |
|---|---|---|
| Gobierno y acceso | 1 a 2 | Fuente, responsables y autorización |
| Modelo y backend | 3 a 5 | Migraciones, identidad y permisos |
| Ingesta y validación | 6 a 8 | Conciliación, evidencia e historial |
| BI y reportes | 9 a 11 | Fórmulas y cortes contrastados |
| Calidad y seguridad | 12 a 13 | Pruebas y recuperación |
| Piloto y decisión | 14 a 16 | Metas medidas y acta |

El camino crítico depende primero de autorización, luego de población conciliada y evidencia; un dashboard funcional sin padrón no permite cerrar cobertura institucional.

## 7 Presupuesto y evaluación financiera

FD01 estima costos técnicos recurrentes de S/ 0 a 470 mensuales y S/ 0 a 150 anuales de dominio, sujetos a infraestructura institucional y cotizaciones. El trabajo académico tiene costo de caja distinto de su valorización económica.

El escenario didáctico de FD01 utiliza inversión valorizada S/ 4800, beneficios monetizados S/ 7200/año, egresos S/ 4740/año, neto S/ 2460 durante tres años y tasa supuesta 10%. Resulta VAN S/ 1317.66; TIR 25.03% y B/C 1.0794, calculados con el mismo flujo. No representa ventas, presupuesto aprobado ni ahorro observado. La sensibilidad muestra que un ahorro menor puede hacer negativo el VAN.

## 8 Conclusiones

El corte técnico contiene los principales flujos de una plataforma BI de certificaciones, con identidad, padrón, evidencia, revisión, ETL e indicadores. La documentación separa entregables del curso de manuales permanentes y conserva fuentes con generación completa. La versión final del informe no equivale a aceptación institucional: faltan padrón autorizado, responsables, mediciones y recuperación integral probada.

## 9 Recomendaciones

Priorizar autorización y conciliación antes de usar cifras oficiales. Completar edición/habilidades, PDF operativo y metadatos según el SRS. Ensayar backup/restore de base y evidencia, verificar OIDC y dominios, medir rendimiento/accesibilidad y conservar evidencia de cierre. Incorporar demanda laboral solo con fuente, fecha, ubicación y normalización aprobadas.

## 10 Anexos y referencias

- Anexo 01 [Informe de Factibilidad](FD01-Informe-Factibilidad.md).
- Anexo 02 [Documento de Visión](FD02-Informe-Vision.md).
- Anexo 03 [SRS y escenarios](FD03-Especificacion-Requerimientos.md).
- Anexo 04 [SAD y calidad](FD04-Arquitectura-Software.md).
- Anexo 05 [Manuales técnicos](../proyecto/README.md), [manual de usuario](../proyecto/10-Manual-de-usuario.md), [API](../proyecto/15-API-y-contratos.md) y [recursos](../recursos/README.md).
- [Matriz de cobertura de formatos](Matriz-de-cobertura.md).
- [Repositorio y fuentes de implementación](https://github.com/Kiara1616/pulse-epis).

Los anexos son los documentos del paquete generado, enlazados para evitar versiones duplicadas. Ningún anexo incluye padrón nominal ni archivos de evidencia de estudiantes.
