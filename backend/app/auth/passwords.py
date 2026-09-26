"""Password hashing helpers for the development-only local provider."""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError


_PASSWORD_HASHER = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a password with Argon2id using the library's safe defaults."""

    if not password:
        raise ValueError("password cannot be empty")
    return _PASSWORD_HASHER.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Return whether a plaintext password matches a stored Argon2id hash."""

    if not password or not password_hash:
        return False
    try:
        return _PASSWORD_HASHER.verify(password_hash, password)
    except VerificationError:
        return False
