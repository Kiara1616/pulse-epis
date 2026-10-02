# Registro de validación documental

Este registro identifica la verificación del cambio de organización y completitud documental. La base técnica es main cf7ab75 y el PR documental 51 a618c3e. Los resultados siguientes corresponden al entorno local Windows del 02/10/2026; no se atribuyen pruebas institucionales a una verificación local.

## Alcance

Organización de 17 archivos existentes, conservación de hashes originales e historial Git, cinco FD, manuales técnicos, contratos, enlaces, generación, diagramas, OpenAPI y manifiesto. Las suites del producto sirven para contrastar afirmaciones, sin cambiar su comportamiento.

## Resultados de ejecución

La tabla final registra comando, entorno, resultado y limitación. La aceptación real del piloto requiere evidencia y acta independientes conforme a Pruebas y aceptación.

| Verificación | Resultado observado | Límite |
|---|---|---|
| `python scripts/validate_docs.py` | 32 fuentes registradas; enlaces recursivos, 17 migraciones, RF/RNF/CU, finanzas y contrato comprobados | Coherencia documental; no acta académica |
| `python scripts/build_docs.py` | 32 PDF y 32 HTML; 23 diagramas únicos, recursos, fuentes, OpenAPI y manifiesto | Python local y Chromium; no despliegue |
| `python scripts/validate_docs.py --artifacts` | Cobertura del catálogo, hashes, páginas no vacías y enlaces HTML válidos | No reemplaza evaluación institucional |
| `python -m pytest backend/tests -q` | 42 pruebas aprobadas, 5,05 s | Entorno local de pruebas; no ensayo PostgreSQL productivo ni carga |
| Prueba negativa de catálogo | Una fuente Markdown anidada sin registrar fue rechazada | Archivo temporal retirado después de verificar |
| Prueba negativa de enlace | Un enlace a archivo inexistente fue rechazado | Fuente original restaurada después de verificar |
| Revisión visual | Todos los PDF renderizados con Poppler; revisión de 154 páginas y detalle de diagramas | Se corrigieron etiquetas superpuestas y tablas extensas; el registro final puede aumentar la paginación |

## Entorno y resultados pendientes

Python y Node del runtime local; dependencias de desarrollo instaladas en entorno aislado. Los diagramas se preparan localmente con Mermaid y Chromium; los PDF conservan las figuras como PNG de alta resolución y los HTML usan SVG. CI y release incluyen la construcción y validación completa; sus ejecuciones remotas requieren el PR.

Localmente no se ejecutó la suite del frontend ni despliegue, restauración, auditoría legal, carga o evaluación con usuarios institucionales en este cambio documental. La aceptación piloto, población oficial, misión/visión institucional certificada, presupuesto aprobado, autorización de tratamiento y acta siguen identificados como evidencia externa pendiente.


## CI del PR 52

En la [ejecución 36970865333](https://github.com/Kiara1616/pulse-epis/actions/runs/36970865333), correspondiente al commit c822735, pasaron docs, backend con PostgreSQL y containers. Frontend pasó lint, tipos, build y tres E2E; falló `npm audit --audit-level=high` por dependencias ya presentes: Next.js 16.3.3 y brace-expansion. El reporte identifica severidad crítica y alta, respectivamente. Este cambio documental no actualiza esas dependencias; requieren corrección y nueva validación antes de considerar CI completamente aprobado. Los resultados remotos se distinguen de las pruebas locales de la tabla.
