"""Run approved course discovery from a trusted local scheduler.

Usage: python -m backend.scan_learning_sources
"""

from datetime import datetime, timezone

from sqlalchemy import select

from .app.core.config import get_settings
from .app.db.session import create_session_factory
from .app.learning.discovery import scan
from .app.learning.models import LearningDiscoverySource


def main() -> None:
    settings = get_settings()
    if not settings.database_url:
        raise SystemExit("PULSE_DATABASE_URL is required")
    factory = create_session_factory(settings.database_url)
    with factory() as session:
        ids = list(session.scalars(select(LearningDiscoverySource.id).where(LearningDiscoverySource.active.is_(True))))
    for identifier in ids:
        with factory() as session:
            with session.begin():
                source = session.get(LearningDiscoverySource, identifier)
                try:
                    result = scan(session, source)
                    print(f"{source.name}: {result['detected']} new, {result['updated']} updated")
                except Exception as exc:
                    source.last_error = str(exc)[:300]
                    source.last_checked_at = datetime.now(timezone.utc)
                    print(f"{source.name}: scan failed: {source.last_error}")


if __name__ == "__main__":
    main()
