# Informe de Factibilidad

**Proyecto:** Pulse EPIS Dashboard de certificaciones tecnológicas verificadas de estudiantes de la EPIS<br>
**Institución:** Universidad Privada de Tacna Facultad de Ingeniería Escuela Profesional de Ingeniería de Sistemas<br>
**Curso:** Inteligencia de Negocios<br>
**Integrantes:** Kiara Holly Zapana Murillo (2023077087) y Vincenzo Rafael Lllanos Niño (2023076796)<br>
**Código:** FD01<br>
**Versión:** 3.2<br>
**Fecha:** 02/10/2026<br>
**Base técnica:** main cf7ab75 y documentación del PR 51 a618c3e

## Control de versiones

| Versión | Fecha | Autores | Motivo |
|---|---|---|---|
| 2.x | Septiembre 2026 | Kiara Zapana y Vincenzo Lllanos | Desarrollo de las fuentes del proyecto |
| 3.0 | 01/10/2026 | Vincenzo Lllanos | Generación académica FD01 a FD04 en PR 51 |
| 3.1 | 02/10/2026 | Equipo del proyecto | Organización documental y actualización contra el código |
| 3.2 | 02/10/2026 | Equipo del proyecto | Alineación del índice FD01 con la estructura académica indicada |

Revisión y aprobación académica: sin acta registrada. La versión del documento no certifica una aprobación ni un despliegue institucional.

## Resumen ejecutivo y decisión

Pulse EPIS es viable de forma condicionada para un piloto. Existen frontend, API, autenticación, persistencia, validación, ETL, indicadores y contenedores; la disponibilidad institucional depende de padrón autorizado, responsables, configuración de ambientes y recuperación probada. No hay cifras institucionales de cobertura ni beneficios económicos medidos.

## 1. DESCRIPCIÓN DEL PROYECTO

### 1.1. NOMBRE DEL PROYECTO

**Pulse EPIS Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS**.

### 1.2. DURACIÓN DEL PROYECTO

La planificación del piloto comprende 16 semanas de trabajo, sujeta a disponibilidad de responsables y autorización de datos. El cronograma de ejecución se desarrolla en el Anexo A; no constituye una fecha contractual de entrega.

### 1.3. DESCRIPCIÓN

La EPIS necesita demostrar, para sus procesos de mejora continua y acreditación, qué proporción de sus estudiantes activos posee certificaciones tecnológicas válidas, cómo evoluciona el indicador y qué brechas existen frente al mercado laboral. La información puede encontrarse dispersa entre formularios, hojas de cálculo, certificados PDF, plataformas de insignias y registros académicos. Una cifra agregada publicada en el portal institucional permite conocer el contexto, pero no identifica de forma confiable a cada estudiante ni prueba que una credencial le pertenezca.

Pulse EPIS centralizará el padrón académico autorizado y las evidencias de certificación, validará cada registro y producirá indicadores trazables. La fuente de identidad será un padrón entregado por EPIS o Secretaría Académica con código universitario, correo institucional, estado y ciclo; no se obtendrán identidades mediante scraping de páginas públicas.

La definición operativa es deliberadamente estricta: el padrón oficial determina el denominador; una certificación solo entra en los KPI después de conciliar titularidad, emisor, fechas, evidencia, estado aprobado y duplicidad. La línea base actual es sintética y sirve únicamente para demostrar el prototipo; la línea base institucional se levantará durante el piloto con fecha de corte aprobada por EPIS.

**Alcance de la solución:**

Incluye autenticación institucional, carga del padrón, registro de certificaciones, evidencias, validación administrativa, ETL, almacén analítico, dashboard, filtros, exportación y auditoría. El MVP atenderá a la EPIS y podrá ampliarse a otras escuelas.

No incluye acceso no autorizado al sistema académico, extracción de perfiles privados, verificación biométrica, scraping de identidades, ni rankings nominales públicos. Las integraciones con proveedores solo se habilitarán después de verificar sus términos, permisos y límites técnicos.

### 1.4. OBJETIVOS

