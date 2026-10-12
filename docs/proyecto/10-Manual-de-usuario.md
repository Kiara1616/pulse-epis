# Manual de usuario de Pulse EPIS

## Alcance y acceso

El portal está conectado a la API para padrón, registro, validación e indicadores. Los datos locales pueden ser sintéticos; cifras oficiales requieren fuente autorizada y cierre institucional. La sesión determina el rol, sin selector manual. Si una página no está disponible para su rol, solicite revisión de permisos al responsable.

## Iniciar y cerrar sesión

En entorno institucional, seleccione Google y use la cuenta provisionada por el administrador. Se solicita identidad básica, sin acceso a Gmail. El dominio permitido por sí solo no habilita una cuenta; STUDENT debe estar vinculado al padrón. En desarrollo aparece acceso local con las cuentas sintéticas entregadas por el equipo. Cierre sesión al terminar.

## STUDENT registrar certificación

1. Abra Mi perfil y Nueva certificación.
2. Complete nombre, emisor, fecha de emisión y habilidades; agregue expiración si existe.
3. Adjunte archivo admitido o URL de evidencia conforme al formulario.
4. Envíe y compruebe que la credencial aparece como Pendiente.
5. Espere la revisión. Una observación solicita datos/evidencia adicional.

Abra Ver detalle para consultar evidencias y el comentario del validador. Si el registro está observado, corrija los campos o adjunte evidencia adicional y pulse Reenviar corrección. Las evidencias existentes se conservan. Si falla la carga inicial del adjunto, el formulario conserva el registro creado para reintentar sin duplicarlo. Nunca intente aprobar su propia credencial ni consultar otra persona.

## VALIDATOR revisar evidencia

1. Abra Validaciones y seleccione una credencial.
2. Solicite el enlace temporal de evidencia y compruebe titularidad, emisor y fechas.
3. Seleccione Tomar revisión para pasar a En revisión.
4. Apruebe, observe o rechace. Observación y rechazo exigen comentario.
5. Compruebe el resultado y abra Ver historial para consultar las transiciones y comentarios. Aprobar requiere evidencia vigente.

Un enlace vencido requiere emitir uno nuevo. Una aprobación no cambia de inmediato un snapshot ya publicado: los indicadores se actualizan después del ETL para el corte correspondiente.

## ADMIN importar padrón

1. Prepare el CSV conforme a la [plantilla](../recursos/templates/padron.csv).
2. Abra Padrón y seleccione el archivo. La vista previa muestra los periodos presentes y su número de filas.
3. Envíe y revise totales y causas de rechazo.
4. Corrija la fuente completa y repita si es necesario; un lote inválido no aplica filas parciales.
5. Revise historial para confirmar APPLIED o REJECTED.

El catálogo del padrón es independiente de los indicadores publicados. Registre un periodo nuevo con su código, fecha de inicio y fecha de fin. Para un CSV con varios periodos, seleccione uno e importe; después seleccione el siguiente sin volver a elegir archivo. Cada carga aplica solamente las filas del periodo elegido y conserva su propio historial. Repetir una carga idéntica no duplica registros.

## ADMIN consultar estudiantes

Abra Estudiantes para consultar automáticamente el último periodo que tiene matrículas importadas. Puede cambiar el periodo, buscar por código o correo y avanzar entre páginas. El listado nominal está disponible únicamente para administradores. El CSV actual no contiene nombres, por lo que se muestran los campos realmente importados.

## ADMIN publicar indicadores

Abra Publicar indicadores, seleccione un periodo con padrón aplicado y una fecha de corte dentro del semestre. Pulse Publicar indicadores y compruebe el resultado y el historial. Si existen rechazos de calidad, revise sus motivos antes de repetir. La publicación utiliza certificaciones aprobadas emitidas hasta el corte y estudiantes matriculados en ese periodo. El resumen y los filtros analíticos se habilitan a partir de publicaciones aplicadas.

## Indicadores filtros y exportación

