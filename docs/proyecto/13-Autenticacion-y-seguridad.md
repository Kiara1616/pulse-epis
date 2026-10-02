# Autenticación y seguridad

## Proveedores y sesión

PULSE_AUTH_PROVIDER acepta google o local. local solo funciona en development/test, conserva hashes Argon2id y puede crear cuentas sintéticas con PULSE_LOCAL_AUTH_SEED. Google usa OIDC con openid email profile; no solicita Gmail. Una cuenta debe estar provisionada y habilitada; STUDENT además debe vincularse a students. Un dominio permitido no prueba por sí solo pertenencia institucional.

La API crea una sesión firmada, consulta /auth/me y permite logout. El valor por defecto de PULSE_AUTH_SESSION_MAX_AGE es 3600 segundos. En producción se requieren secretos externos y cookie Secure; SameSite=none exige Secure. La configuración rechaza local en staging/production.

## Matriz implementada de permisos

| Rol | Permisos | Restricciones |
|---|---|---|
| ADMIN | ANALYTICS_READ, AUDIT_READ, CATALOG_MANAGE, PADRON_MANAGE, PERIOD_MANAGE, USER_MANAGE | No tiene CERTIFICATION_VALIDATE por defecto |
| VALIDATOR | ANALYTICS_READ, CERTIFICATION_VALIDATE | No administra padrón ni cuentas |
| STUDENT | CERTIFICATION_READ_OWN, CERTIFICATION_WRITE_OWN | Solo expedientes propios |

La matriz proviene de backend/app/auth/rbac.py. Que un permiso exista no implica que haya pantalla y endpoint para todas sus funciones: administración general de catálogos/usuarios/auditoría aún tiene brechas. No hay perfil de analista independiente ni analítica pública para visitantes. RoleGate no reemplaza require_permissions.

## Evidencias y tratamiento de datos

El código de padrón se convierte en HMAC con PULSE_ROSTER_PSEUDONYM_SECRET. El correo operacional es restringido; no se afirma cifrado por campo en la base. Los archivos usan claves aleatorias, hash SHA-256 y rutas fuera del frontend público. El tamaño por defecto es 10 000 000 bytes; se admiten PDF, PNG y JPEG, y las URLs siguen el contrato del backend.

Los tokens temporales expiran por defecto en 600 segundos; la retención de metadatos de evidencia es 1825 días, configurable y sujeta a aprobación institucional. No hay purga automática ni S3 en la implementación actual. El backup actual no incluye evidencia ni cifrado/offsite demostrado. Estos controles deben cerrarse antes de operar con datos reales.

## Variables sensibles y verificación

| Variable | Uso |
|---|---|
| PULSE_AUTH_SESSION_SECRET | Firmar sesiones |
| PULSE_ROSTER_PSEUDONYM_SECRET | Identidad HMAC estable |
| PULSE_EVIDENCE_ACCESS_SECRET | Tokens de acceso temporal |
| PULSE_GOOGLE_CLIENT_ID / PULSE_GOOGLE_CLIENT_SECRET | OIDC institucional |
| PULSE_DATABASE_URL | Conexión de base, potencialmente con credenciales |

No copiar secretos a documentos ni registrar bodies nominales. Rotar claves requiere plan: cambiar HMAC sin migración rompe vinculación estable; invalidar secreto de sesión invalida sesiones; acceso a evidencia debe volver a emitirse. Probar autenticación y permisos con [Pruebas y aceptación](17-Pruebas-y-aceptacion.md).

## Marco institucional

El tratamiento toma como referencia la Ley 29733 y el [Reglamento D.S. 016-2024-JUS](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus). La Universidad debe definir finalidad, responsables, autorización, retención y atención de solicitudes. Controles técnicos y pruebas no equivalen a certificación de cumplimiento. Rate limiting general, cifrado de respaldos y evaluación de accesibilidad/seguridad deben verificarse expresamente.