Los objetivos guían el desarrollo y la evaluación del piloto; su cumplimiento requiere las mediciones y autorizaciones identificadas en este informe.

#### 1.4.1. OBJETIVO GENERAL

Diseñar e implementar una plataforma de inteligencia de negocios que consolide, valide y visualice las certificaciones de los estudiantes de la EPIS para apoyar la acreditación, la mejora curricular y la identificación de talento.

#### 1.4.2. OBJETIVOS ESPECÍFICOS

1. Integrar el padrón oficial con certificaciones reportadas y credenciales digitales verificables.
2. Calcular indicadores por periodo, cohorte, ciclo, proveedor, nivel y área tecnológica.
3. Mantener evidencia y trazabilidad del origen y estado de validación.
4. Proteger datos personales mediante control de acceso, seudonimización y publicación agregada.
5. Comparar competencias certificadas con señales documentadas de demanda laboral.
6. Generar reportes exportables para calidad y acreditación.

## 2. RIESGOS

Escala: **Probabilidad** = baja, media o alta; **Impacto** = bajo, medio, alto o crítico. El riesgo residual supone que las acciones preventivas ya fueron implementadas.

| ID | Riesgo | Categoría | Prob. | Impacto | Señal de activación | Responsable | Prevención | Contingencia | Residual |
|---|---|---|:---:|:---:|---|---|---|---|:---:|
| R-01 | Padrón incompleto, desactualizado o sin fecha de corte | Datos | Alta | Alto | Diferencia entre padrón y conteo oficial | Responsable de datos | Acta de entrega, esquema obligatorio y conciliación | Pausar KPI nominal y emitir reporte de faltantes | Medio |
| R-02 | Certificado falso, vencido o duplicado | Calidad | Media | Alto | Evidencia no verificable o coincidencia de hash/URL | VALIDATOR | Reglas de emisor, fechas, titularidad y unicidad | Marcar como observado/rechazado y solicitar corrección | Medio |
| R-03 | Proveedor limita API, cambia términos o bloquea automatización | Integración | Alta | Medio | Error 401/403, límite excedido o cambio de contrato | ADMIN | Priorizar fuentes autorizadas y registrar versión | Cambiar a carga CSV/URL y revisión manual | Medio |
| R-04 | Exposición de datos personales por configuración o exportación | Seguridad | Media | Crítico | Archivo o endpoint nominal accesible sin permiso | ADMIN / soporte | RBAC servidor, mínimo privilegio, cifrado y revisión de exportaciones | Revocar acceso, preservar logs, notificar y activar protocolo institucional | Medio |
| R-05 | Retención o uso incompatible con la finalidad declarada | Legal | Media | Alto | Solicitud de eliminación o campo sin propósito documentado | Responsable de datos | Diccionario, política de retención y revisión legal | Bloquear campo, anonimizar/eliminar y responder al titular | Bajo |
| R-06 | Baja participación estudiantil o poca capacidad de validación | Operación | Media | Alto | Evidencias pendientes o tiempos de revisión crecientes | ADMIN / VALIDATOR | Calendario, capacitación, validador de respaldo y estado visible | Ampliar ventana, priorizar cierre y reportar cobertura real | Medio |
| R-07 | Pérdida, corrupción o indisponibilidad de datos | Continuidad | Media | Crítico | Fallo de servicio o restauración no verificable | ADMIN / soporte | Copias automáticas, control de versiones y prueba de restauración | Restaurar último respaldo válido y registrar la incidencia | Medio |
| R-08 | Indicadores sesgados por fuentes laborales o categorías ambiguas | Analítica | Media | Medio | Resultado cambia por una sola fuente o taxonomía | Analista | Metodología visible, varias fuentes y catálogo versionado | Publicar limitación y recalcular con una fuente revisada | Bajo |
| R-09 | Dependencia de dos desarrolladores | Proyecto | Alta | Medio | Incidencia sin responsable o conocimiento concentrado | Dirección / equipo | README, documentación, revisión por pares y CI | Congelar alcance, transferir conocimiento y priorizar correcciones | Medio |
| R-10 | El costo real supera la estimación inicial | Económico | Media | Medio | Límite gratuito excedido o cotización mayor | ADMIN / Dirección | Presupuesto por escenario y alertas de consumo | Volver a infraestructura institucional y reducir alcance | Bajo |

