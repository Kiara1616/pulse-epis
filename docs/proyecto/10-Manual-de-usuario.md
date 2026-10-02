# Manual de usuario de Pulse EPIS

## Alcance y acceso

El portal está conectado a la API para padrón, registro, validación e indicadores. Los datos locales pueden ser sintéticos; cifras oficiales requieren fuente autorizada y cierre institucional. La sesión determina el rol, sin selector manual. Si una página no está disponible para su rol, solicite revisión de permisos al responsable.

## Iniciar y cerrar sesión

En entorno institucional, seleccione Google y use la cuenta provisionada por el administrador. Se solicita identidad básica, sin acceso a Gmail. El dominio permitido por sí solo no habilita una cuenta; STUDENT debe estar vinculado al padrón. En desarrollo aparece acceso local con las cuentas sintéticas entregadas por el equipo. Cierre sesión al terminar.

## STUDENT registrar certificación

1. Abra Mi perfil y Nueva certificación.
2. Complete nombre, emisor y fecha de emisión; agregue expiración si existe.
3. Adjunte archivo admitido o URL de evidencia conforme al formulario.
4. Envíe y compruebe que la credencial aparece como Pendiente.
5. Espere la revisión. Una observación solicita datos/evidencia adicional.

El portal actual no ofrece formulario de corrección ni captura de habilidades; esas operaciones requieren el procedimiento por API documentado y asistencia del responsable. Crear registro y adjuntar archivo son pasos separados: si el adjunto falla, consulte primero si la credencial ya existe y evite duplicarla. Nunca intente aprobar su propia credencial ni consultar otra persona.

## VALIDATOR revisar evidencia

1. Abra Validaciones y seleccione una credencial.
2. Solicite el enlace temporal de evidencia y compruebe titularidad, emisor y fechas.
3. Seleccione Tomar revisión para pasar a En revisión.
4. Apruebe, observe o rechace. Observación y rechazo exigen comentario.
5. Compruebe el resultado; el historial completo también está disponible por API.

Un enlace vencido requiere emitir uno nuevo. Una aprobación no cambia de inmediato un snapshot ya publicado: los indicadores se actualizan después del ETL para el corte correspondiente.

## ADMIN importar padrón

1. Prepare el CSV conforme a la [plantilla](../recursos/templates/padron.csv).
2. Abra Administración de estudiantes, seleccione periodo y archivo.
3. Envíe y revise totales y causas de rechazo.
4. Corrija la fuente completa y repita si es necesario; un lote inválido no aplica filas parciales.
5. Revise historial para confirmar APPLIED o REJECTED.

La pantalla obtiene periodos de snapshots publicados. Para un periodo nuevo no disponible, solicite preparación al operador del backend; no cambie el periodo del CSV para evadir la validación. Gestión general de usuarios/catálogos y ejecución ETL no cuentan con flujos web completos.

## Indicadores filtros y exportación

ADMIN y VALIDATOR consultan vistas habilitadas de indicadores. Seleccione periodo, corte, cohorte, ciclo, emisor y nivel. El dashboard muestra agregados del snapshot; no es un padrón nominal. Próximas a vencer comprende 90 días desde el corte. Brecha por habilidad indica estudiantes activos sin certificación en esa habilidad, sin afirmar demanda laboral externa.

Exportar Reporte descarga CSV con filas cargadas y metadatos configurados en esa pantalla. No hay exportación PDF operativa; los PDF FD son documentación del curso. Con cero filas, la exportación se deshabilita. Verifique corte y filtros al compartir; el CSV actual no constituye por sí mismo paquete oficial de acreditación.

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
