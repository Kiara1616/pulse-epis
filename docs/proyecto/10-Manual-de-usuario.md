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