La matriz se revisará en cada hito y ante un cambio de proveedor, fuente, finalidad o alcance. Los riesgos R-01, R-04 y R-05 son bloqueantes para publicar datos nominales aunque el dashboard técnico funcione.

## 3. ANÁLISIS DE LA SITUACIÓN ACTUAL

### 3.1. PLANTEAMIENTO DEL PROBLEMA

La consolidación de certificaciones debe conciliar población, evidencias, estados y fechas para producir un reporte reproducible. El problema y la línea base se documentan en [Problema y línea base](../proyecto/00-Problema-y-linea-base.md). No se afirma que existan entrevistas, actas ni indicadores institucionales que no estén respaldados por una fuente.

### 3.2. CONSIDERACIONES DE HARDWARE Y SOFTWARE

| Recurso | Uso | Criterio para el piloto |
|---|---|---|
| Equipo del desarrollador | Compilación y pruebas | Node.js 20+, Python 3.12+ y Docker Compose v2 |
| Host Linux | Frontend, API, proxy y PostgreSQL | Capacidad dimensionada mediante pruebas de carga |
| Volúmenes persistentes | Base y evidencias | Capacidad según cantidad, tamaño y retención de archivos |
| Dispositivo cliente | Uso del portal | Navegador vigente y acceso HTTPS |
| Red y dominio | Acceso institucional | DNS, TLS y conectividad autorizados |

Los requisitos de CPU, memoria y almacenamiento deben medirse antes de contratar; no se presenta una estimación como infraestructura ya disponible.

## 4. ESTUDIO DE FACTIBILIDAD

### 4.1. FACTIBILIDAD TÉCNICA

#### 4.1.1 Qué demuestra el prototipo actual

El repositorio demuestra viabilidad visual con Next.js, TypeScript, Tailwind CSS y Recharts. También contiene un ETL reproducible en Python, una API FastAPI, migraciones PostgreSQL, persistencia de certificaciones y validaciones, autenticación OIDC/RBAC, login local para desarrollo, Compose y workflows de calidad/despliegue.

La semilla local y los fixtures de pruebas contienen datos sintéticos y no representan la línea base institucional. El dashboard consume snapshots de la API, sin depender de los JSON históricos eliminados.

En consecuencia, el prototipo permite revisar la experiencia y la lógica de presentación, y ya ofrece una base persistente y segura para el backend. La analítica y sus filtros están conectados a snapshots ETL; faltan la integración operativa con un padrón real autorizado, respaldos/restauración probados y la validación de un ambiente institucional.

#### 4.1.2 Diferencia entre prototipo y producción

| Capacidad | Prototipo del repositorio | Requisito para piloto/producción |
|---|---|---|
| Identidad | Sesión local de desarrollo, Google OIDC/RBAC y padrón sintético | Padrón autorizado, `student_key` y conciliación por corte |
| Certificaciones | Registro persistente con estado, emisor, fechas y evidencia | Operación institucional y políticas de retención verificadas |
| Validación | Reglas, decisiones, observaciones, historial y auditoría en backend | Flujo operativo con responsables y evidencias autorizadas |
| Acceso | AuthBoundary/RoleGate en frontend y autorización server-side | Autenticación institucional y RBAC aplicado a todos los flujos |
| Almacenamiento | PostgreSQL/migraciones y almacenamiento local privado | Evidencias privadas con respaldo y restauración probados |
| Indicadores | API, snapshots ETL, filtros, evolución por corte y CSV conectados | Consultas reproducibles por periodo y fecha de corte |
| Integraciones | ETL reproducible, validación de calidad y Compose | Importación autorizada, límites documentados y reintentos |
| Publicación | Vistas restringidas y agregadas en evolución | Separación comprobada entre vistas nominales y públicas |
| Operación | CI/CD y Compose disponibles; staging/prod requieren host y secretos | Monitoreo, logs, restauración y responsable de soporte |

