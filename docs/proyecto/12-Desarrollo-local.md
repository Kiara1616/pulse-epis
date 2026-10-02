# Desarrollo local

## Requisitos y primer arranque

Se requieren Git, Node.js 20+, npm, Python 3.12+ y Docker con Compose v2. Las dependencias frontend y herramientas tienen lock; el backend usa requirements. Ejecutar desde la raíz del repositorio.

```powershell
Copy-Item .env.compose.example .env
```

Antes de iniciar, reemplazar los valores de ejemplo de contraseña PostgreSQL y secretos de sesión, seudonimización y acceso a evidencia. No publicar el archivo .env. La plantilla activa local auth y semilla únicamente en development.

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

El portal responde en http://localhost:3000, FastAPI en http://localhost:8000, Swagger en /docs y readiness en /ready. PostgreSQL no expone puerto al host. El backend aplica Alembic al arrancar; base y evidencias persisten en postgres-data y evidence-data.

## Sesión local y datos de prueba

Las cuentas son admin@local.pulse-epis.test, validator@local.pulse-epis.test y student@local.pulse-epis.test. La contraseña es la configurada en PULSE_LOCAL_AUTH_PASSWORD. No son usuarios institucionales ni sus registros prueban cobertura EPIS. Sembrar cuentas no garantiza que exista un snapshot analítico: preparar datos y ejecutar ETL antes de consultar indicadores.

## Ejecutar frontend y API por separado

```bash
python -m venv backend/.venv
```

Activar backend/.venv/Scripts/Activate.ps1 en Windows o source backend/.venv/bin/activate en Linux/macOS. Después:

```bash
python -m pip install -r backend/requirements-dev.txt
```

Configurar PULSE_DATABASE_URL con una base de desarrollo autorizada, PULSE_ENVIRONMENT=development y el proveedor deseado. SQLite se usa en pruebas, pero el entorno integrado se valida sobre PostgreSQL.

```bash
alembic -c backend/alembic.ini upgrade head
uvicorn backend.app.main:app --reload --port 8000
```

En otra terminal:

```bash
npm ci --prefix dashboard-app
npm run dev --prefix dashboard-app
```

NEXT_PUBLIC_API_URL debe apuntar al prefijo público de API; el valor se incorpora al build de Next.js y requiere reconstruir si cambia. PULSE_CORS_ALLOWED_ORIGINS debe listar el origen del portal, sin comodín cuando hay cookies.

## Parada y diagnóstico

```bash
docker compose logs --tail 100 backend frontend
docker compose down
```

down conserva volúmenes. down -v elimina base y evidencias de desarrollo; no se usa como procedimiento de recuperación. Si /ready falla, revisar conexión a base, migraciones y configuración. Si el navegador falla pero API responde, revisar origen CORS, URL incorporada al build y cookie. Los errores se correlacionan con request_id sin copiar PII a issues.

## Migraciones y mantenimiento

Consultar [Modelo de datos](05-Modelo-de-datos.md) antes de cambiar esquema. Aplicar upgrade head con respaldo y pruebas; downgrade se ensaya en base descartable, y no se ejecuta contra datos reales para corregir un problema de aplicación. Las pruebas de migraciones crean y revierten su propio esquema de prueba.
