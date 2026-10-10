# Verificación del flujo académico local

Fecha: 10 de octubre de 2026. Aplicación: http://127.0.0.1:3100.

El alcance confirmado comprende padrón, certificaciones, revisión académica, publicación de indicadores y reportes. La comparación con demanda laboral externa queda fuera de esta versión por decisión del usuario.

## Periodos registrados

Las fechas corresponden al inicio de clases y al fin de semestre del [calendario oficial de la Universidad Privada de Tacna](https://portal.upt.edu.pe/site/web/contenido/quienes-somos-upt/calendarios).

| Periodo | Inicio | Fin |
|---|---|---|
| 2020-I | 2020-03-09 | 2020-08-28 |
| 2020-II | 2020-09-21 | 2021-01-15 |
| 2021-I | 2021-03-15 | 2021-07-09 |
| 2021-II | 2021-08-16 | 2021-12-10 |
| 2022-I | 2022-03-14 | 2022-07-08 |
| 2022-II | 2022-08-15 | 2022-12-09 |
| 2023-I | 2023-03-13 | 2023-07-07 |
| 2023-II | 2023-08-14 | 2023-12-15 |
| 2024-I | 2024-03-18 | 2024-07-12 |
| 2024-II | 2024-08-12 | 2024-12-13 |
| 2025-I | 2025-03-10 | 2025-07-04 |
| 2025-II | 2025-08-04 | 2025-12-05 |
| 2026-I | 2026-03-16 | 2026-07-10 |
| 2026-II | 2026-08-17 | 2026-12-18 |

Las fuentes individuales están en `backend/data/academic-periods-upt.json`. El script `scripts/register_local_periods.py` permite registrar el catálogo en una instancia local y verifica los periodos existentes sin reemplazar fechas discrepantes.

## Flujos disponibles

| Rol | Ruta | Funciones |
|---|---|---|
| Todos | Acceso y navegación | Autenticación, sesión, permisos por rol, cierre de sesión único en el pie lateral |
| Administrador | `/admin/estudiantes` | Crear periodos, previsualizar CSV, importar un periodo por carga, consultar rechazos e historial, repetir sin duplicar |
| Estudiante | `/mi-perfil` | Registrar certificación y habilidades, adjuntar archivo o enlace, consultar estado y evidencias, filtrar historial, corregir observaciones y reenviar |
| Validador | `/validaciones` | Consultar evidencia, tomar revisión, aprobar, observar o rechazar con comentario, consultar historial |
| Administrador | `/admin/publicaciones` | Publicar por periodo y corte, consultar calidad e historial, repetir sin duplicar |
| Administrador y validador | `/`, `/tecnologias` | Consultar indicadores agregados y filtros, exportar CSV y PDF |
| Administrador | `/estudiantes` | Listado del padrón con código, correo, ciclo, cohorte, plan y estado; búsqueda, periodo y paginación |
| Validador | `/estudiantes` | Indicadores agregados por cohorte y ciclo |
| Administrador | `/brechas` | Consultar cobertura interna por habilidad y exportar resultados |
| Administrador | `/admin` | Acceder a las etapas del flujo académico |

Las rutas ajenas al rol muestran acceso restringido. Las direcciones inexistentes muestran una página de recuperación. Las cuentas locales son de prueba; el inicio institucional conserva su configuración separada.

## Evidencia de ejecución

Se cargó el archivo proporcionado `padron_corregido_iniciales_2025-II.csv`: 342 filas aceptadas y ninguna rechazada. La carga repetida confirmó la ausencia de duplicados. Se publicó el corte 2025-12-05 y se descargó el PDF desde la interfaz. El padrón no crea certificaciones: los indicadores permanecen en cero hasta que existan registros aprobados para ese periodo y corte.

La prueba real del navegador verificó nueve rutas con los tres roles (27 combinaciones), sin errores de JavaScript. Sus resultados y capturas se guardan localmente en `artifacts/local-validation`, excluido de Git. La prueba integrada del backend recorre registro, evidencia, observación, corrección, aprobación, publicación y PDF sobre una base aislada, sin introducir certificaciones ficticias en el padrón del usuario.

## Demostración separada de certificaciones

Por elección del usuario, las vistas analíticas locales cargan una demostración de 2020-I a 2026-II. Su base SQLite en memoria es independiente del padrón real. Contiene registros sintéticos de AWS, Cisco, Microsoft, Oracle, Google Cloud y Scrum.org, con tres cortes por periodo y habilidades asociadas. El selector Fuente de datos permite consultar las publicaciones reales; su selección se conserva durante la navegación. La exportación Excel, CSV y PDF identifica la demostración.

Los gráficos cuentan certificaciones únicas por emisor y nombre, y estudiantes únicos para cobertura. Las habilidades no son categorías excluyentes; una certificación puede contar en más de una habilidad. Se retiró nivel de las vistas y formularios. Año de ingreso reemplaza el término cohorte en la interfaz. Las cifras de matrícula de la captura del usuario se muestran como referencia independiente y no como certificaciones. Los totales reales de matrícula de 2026 quedan sin dato.

La verificación del navegador comprueba los filtros 2020-I y 2026-II, gráficos, cambio de fuente, persistencia de la fuente, PDF marcado y vista móvil. Confirma que el padrón real continúa con 342 estudiantes y cero certificaciones aprobadas tras consultar la demostración.

## Uso institucional

Este cierre documenta el flujo académico ejecutable en local. No certifica despliegue institucional, aprobación de cifras, acreditación ni integración con una fuente de demanda laboral. La publicación oficial requiere las cuentas, fuentes y validación de la universidad.

## Presentación de reportes y gráficos

La descarga principal es un libro Excel con hojas Resumen, Distribuciones y Evolución, datos numéricos, porcentajes, fechas y gráficos editables. El PDF incluye identidad institucional, indicadores, distribuciones y cobertura por habilidad. Ambos conservan los filtros y distinguen los datos sintéticos de los registrados. El CSV auxiliar usa punto y coma para facilitar su apertura en Excel.

El dashboard incorpora barras por categoría con valores visibles, evolución con fechas legibles, una vista circular de cobertura y tablas más compactas. La cobertura cuenta estudiantes únicos; las habilidades pueden superponerse y no se suman para obtener el total de certificaciones.