#### 4.1.3 Arquitectura objetivo

Para el piloto se propone PostgreSQL como almacén transaccional y analítico inicial, la API modular FastAPI implementada, almacenamiento privado de evidencias y tareas programadas para importación y recalculo. La interfaz existente puede evolucionar sobre Next.js.

La API pública de Credly no debe asumirse capaz de buscar libremente por correo. Se usará una URL pública entregada por el estudiante, Open Badges cuando esté disponible, un archivo autorizado o revisión humana. Cualquier proveedor deberá pasar por una prueba de permisos, límites, términos de uso y recuperación ante errores.

#### 4.1.4 Brechas técnicas y criterio de salida

No se recomienda declarar producción mientras falte cualquiera de estos controles: autenticación, autorización del lado servidor, validación de entradas, cifrado en tránsito y reposo cuando corresponda, copia de respaldo probada, trazabilidad de decisiones y pruebas de restauración. El piloto puede iniciar con servicios administrados de bajo costo si los datos nominales permanecen restringidos y el responsable institucional aprueba la configuración.

### 4.2. FACTIBILIDAD ECONÓMICA

#### 4.2.1 Supuestos de estimación

Los montos son una **estimación de planificación**, no una cotización ni una promesa de gasto institucional. Se expresan en soles peruanos, no incluyen impuestos ni costos contractuales que EPIS deba negociar y deben actualizarse antes del piloto.

Se asume que:

- el desarrollo académico del equipo no genera un desembolso directo para el piloto;
- EPIS puede proporcionar o reutilizar una cuenta institucional, dominio o infraestructura existente;
- el piloto comienza con una escuela, una carga periódica y un volumen reducido de evidencias;
- el almacenamiento de certificados crece según el número y tamaño real de los archivos;
- no se contratará una API externa ni scraping para suplir la ausencia de un padrón autorizado;
- el costo laboral de validadores, responsable de datos y soporte se controla como recurso institucional, aunque debe reconocerse en la evaluación definitiva.

#### 4.2.2 Costos previstos

| Concepto | Tipo | Alternativa inicial | Rango de planificación | Supuesto que puede cambiarlo |
|---|---|---|---:|---|
| Análisis y desarrollo académico | Único | Trabajo del equipo | S/ 0 directo | No incluye valorización de horas de trabajo |
| Dominio | Anual | Subdominio institucional o dominio existente | S/ 0–150/año | Precio, renovación y proveedor |
| Frontend y API | Mensual | Servicio educativo, gratuito o infraestructura EPIS | S/ 0–150/mes | Tráfico, límites y necesidad de entorno separado |
| PostgreSQL | Mensual | Plan gratuito/educativo o servidor institucional | S/ 0–120/mes | Tamaño, respaldos, alta disponibilidad y soporte |
| Evidencias privadas | Mensual | Almacenamiento institucional o de objetos | S/ 0–100/mes inicial | Número, tamaño, retención y copias |
| Monitoreo y correo transaccional | Mensual | Herramientas institucionales o plan gratuito | S/ 0–100/mes | Alertas, volumen y retención de logs |
| API o verificación de terceros | Variable | URL pública, archivo autorizado y revisión humana | S/ 0 inicialmente | Licencia, límites y términos del proveedor |
| Capacitación y soporte | Recurrente | Responsables de EPIS | Por definir | Horas institucionales y nivel de servicio |

Con las alternativas iniciales, el costo técnico recurrente de referencia es **S/ 0–470 mensuales**, incluyendo hasta S/ 100 mensuales de almacenamiento inicial, y **S/ 0–150 anuales por dominio**. Si el volumen de evidencias supera el supuesto del piloto, se añadirá el costo variable correspondiente. Este rango sirve para comparar opciones durante el piloto; no autoriza una contratación. La alternativa preferida es reutilizar infraestructura institucional y contratar servicios externos solo cuando exista una necesidad cuantificada.

