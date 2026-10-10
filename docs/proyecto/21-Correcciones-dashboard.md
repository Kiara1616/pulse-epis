# Cambios realizados en Pulse EPIS

## Elementos retirados o simplificados
- Buscador global de la cabecera sin una función útil.
- Botón de cierre de sesión duplicado: queda una sola acción en el lateral.
- Filtro de nivel en vistas analíticas y formularios de estudiante; se mantiene compatibilidad interna con datos anteriores.
- Término cohorte en la interfaz, reemplazado por Año de ingreso.
- Colores diferentes en los iconos del resumen y avatar: ahora usan gris uniforme.
- Subtítulo institucional repetido y párrafo extenso del resumen.

## Funciones agregadas
- Catálogo de periodos académicos 2020-I a 2026-II y script de registro local.
- Demostración de certificaciones con datos sintéticos en una base independiente.
- Selector entre demostración y datos registrados, conservado durante la navegación.
- Vista previa del CSV con conteos por periodo, registro de periodos e importación del periodo seleccionado.
- Directorio administrativo con códigos y correos, búsqueda y paginación; migración para códigos estudiantiles.
- Publicación de indicadores, historial y resultados del proceso ETL.
- Corrección y reenvío de certificaciones observadas, detalle de evidencias e historial de validación.
- Reportes Excel con tres hojas y gráficos editables, PDF institucional y CSV auxiliar.
- Vista de cobertura, detalle de certificaciones y referencia independiente de matrícula histórica.
- Páginas de error y recuperación, pruebas de exportación, demostración y flujo académico completo.
- Capturas de ingreso institucional en escritorio y móvil.

## Cambios de comportamiento y presentación
- Proxy local de la API para resolver el acceso desde el frontend.
- Navegación y rutas según rol; acceso nominal al padrón reservado al administrador.
- Importaciones repetidas sin duplicados y conservación del historial por periodo.
- Validación de evidencias antes de aprobar certificaciones.
- Gráficos más compactos con etiquetas de valores, colores por categoría y fechas legibles.
- Conteos únicos de certificaciones y estudiantes para evitar sumar habilidades como si fueran categorías excluyentes.
- Aviso breve de demostración y marca de fuente en los reportes.
- Actualización del manual y documentación del cierre funcional local.

## Alcance y pendientes
Los datos reales del padrón, bases locales, credenciales, archivos .env y reportes generados permanecen fuera del repositorio. Se incluyen únicamente las dos capturas de ingreso.

Las recomendaciones del análisis posterior no se presentan como implementadas: reconstrucción temporal del estado de certificaciones, validación adicional de fechas, catálogo administrado, cobertura de habilidades con cero registros, orden académico de filtros y estadísticas personales ampliadas siguen pendientes.
