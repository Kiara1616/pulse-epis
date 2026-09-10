# EPIS Certifications Dashboard

**EPIS Certifications Dashboard** es una herramienta de Inteligencia de Negocios (BI) diseñada para el Comité de Calidad y la Dirección de la Escuela Profesional de Ingeniería de Sistemas (EPIS). Su propósito es medir y visualizar la **adquisición de certificaciones tecnológicas de la industria** por parte de los estudiantes (AWS, Cisco, Microsoft, Huawei, etc.).

Este dashboard es fundamental para sustentar informes de acreditación internacional (ej. ICACIT, ABET) y nacional (SUNEDU), demostrando con métricas cuantitativas que los egresados cumplen con estándares globales.

## 🎯 Orientación Estratégica

El sistema está diseñado para:

1. **Acreditaciones y Calidad:** Probar mediante métricas que los estudiantes tienen competencias validadas por la industria global.
2. **Identificación de Talento:** Ubicar a los alumnos con mayor número de certificaciones para recomendarlos en oportunidades de prácticas y empleo.
3. **Cierre de Brechas Laborales:** Comparar las certificaciones obtenidas frente a lo que las empresas regionales y nacionales están demandando (ej. Faltan certificados en Ciberseguridad).

## 📊 Parámetros Evaluados (KPIs)

El dashboard divide el análisis en secciones especializadas con los siguientes parámetros:

### 1. Overview (Dashboard Principal)
- **Total Certificaciones Activas:** Volumen total de credenciales vigentes.
- **% Alumnos Certificados:** Proporción de la población estudiantil que cuenta con al menos una certificación.
- **Evolución Temporal:** Crecimiento histórico de certificaciones semestre a semestre.

### 2. Módulo de Proveedores IT
- **Participación por Vendor (Market Share):** Dominio de tecnologías en la escuela (AWS vs Cisco vs Microsoft).
- **Niveles de Certificación:** Distribución de dificultad (Fundamentals, Associate, Professional).

### 3. Módulo de Alumnado
- **Top 5 Estudiantes:** Ranking de alumnos destacados como talento universitario.
- **Distribución por Semestre:** Identificación de en qué ciclo los alumnos deciden certificarse más.

### 4. Módulo de Brechas de Habilidades
- **Alumnos vs Mercado (Radar):** Comparativa que muestra si la escuela está sobre-certificando en áreas con baja demanda y sub-certificando en áreas críticas (Ciberseguridad, Data).

## 🔌 Estrategia de Obtención de Datos (Semanas 4-6)

Este proyecto está diseñado para extraer datos automatizados desde múltiples fuentes:
1. **API de Credly:** Scraping automatizado/API para extraer *Digital Badges* públicos emitidos por AWS, IBM y Cisco.
2. **Google Sheets API:** Consumo de una base de datos centralizada de secretaría académica alimentada por Formularios de Google donde los estudiantes reportan certificaciones externas (Udemy, Coursera, Huawei).
3. **Plataformas de Convenio:** Exportación de reportes desde academias universitarias (Cisco NetAcad, AWS Academy).

## 🚀 Tecnologías Utilizadas

- **Framework:** Next.js (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS (con soporte Dark/Light Mode mediante `next-themes`)
- **Gráficos:** Recharts
- **Iconos:** Lucide React

## 📦 Cómo ejecutar el proyecto

Para correr el proyecto en entorno de desarrollo local:

```bash
# 1. Instalar dependencias
npm install

# 2. Correr el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver el dashboard. El sistema utiliza datos simulados alojados en `src/shared/api/mock-data.json`.