El beneficio esperado es reducir consolidación manual, reprocesos y tiempo de preparación de evidencias para acreditación. La medición de ese beneficio se realizará en el piloto comparando horas y errores del proceso actual contra el proceso con Pulse EPIS; no se asigna un ahorro monetario sin datos observados.

### 4.3. FACTIBILIDAD OPERATIVA

#### 4.3.1 Responsabilidades mínimas

| Responsabilidad | Decisión o tarea | Rol MVP |
|---|---|---|
| Gobierno del padrón | Autorizar fuente, corte, cambios y retención | ADMIN / responsable de datos |
| Validación de credenciales | Aprobar, observar o rechazar evidencias | VALIDATOR |
| Registro personal | Declarar certificaciones y corregir información propia | STUDENT |
| Indicadores | Consultar tendencias y brechas sin modificar datos | Vista de analista |
| Publicación | Mostrar únicamente agregados y contexto metodológico | ADMIN |
| Supervisión | Aprobar alcance y recibir reportes | Dirección / Comité |

La operación requiere un responsable de datos, al menos un validador titular y uno de respaldo, un calendario de cierre semestral y un canal para correcciones. Si no se designan esas personas, el sistema puede mostrar una interfaz, pero no puede producir una cifra institucional confiable.

#### 4.3.2 Tratamiento legal y social

El tratamiento debe diseñarse conforme a la Ley peruana 29733 y su Reglamento aprobado por el D.S. 016-2024-JUS y a las políticas de la Universidad. Este documento no sustituye una revisión legal institucional. Antes del piloto se debe definir formalmente la finalidad, base habilitante o consentimiento cuando corresponda, aviso de privacidad, minimización de campos, perfiles de acceso, plazo de retención, eliminación o anonimización y atención de derechos del titular.

El padrón y las evidencias nominales permanecerán restringidos. Las vistas públicas usarán agregados, umbrales de publicación cuando sean necesarios y una fecha de corte visible. Nombres, correos, códigos, enlaces privados y rankings nominales no se publicarán sin autorización y finalidad académica explícita. Las métricas de demanda laboral se presentarán como señales documentadas, no como una garantía de empleabilidad ni como criterio automático de evaluación de estudiantes.

### 4.4. FACTIBILIDAD LEGAL

La finalidad, acceso, conservación y eliminación de datos deben acordarse con la Universidad. Se toman como marco la Ley 29733 y el [Reglamento D.S. 016-2024-JUS](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus). Las sesiones y permisos ayudan a aplicar restricciones técnicas, pero no certifican cumplimiento legal. La autorización del padrón y la política de retención son condiciones previas al piloto real.

### 4.5. FACTIBILIDAD SOCIAL

La solución puede facilitar evidencia para acreditación y el seguimiento de logros. Su adopción requiere capacitación y participación voluntaria conforme a la política institucional. No se publican rankings nominales ni se usa la cobertura como evaluación automática de una persona.

### 4.6. FACTIBILIDAD AMBIENTAL

La gestión digital puede reducir copias impresas y traslados de documentos. A la vez, los contenedores, respaldos y almacenamiento consumen energía y recursos. Se propone retener solo lo necesario, evitar duplicación de binarios y medir consumo; no se cuantifica una reducción ambiental sin evidencia.

## 5. ANÁLISIS FINANCIERO

### 5.1. JUSTIFICACIÓN DE LA INVERSIÓN

El propósito económico es reducir consolidación manual y reprocesos, sin confundir el costo de caja de un trabajo académico con el valor de las horas del equipo. La decisión de contratar infraestructura requiere cotizaciones y volumen del piloto. La siguiente evaluación es un escenario didáctico explícito para comprobar el método financiero; no representa beneficios medidos ni un presupuesto aprobado por EPIS.

**Supuestos del escenario financiero:**

