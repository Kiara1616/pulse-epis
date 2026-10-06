FROM node:20-bookworm-slim AS frontend
WORKDIR /frontend
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL=/api/v1
COPY dashboard-app/package*.json ./
RUN npm ci
COPY dashboard-app/ ./
RUN npm run build

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends nginx ca-certificates && rm -rf /var/lib/apt/lists/* && useradd --uid 1000 --create-home pulse
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend /frontend/.next/standalone/ frontend/
COPY --from=frontend /frontend/.next/static/ frontend/.next/static/
COPY --from=frontend /frontend/public/ frontend/public/
COPY deploy/render/ deploy/render/
RUN chown -R pulse:pulse /app
EXPOSE 10000
CMD ["python", "deploy/render/start.py"]