ADMIN y VALIDATOR consultan vistas habilitadas de indicadores. Seleccione periodo, corte, año de ingreso, ciclo y emisor. Próximas a vencer comprende 90 días desde el corte. Brecha por habilidad indica estudiantes activos sin certificación en esa habilidad.

En local, la demostración carga automáticamente ejemplos sintéticos de certificaciones para los 14 semestres desde 2020-I hasta 2026-II. Use Fuente de datos para cambiar a Datos registrados; la selección se conserva al navegar. La demostración está en una base independiente y no modifica el padrón importado. Los informes exportados identifican esta fuente.

La exportación CSV descarga las filas y los filtros de la vista. El botón PDF genera un informe agregado del periodo y corte seleccionados. Verifique los filtros antes de compartir. Los informes no contienen correos ni códigos de estudiantes y requieren revisión institucional para su uso oficial.

## Errores frecuentes

| Situación | Acción |
|---|---|
| Sesión vencida o UNAUTHENTICATED | Iniciar sesión nuevamente |
| FORBIDDEN | Usar flujo del rol y solicitar revisión autorizada de permisos |
| Periodo o snapshot no encontrado | Solicitar revisión de periodo y ETL |
| Campo o archivo inválido | Corregir información; usar PDF/PNG/JPEG dentro del límite |
| Duplicado | Revisar el registro existente antes de volver a enviar |
| Servicio no disponible | Reintentar y comunicar request_id al equipo técnico |

## Privacidad y soporte

No publique CSV reales, correos, códigos, evidencias ni URLs privadas en capturas, issues o repositorios. Comparta solo agregados autorizados. En soporte comunique página, hora, acción y request_id sin datos personales. Las decisiones institucionales y atención de solicitudes se realizan por el canal definido por EPIS.

## VA-06: centro administrativo y prioridades del corte

La issue #72 reorganiza `/admin` para ADMIN y añade prioridades en el resumen institucional del mismo rol. Reutiliza `/indicators/overview`, filtros y selección de fuente existentes. No añade tablas, fuentes externas, un radar ni permisos de validación al administrador. Los contratos de VA-02 (#68) siguen pendientes de revisión: esta pantalla utiliza los tipos vigentes de AnalyticsOverview, sin duplicar ni consolidar entidades provisionales.

Cada KPI muestra definición y un detalle desplegable de fuente, dataset, periodo y corte. Los próximos vencimientos usan la ventana de 90 días de la API. Estudiantes y credenciales son conteos diferentes. La ausencia de activos se explica antes de interpretar cobertura cero. Las prioridades de habilidades se ordenan por cobertura ascendente, luego cantidad sin evidencia y nombre; se muestran hasta tres, sin umbrales o rankings laborales inventados. La ausencia de brechas registradas no acredita dominio.

Los enlaces a tecnologías y brechas conservan periodo, corte y filtros mediante parámetros URL. useAnalytics reconoce ese alcance al cargar los periodos disponibles. Dataset demo solo se admite bajo autenticación local; un enlace nunca cambia rol ni permisos. Cambiar fuente o periodo reinicia el alcance según el comportamiento existente. Las fichas de estudiantes mantienen su acceso nominal autorizado y no ofrecen un filtro de vencimientos inexistente.

Las opciones de proveedor, año de ingreso y ciclo se consultan para el periodo, corte y fuente seleccionados, sin aplicar los filtros de segmento. Abrir una prioridad con ciclo VI conserva VI y permite elegir otro ciclo disponible sin limpiar la selección. Los indicadores mantienen todos los filtros elegidos. Si falla la carga de opciones, se muestra el error y Reintentar vuelve a consultarlas conservando la selección.