| Variable | Valor supuesto | Base del supuesto |
|---|---|---|
| Inversión económica inicial I0 | S/ 4 800 | 2 integrantes por 16 semanas por 10 horas por semana por S/ 15/hora |
| Beneficio anual B | S/ 7 200 | 360 horas ahorradas por año por S/ 20/hora |
| Infraestructura anual | S/ 2 400 | S/ 200/mes dentro del rango de planificación |
| Validación anual | S/ 1 440 | 96 horas por S/ 15/hora |
| Soporte anual | S/ 900 | 60 horas por S/ 15/hora |
| Egresos anuales C | S/ 4 740 | Infraestructura más validación y soporte |
| Horizonte | 3 años | Hipótesis para comparación académica |
| Tasa de descuento r | 10% anual | Hipótesis, sin atribuirla a la Universidad |

### 5.2. BENEFICIOS DEL PROYECTO

Los beneficios se separan en resultados que pueden monetizarse con mediciones del piloto y mejoras cualitativas. No hay ingresos comerciales demostrados; el ahorro de tiempo no se registra como venta ni como efectivo recibido.

#### 5.2.1. BENEFICIOS TANGIBLES

| Beneficio | Indicador de medición | Tratamiento económico |
|---|---|---|
| Menor tiempo de consolidación | Horas por cierre antes y después del sistema | Escenario: 360 horas/año por S/ 20/hora = S/ 7 200/año |
| Menos reprocesos | Correcciones y horas dedicadas a resolverlas | Medir por separado; no sumar nuevamente horas incluidas en el ahorro de consolidación |

El valor de S/ 7 200 es una hipótesis didáctica, pendiente de medición y validación institucional.

#### 5.2.2. BENEFICIOS INTANGIBLES

| Beneficio | Evidencia para evaluarlo |
|---|---|
| Trazabilidad para acreditación | Reportes reproducibles y decisiones vinculadas con evidencia |
| Confianza en los indicadores | Definiciones, fuentes y fecha de corte visibles |
| Continuidad del conocimiento | Responsables definidos, manuales y pruebas de recuperación |
| Apoyo a mejora curricular | Análisis de cobertura y brechas con sus límites metodológicos |

No se asigna un monto monetario a estos beneficios para evitar inflar la evaluación.

### 5.3. TABLA DE EGRESOS OPERATIVOS ANUALES

| Concepto | Base de cálculo | Año 1 (S/) | Año 2 (S/) | Año 3 (S/) |
|---|---|---|---|---|
| Infraestructura | S/ 200/mes por 12 meses | 2 400 | 2 400 | 2 400 |
| Validación | 96 horas/año por S/ 15/hora | 1 440 | 1 440 | 1 440 |
| Soporte | 60 horas/año por S/ 15/hora | 900 | 900 | 900 |
| Total de egresos operativos | Infraestructura más validación y soporte | 4 740 | 4 740 | 4 740 |

La inversión inicial de S/ 4 800 corresponde al año 0 y se registra en el flujo neto, separada de los egresos recurrentes. Los costos son supuestos constantes, sin inflación ni impuestos; la infraestructura está dentro del rango de planificación de 4.2.

### 5.4. TABLA DE INGRESOS ANUALES

| Concepto | Año 1 (S/) | Año 2 (S/) | Año 3 (S/) | Naturaleza |
|---|---|---|---|---|
| Ingresos comerciales o cobros | 0 | 0 | 0 | No hay ventas o cobros previstos en este escenario académico |
| Beneficio económico equivalente | 7 200 | 7 200 | 7 200 | Ahorro hipotético de 360 horas/año por S/ 20/hora |
| Total considerado para evaluación económica | 7 200 | 7 200 | 7 200 | Beneficio monetizado; no constituye ingreso de caja |

Se conserva el título académico «ingresos anuales», distinguiendo el efectivo de los beneficios equivalentes. La evaluación es económica y no acredita recursos recibidos por la Universidad.

### 5.5. MATRIZ DEL FLUJO DE CAJA NETO

El flujo neto utilizado para la evaluación es de naturaleza económica: incorpora trabajo valorizado y ahorro de tiempo. Para cada año operativo, Ft = S/ 7 200 - S/ 4 740 = S/ 2 460; el año 0 registra -S/ 4 800.

