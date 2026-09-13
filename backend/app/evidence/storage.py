"""Private object storage boundary used by the certification service."""

from __future__ import annotations

import os
import secrets
from pathlib import Path


class EvidenceStorageError(RuntimeError):
    """Raised when private evidence cannot be stored or read."""


class LocalEvidenceStorage:
    """Filesystem-backed private storage for the MVP.

    The directory is never exposed as a static web path. The service only
    returns a file after validating a short-lived, signed access token. The
    same boundary can be replaced by an S3-compatible adapter later.
    """

    def __init__(self, root: str | Path) -> None:
        self._root = Path(root).expanduser().resolve()

    def _path(self, object_key: str) -> Path:
        if not object_key or Path(object_key).name != object_key:
            raise EvidenceStorageError("Invalid private object key")
        path = (self._root / object_key).resolve()
        if path.parent != self._root:
            raise EvidenceStorageError("Invalid private object key")
        return path

    def save(self, object_key: str, content: bytes) -> None:
        """Write an object atomically below the private storage root."""

        path = self._path(object_key)
        self._root.mkdir(parents=True, exist_ok=True)
        temporary = self._root / f".{object_key}.{secrets.token_hex(8)}.tmp"
        try:
            temporary.write_bytes(content)
            os.replace(temporary, path)
        except OSError as exc:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
            raise EvidenceStorageError("Private evidence could not be stored") from exc

    def path_for(self, object_key: str) -> Path:
        """Return an existing private path for a generated object key."""

        path = self._path(object_key)
        if not path.is_file():
            raise EvidenceStorageError("Private evidence object is unavailable")
        return path

    def delete(self, object_key: str) -> None:
        """Remove an object after a failed transaction or retention purge."""

        path = self._path(object_key)
        try:
            path.unlink(missing_ok=True)
        except OSError as exc:
            raise EvidenceStorageError("Private evidence object could not be removed") from exc


__all__ = ["EvidenceStorageError", "LocalEvidenceStorage"]
