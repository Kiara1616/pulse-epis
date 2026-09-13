# Registro de certificaciones y evidencias privadas

Este documento describe la implementación de [#13 — Implementar registro de certificaciones y evidencias privadas](https://github.com/Kiara1616/pulse-epis/issues/13) y su continuación en [#14 — Implementar flujo de validación y auditoría de certificaciones](https://github.com/Kiara1616/pulse-epis/issues/14).

## Alcance implementado

- `STUDENT` solo puede crear, consultar y corregir sus propias certificaciones.
- Toda certificación nueva queda en estado `PENDING`; el cliente no puede elegir el estado.
- Se validan emisor, nombre, fechas, URLs, habilidades y duplicados en el backend.
- Las fechas cumplen `expires_on >= issued_on` cuando existe expiración.
- Las evidencias pueden ser una URL `http/https` o un archivo PDF, PNG o JPEG.
- Los archivos se guardan fuera de las rutas públicas con una clave aleatoria y hash SHA-256.
- El acceso a una evidencia se entrega mediante un enlace firmado con expiración corta; no se expone `object_key`.
- Una certificación `OBSERVED` puede corregirse y pasa a `RESUBMITTED`; las decisiones anteriores permanecen en `validations` y todos los cambios quedan en `certification_status_history`.
- Las acciones de registro, corrección y adjunto generan entradas en `audit_logs` sin contenido binario ni credenciales.

## API

| Método y ruta | Uso | Autorización |
|---|---|---|
| `POST /api/v1/certifications` | Registrar una certificación propia | `STUDENT` + `CERTIFICATION_WRITE_OWN` |
| `GET /api/v1/certifications` | Listar las certificaciones propias | `STUDENT` + `CERTIFICATION_READ_OWN` |
| `GET /api/v1/certifications/{id}` | Consultar una certificación propia | `STUDENT` + `CERTIFICATION_READ_OWN` |
| `PATCH /api/v1/certifications/{id}` | Corregir un registro `PENDING`, `OBSERVED` o `RESUBMITTED` | `STUDENT` + `CERTIFICATION_WRITE_OWN` |
| `POST /api/v1/certifications/{id}/evidence` | Adjuntar una URL o archivo | `STUDENT` + `CERTIFICATION_WRITE_OWN` |
| `POST /api/v1/certifications/{id}/evidence/{evidence_id}/access` | Emitir enlace temporal | `STUDENT` propietario |
| `GET /api/v1/certifications/evidence/{evidence_id}/download?token=...` | Descargar o redirigir con token válido | Token firmado temporal |

El endpoint de evidencia recibe `multipart/form-data`: se debe enviar exactamente una URL o un archivo. Los errores de duplicidad responden `409 DUPLICATE_RECORD`; los archivos no admitidos responden `422 EVIDENCE_UNSUPPORTED`.

## Privacidad y retención

El directorio configurado en `PULSE_EVIDENCE_STORAGE_PATH` es privado y no debe publicarse como contenido estático. El MVP usa almacenamiento local detrás de una interfaz reemplazable por S3 compatible cuando se implemente la infraestructura de la issue #19.

La retención por defecto es de **1.825 días (5 años)**, registrada en `evidences.retention_until`. El valor se configura con `PULSE_EVIDENCE_RETENTION_DAYS`. La eliminación física y del registro debe ejecutarse mediante un job institucional con backup y aprobación; ese job pertenece al trabajo operativo de las issues #19 y #21. Hasta entonces, una evidencia vencida no debe entregarse en nuevas URLs temporales.

Los secretos `PULSE_EVIDENCE_ACCESS_SECRET` y `PULSE_AUTH_SESSION_SECRET` deben ser aleatorios y gestionarse fuera del repositorio. El CSV, los archivos reales, URLs privadas y credenciales no deben subirse a Git.
