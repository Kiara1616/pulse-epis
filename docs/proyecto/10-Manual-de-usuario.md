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

En el despliegue publicado no existe un selector de fuente demostrativa: los indicadores, reportes y exportaciones consultan únicamente snapshots publicados del padrón y certificaciones validadas. Los fixtures sintéticos se conservan solo para pruebas automatizadas y no se muestran en la interfaz ni se mezclan con datos institucionales.

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

## VA-06: centro administrativo y resumen ejecutivo

La issue #72 reorganiza `/admin` para ADMIN. El resumen ejecutivo reutiliza `/indicators/overview` y conserva solo los filtros de periodo y fecha de corte necesarios para interpretar el snapshot publicado. No añade tablas de texto extensas, selector de fuente, un radar ni permisos de validación al administrador.

Cada KPI presenta únicamente el valor y una etiqueta breve. Los próximos vencimientos usan la ventana de 90 días de la API. Estudiantes y credenciales son conteos diferentes. La ausencia de activos se explica antes de interpretar cobertura cero.

Los enlaces a tecnologías y brechas conservan periodo, corte y filtros mediante parámetros URL. `useAnalytics` reconoce ese alcance al cargar los periodos disponibles. Un enlace nunca cambia rol ni permisos. Las fichas de estudiantes mantienen su acceso nominal autorizado y no ofrecen un filtro de vencimientos inexistente.

Las opciones de proveedor, año de ingreso y ciclo se consultan para el periodo y corte seleccionados, sin aplicar los filtros de segmento. Los indicadores mantienen todos los filtros elegidos. Si falla la carga de opciones, se muestra el error y Reintentar vuelve a consultarlas conservando la selección.

La calidad del lote se revisa desde Padrón y Publicar indicadores, no desde una tarjeta extensa en el resumen. La ausencia de un informe no inventa porcentajes de calidad ni aprobación. Los indicadores del resumen pertenecen al snapshot publicado seleccionado.

Validadores conservan el resumen permitido, pero no reciben gestión, prioridades administrativas ni consultas a calidad. Estudiantes siguen entrando a su espacio. Las tarjetas administrativas llevan a padrón, tecnologías y publicaciones; no hay una tarjeta sin acción que sugiera permiso para validar evidencias.

Pruebas: `npx playwright test e2e/admin-priorities.spec.ts` verifica filtros, navegación con alcance, restricciones de rol, errores de indicadores y selección del corte. No hay migraciones; rollback mediante reversión del commit y reconstrucción del frontend.

## VA-07: estados y navegación por rol

#73 comparte etiquetas y tonos de certificación en estudiante, validador e historial. APPROVED se muestra como Aprobada; desconocidos usan Estado no reconocido y tono neutral. AsyncState unifica carga, error accesible con reintento y vacío, con texto y acción configurables. El encabezado distingue los tres roles sin selector de permisos. La bandeja monta consultas dentro de RoleGate: los otros roles no inician peticiones de validación. Backend conserva la autoridad de acceso.

El centro administrativo de #72 ya está integrado desde main. La integración de futuras pantallas #69/#71 queda pendiente de sus PR. No se modifican datos ni transiciones del servicio. Tests incluyen sesión expirada, consultas bloqueadas, etiquetas, error/reintento/vacío y móvil. [Captura sintética](../recursos/imagenes/va73-feedback-demo.png). Rollback: revertir commit y reconstruir frontend, sin migraciones.

## VA-09: prototipo del radar de cursos

#75 incorporó `/admin/radar`, protegido para `ADMIN`. En el estado actual de producción, el administrador registra un feed JSON/RSS público autorizado o revisa el feed curado versionado. La sincronización semanal conserva proveedor, URL oficial, fecha de consulta y estado; no se raspa HTML ni se crean certificaciones.

Un candidato `DETECTED` puede pasar a revisión o descartarse. En `IN_REVIEW`, el administrador puede corregir título/requisitos, definir audiencia por ciclo y explicar la relevancia. Publicar exige audiencia no vacía y explicación de al menos 10 caracteres. `PUBLISHED` permite retirar la oportunidad; todas las transiciones quedan persistidas y auditadas. Las tarjetas se agrupan por proveedor canónico y los enlaces se abren en la fuente oficial.

El Radar no equivale a inscripción, elegibilidad ni recomendación institucional. La captura sintética `va75-radar-demo.png` conserva evidencia histórica de un prototipo local y no representa la interfaz ni los datos publicados en Render. Pruebas: revisión/publicación/retiro, validación de audiencia y relevancia, duplicados, filtro, sincronización y permisos. Rollback: revertir el commit de aplicación y reconstruir frontend; las migraciones se revierten únicamente con respaldo y procedimiento documentado.

### Formación integrada y recorrido VA-14

La integración #79 conecta `/mi-ruta`, `/admin/radar` y `/talleres` con la API `/learning`. Los ejemplos de prototipo descritos arriba corresponden a entregas anteriores; las pantallas actuales guardan preferencias, solicitudes y decisiones reales de la sesión.

1. El estudiante registra una certificación y adjunta evidencia privada en `/mi-perfil`.
2. El validador abre el envío en `/validaciones`, revisa la evidencia, toma la revisión y decide. Observar o rechazar requiere comentario; el estudiante corrige únicamente cuando el backend lo permite.
3. El estudiante consulta la certificación aprobada y guarda intereses y una ruta publicada en `/mi-ruta`.
4. El administrador registra una fuente en `/admin/radar`, revisa el curso y publica una oportunidad con audiencia y relevancia.
5. En `/talleres`, el administrador crea y abre un taller asociado a la oportunidad publicada.
6. El estudiante lee los requisitos y envía una solicitud. El envío no reserva cupo; aceptar consume cupo y el backend impide superar el aforo.
7. El administrador registra una decisión con motivo. El estudiante consulta el estado y motivo en «Mis solicitudes», también tras volver a iniciar sesión.

Los catálogos de intereses y rutas requieren provisión administrativa por la API: todavía no existe una pantalla de creación. Las oportunidades son un catálogo general, no una recomendación personalizada. La prueba VA-14 usa cuentas y documentos sintéticos; no acredita operación institucional ni autoriza publicar evidencias privadas. Contratos y límites se documentan en [API y contratos](15-API-y-contratos.md) y [pruebas y aceptación](17-Pruebas-y-aceptacion.md).
