"""Role-to-permission policy for backend authorization."""

from __future__ import annotations

from .models import Permission, Role


ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.ADMIN: frozenset(
        {
            Permission.ANALYTICS_READ,
            Permission.AUDIT_READ,
            Permission.CATALOG_MANAGE,
            Permission.PADRON_MANAGE,
            Permission.PERIOD_MANAGE,
            Permission.USER_MANAGE,
        }
    ),
    Role.VALIDATOR: frozenset(
        {
            Permission.ANALYTICS_READ,
            Permission.CERTIFICATION_VALIDATE,
        }
    ),
    Role.STUDENT: frozenset(
        {
            Permission.CERTIFICATION_READ_OWN,
            Permission.CERTIFICATION_WRITE_OWN,
        }
    ),
}


def permissions_for(role: Role) -> frozenset[Permission]:
    """Return the immutable permission set assigned to a role."""

    return ROLE_PERMISSIONS[role]


def has_permission(role: Role, permission: Permission) -> bool:
    """Check a permission without trusting any client-provided role."""

    return permission in permissions_for(role)