Calidad de datos consulta `/etl/runs?period_code=...` únicamente para ADMIN y datos registrados. Muestra el último intento de publicación del corte exacto según el orden del historial de la API. Si no hay informe, no inventa porcentajes de calidad ni aprobación. El resultado pertenece al periodo completo: filtros de proveedor/cohorte/ciclo no alteran las filas del proceso. Estas filas son registros del ETL, no personas ni credenciales distintas. En demo no se consulta este historial ni se atribuye calidad institucional a datos sintéticos. Error y reintento de calidad son independientes de la carga de indicadores.

Validadores conservan el resumen permitido, pero no reciben gestión, prioridades administrativas ni consultas a calidad. Estudiantes siguen entrando a su espacio. Las tarjetas administrativas llevan a padrón, tecnologías y publicaciones; no hay una tarjeta sin acción que sugiera permiso para validar evidencias.

Pruebas: `npx playwright test e2e/admin-priorities.spec.ts` verifica filtros, navegación con alcance, calidad sin informe/error/reintento, demostración, restricciones de rol, errores de indicadores y selección del corte. Capturas sintéticas: [escritorio](../recursos/imagenes/va72-admin-demo.png) y [móvil](../recursos/imagenes/va72-admin-mobile-demo.png). No hay migraciones; rollback mediante reversión del commit y reconstrucción del frontend.

## VA-07: estados y navegación por rol

#73 comparte etiquetas y tonos de certificación en estudiante, validador e historial. APPROVED se muestra como Aprobada; desconocidos usan Estado no reconocido y tono neutral. AsyncState unifica carga, error accesible con reintento y vacío, con texto y acción configurables. El encabezado distingue los tres roles sin selector de permisos. La bandeja monta consultas dentro de RoleGate: los otros roles no inician peticiones de validación. Backend conserva la autoridad de acceso.

El centro administrativo de #72 ya está integrado desde main. La integración de futuras pantallas #69/#71 queda pendiente de sus PR. No se modifican datos ni transiciones del servicio. Tests incluyen sesión expirada, consultas bloqueadas, etiquetas, error/reintento/vacío y móvil. [Captura sintética](../recursos/imagenes/va73-feedback-demo.png). Rollback: revertir commit y reconstruir frontend, sin migraciones.

## VA-09: prototipo del radar de cursos

#75 añade /admin/radar, protegido para ADMIN, y accesos desde sidebar y centro administrativo. Es una demostración con tres cursos sintéticos y fuentes example.invalid: no descarga URLs, no guarda datos y no publica para estudiantes. Las acciones afectan memoria y se reinician al recargar.

DETECTED permite iniciar revisión o descartar; IN_REVIEW permite corregir título/requisitos y definir audiencia y relevancia, publicar o descartar. Publicar exige audiencia no vacía y explicación de al menos 10 caracteres; no ocurre automáticamente. PUBLISHED permite retirar; descartado/retirado son terminales en esta demostración. Cada tarjeta conserva fuente, consulta, requisitos, estado e historial simulado. El filtro contempla vacío.

Audiencia se declara como texto de ejemplo; los catálogos y relaciones finales dependen del modelo #77 y la API #78. Los contratos #68 y el centro administrativo #72/#73 ya están integrados desde main; el Radar conserva sus indicadores, prioridades, calidad y enlaces existentes. No equivale a inscripción, elegibilidad o recomendación institucional. [Captura sintética](../recursos/imagenes/va75-radar-demo.png). Pruebas: flujo corregir/publicar/retirar, requisito de audiencia/relevancia, descarte, filtro, reinicio y permisos. Rollback: revertir commit y reconstruir frontend; sin migraciones.

### Próxima integración de formación

La API `/learning` entregada en #78 permite preferencias y solicitudes propias del estudiante y administración de catálogos/publicación/talleres. Aún no está conectada a las pantallas: el radar de #75 sigue siendo demostrativo hasta #79. La prueba HTTP integral de #80 utiliza datos sintéticos y confirma persistencia; no se presenta como aceptación visual institucional. Contratos y límites se documentan en [API y contratos](15-API-y-contratos.md) y [pruebas y aceptación](17-Pruebas-y-aceptacion.md).