| Periodo | Flujo económico | Factor al 10% | Flujo descontado |
|---|---|---|---|
| 0 | -4 800.00 | 1.000000 | -4 800.00 |
| 1 | 2 460.00 | 0.909091 | 2 236.36 |
| 2 | 2 460.00 | 0.826446 | 2 033.06 |
| 3 | 2 460.00 | 0.751315 | 1 848.23 |

Montos en soles, sin inflación, impuestos ni valor residual. No se presenta este flujo económico como un flujo bancario del equipo.

### 5.6. CRITERIOS DE INVERSIÓN

Se aplica una tasa de descuento hipotética de 10% anual y un horizonte de tres años al mismo escenario de 5.1 a 5.5. Los valores reproducibles se contrastan con scripts/documentation-finance.json mediante scripts/validate_docs.py.

#### 5.6.1. VALOR ACTUAL NETO (VAN)

`VAN = -I0 + suma(Ft / (1 + r)^t)` para t de 1 a 3.

El VAN del escenario es **S/ 1317.66**. Un VAN mayor que cero indica que los beneficios netos supuestos superan la inversión económica al descuento elegido. No confirma ahorro real sin mediciones del piloto.

#### 5.6.2. TASA INTERNA DE RETORNO

La TIR es la tasa que hace VAN = 0 para los flujos -4 800, 2 460, 2 460 y 2 460. Calculada mediante bisección, resulta **25.03%**. Supera el descuento supuesto de 10%; esta comparación solo vale para el escenario planteado.

#### 5.6.3. RELACIÓN BENEFICIO/COSTO (B/C)

`B/C = valor presente de beneficios / (inversión inicial + valor presente de egresos operativos)`.

La relación B/C es **1.0794**. Por cada sol de costo económico descontado se supone aproximadamente S/ 1,08 de beneficio descontado. El denominador incluye la inversión inicial para evitar sobreestimar el resultado.

**Sensibilidad y decisión:**

Si el ahorro anual es de 240 horas, el beneficio supuesto baja a S/ 4 800 y el neto anual a S/ 60: el VAN es negativo. El escenario depende fuertemente del ahorro observado. Antes de decidir inversión, EPIS debe medir horas actuales y futuras, aprobar la valorización de personal, obtener cotizaciones y revisar costos de respaldo, seguridad y soporte. El resultado didáctico positivo por sí solo no confirma rentabilidad institucional.

## 6. CONCLUSIONES

El sistema dispone de una base implementada para un piloto, incluyendo persistencia y autorización del lado servidor. Las condiciones abiertas son autorización de datos, provisión institucional, mediciones y restauración probada. La evaluación financiera presentada es un escenario didáctico sensible a sus supuestos; la factibilidad económica definitiva requiere un cierre observado. La ampliación institucional depende de las puertas de control y responsables descritos.

## Anexo A. Plan de ejecución

El plan de 16 semanas supone disponibilidad del responsable de datos y de los validadores. Las semanas son una secuencia de trabajo para el piloto, no una promesa de despliegue institucional.

| Fase | Semanas | Dependencia de entrada | Entregable / puerta de control |
|---|---:|---|---|
| Gobierno y acceso | 1–2 | Sponsor y responsable designados | Alcance, roles, finalidad, padrón de prueba y acta |
| Modelo y backend | 3–5 | Diccionario y reglas aprobadas | Esquema, API, autenticación y permisos probados |
| Ingesta y validación | 6–8 | Padrón conciliable y formulario | Carga, deduplicación, evidencia y bitácora |
| BI y reportes | 9–11 | Datos validados | KPI, filtros, fecha de corte y exportación |
| Calidad y seguridad | 12–13 | Flujo integrado | Pruebas, revisión de permisos, respaldo y restauración |
| Piloto y decisión | 14–16 | Puertas anteriores aprobadas | Capacitación, medición de metas y decisión de producción |

### A.1. Camino crítico

`Autorización del padrón → Diccionario y reglas → Modelo persistente → Ingesta y validación → KPI trazables → Seguridad y restauración → Piloto`.

