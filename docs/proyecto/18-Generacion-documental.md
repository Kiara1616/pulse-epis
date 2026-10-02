# Generación documental

## Fuentes y dependencias

docs/catalogo.json registra cada fuente con su grupo. El validador compara el catálogo con todos los Markdown recursivos de docs, para que la organización en subcarpetas no omita archivos. Las fuentes son académicas, técnicas, índices y recursos; las herramientas no se distribuyen como manuales.

```bash
python -m pip install -r backend/requirements-dev.txt
npm ci --prefix docs/tooling
python scripts/validate_docs.py
python scripts/build_docs.py
python scripts/validate_docs.py --artifacts
```

Mermaid CLI usa Chromium instalado por Puppeteer. Si el entorno ya dispone de Chromium, puede configurar PUPPETEER_EXECUTABLE_PATH. En CI se usa la configuración de runner efímero; en ejecución local se conserva sandbox. No se usa un servicio remoto para renderizar diagramas.

## Organización de artefactos

| Ruta en artifacts/docs | Contenido |
|---|---|
| academico | Cinco FD PDF/HTML y sus índices |
| proyecto | Todos los manuales PDF/HTML, conservando nombres únicos |
| recursos | Contratos, plantilla y registro de migración |
| diagrams | Diagramas Mermaid renderizados en SVG, PNG de alta resolución y fuentes mmd |
| openapi | OpenAPI JSON y página HTML con tabla de operaciones |
| sources | Copia de fuentes Markdown para trazabilidad |
| index.html | Navegación completa de documentos y contratos |
| manifest.json | Commit de trabajo, cambios, fuentes, hashes, páginas y figuras |

Los enlaces entre manuales apuntan a sus HTML generados; recursos se copian; referencias de código apuntan al repositorio con el commit disponible. Para los PDF, Chromium prepara los SVG como PNG de alta resolución, conservando la tipografía y alineación. HTML conserva los SVG originales. Los PDFs contienen tablas y figuras reales, no resúmenes de sustitución. Diagramas no renderizables o demasiado grandes para ser legibles hacen fallar la generación; no se oculta la pérdida de contenido.

## Solo documentación académica

```bash
python scripts/build_academic_pdfs.py
```

Este comando reutiliza el mismo motor y selecciona FD01 a FD05, sin eliminar manuales existentes. docs/tooling/render-fd01.ps1 es un acceso PowerShell al mismo comando; ya no requiere Pandoc ni TeX. La carpeta output/pdf del generador anterior queda reemplazada por artifacts/docs/academico.

## Integridad y publicación

Cada entrada del manifiesto identifica fuente, SHA-256, destinos, páginas y figuras. --artifacts verifica integridad, documentos esperados, esquemas, fuentes y destinos. Una regeneración completa actualiza su manifiesto; una ejecución solo académica conserva los registros de los otros manuales y detecta si quedaron desactualizados.

CI instala Python y Mermaid, valida enlaces recursivos y publica project-manuals. Release instala las mismas dependencias y adjunta el paquete completo. No se suben PDF ni node_modules a Git. Los comandos generan archivos locales y no publican ni despliegan por sí mismos.
