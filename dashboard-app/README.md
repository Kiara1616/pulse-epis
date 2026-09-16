# EPIS Certifications Dashboard

**EPIS Certifications Dashboard** es una herramienta de Inteligencia de Negocios (BI) diseñada para el Comité de Calidad y la Dirección de la Escuela Profesional de Ingeniería de Sistemas (EPIS). Su propósito es consultar indicadores agregados de certificaciones tecnológicas validadas mediante la API institucional.

Este dashboard es fundamental para sustentar informes de acreditación internacional (ej. ICACIT, ABET) y nacional (SUNEDU), demostrando con métricas cuantitativas que los egresados cumplen con estándares globales.

## 🎯 Orientación Estratégica

El sistema está diseñado para:

1. **Acreditaciones y Calidad:** Probar mediante métricas que los estudiantes tienen competencias validadas por la industria global.
2. **Seguimiento académico:** Observar cobertura, evolución y distribución por proveedor, nivel, cohorte y ciclo sin exponer datos nominales.
3. **Cierre de brechas:** Identificar habilidades con menor cobertura dentro de la población activa del snapshot publicado.

## 📊 Parámetros Evaluados (KPIs)

El dashboard divide el análisis en secciones especializadas con los siguientes parámetros:

### 1. Overview (Dashboard Principal)
- **Total Certificaciones Activas:** Volumen total de credenciales vigentes.
- **% Alumnos Certificados:** Proporción de la población estudiantil que cuenta con al menos una certificación.
- **Evolución Temporal:** Crecimiento histórico de certificaciones semestre a semestre.

### 2. Módulo de Proveedores IT
- **Distribución por proveedor:** Cantidad de certificaciones aprobadas por entidad emisora.
- **Niveles de Certificación:** Distribución de dificultad (Fundamentals, Associate, Professional).

### 3. Módulo de Alumnado
- **Cifras agregadas:** Distribución de certificaciones por cohorte y ciclo, sin rankings nominales.

### 4. Módulo de Brechas de Habilidades
- **Cobertura por habilidad:** Diferencia estimada entre estudiantes activos y estudiantes certificados en cada habilidad.

## 🔌 Estrategia de Obtención de Datos (Semanas 4-6)

El dashboard no realiza scraping de redes profesionales ni inventa fuentes externas. La API expone certificaciones declaradas por estudiantes, evidencias privadas y snapshots ETL construidos desde fuentes institucionales autorizadas.

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

Abre [http://localhost:3000](http://localhost:3000) en tu navegador. El frontend consulta la API en `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:8000/api/v1`) y solicita una sesión institucional mediante Google OIDC.

### Comprobaciones

```bash
npm run lint
npm run build
npm run test:e2e
```

Los recorridos E2E levantan Next.js y simulan únicamente las respuestas de la API para comprobar la navegación de `ADMIN`, `VALIDATOR` y `STUDENT`. En una máquina nueva, instala el navegador una vez con `npx playwright install chromium`.