Si se retrasa la autorización del padrón, se puede continuar con datos sintéticos para probar la interfaz, pero no se puede declarar éxito institucional ni cerrar la factibilidad de producción. La aprobación de cada puerta debe quedar registrada en el repositorio o en el acta institucional correspondiente.

## Anexo B. Criterios de éxito del piloto

Los objetivos y fórmulas completas se encuentran en [Objetivos e indicadores medibles](../proyecto/01-Objetivos-medibles.md). Para la decisión del piloto se verificará como mínimo:

- al menos 95 por ciento del padrón activo conciliado;
- 100 por ciento de las certificaciones incluidas en los KPI con fuente y estado;
- duplicados inferiores al 1 por ciento después del ETL;
- consultas principales en menos de dos segundos con el volumen del piloto;
- reportes reproducibles por periodo, filtros y fecha de corte;
- cero datos personales en vistas públicas;
- respaldo restaurado exitosamente en una prueba documentada;
- responsables de datos y validación identificados y activos.

No se considerará logrado un indicador si solo se cumple con los JSON sintéticos del prototipo.

## Anexo C. Gobierno de datos

La identificación utilizará un **identificador interno estable**. El código universitario será la clave natural de ingreso, pero en analítica se reemplazará por `student_key`, sin significado externo.

| Fuente | Datos mínimos | Uso | Tratamiento |
|---|---|---|---|
| Padrón oficial EPIS | código, correo, ciclo, estado y periodo | Denominador y vinculación | Acceso restringido; carga con fecha de corte |
| Formulario institucional | código, credencial, URL o PDF y consentimiento cuando corresponda | Registro de evidencia | Validación contra padrón |
| Credly u Open Badges | URL pública, emisor, emisión y expiración | Verificación | No se buscarán personas por correo sin autorización |
| Portal EPIS | totales agregados publicados | Contraste | No identifica personas |

El correo puede ayudar a validar el código, pero inferir el ciclo desde el año contenido en él es aproximado y no sustituye la matrícula. El flujo será: importar padrón, crear `student_key`, registrar evidencia, verificar emisor y fechas, resolver duplicados y cargar solo atributos necesarios al almacén analítico.

### C.1. Flujo operativo del piloto

| Paso | Actividad | Resultado verificable | Responsable principal |
|---:|---|---|---|
| 1 | Autorizar alcance, fecha de corte y padrón | Acta o autorización institucional | Responsable de datos / ADMIN |
| 2 | Importar y conciliar el padrón | Reporte de registros aceptados, rechazados y faltantes | ADMIN |
| 3 | Recibir certificaciones y evidencias | Registro con fuente, fecha y titular declarado | STUDENT |
| 4 | Revisar emisor, titularidad, vigencia y duplicidad | Decisión aprobada, observada o rechazada | VALIDATOR |
| 5 | Cerrar el periodo y publicar indicadores | KPI con corte, definición y trazabilidad | ADMIN / VALIDATOR |
| 6 | Atender correcciones y derechos del titular | Bitácora de cambios y respuesta documentada | Responsable de datos |

En el MVP se usarán tres roles técnicos (`ADMIN`, `VALIDATOR` y `STUDENT`). Los actores de negocio adicionales —responsable de datos, analista, visitante, Dirección o Comité— se atenderán mediante permisos y vistas específicas, sin multiplicar roles técnicos antes de contar con una necesidad demostrada.

## Anexo D. Reproducción del entregable

El comando `python scripts/build_docs.py` genera los documentos académicos y técnicos desde sus fuentes, con diagramas, OpenAPI e índice. `python scripts/build_academic_pdfs.py` genera únicamente los cinco FD. Las instrucciones completas se encuentran en [Generación documental](../proyecto/18-Generacion-documental.md).

## Referencias

- [Repositorio Pulse EPIS](https://github.com/Kiara1616/pulse-epis).
- [Portal institucional de la EPIS](http://epis.upt.edu.pe/acreditacion/index.php/inicio/concursoproyectos).
- [Ley 29733 — Ley de Protección de Datos Personales](https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470-29733).
- [1EdTech Open Badges](https://www.1edtech.org/standards/open-badges).
