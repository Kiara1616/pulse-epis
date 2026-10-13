"""Run an isolated, synthetic API for the real browser acceptance flow."""
from pathlib import Path
import tempfile
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import uvicorn
from backend.app.core.config import Settings
from backend.app.db.base import Base
from backend.app.db.session import create_session_factory
from backend.app.main import create_app


def main():
    # A new directory per run prevents contamination of any developer database.
    with tempfile.TemporaryDirectory(prefix="pulse-browser-flow-") as directory:
        root = Path(directory)
        database_url = f"sqlite+pysqlite:///{(root / 'flow.db').as_posix()}"
        factory = create_session_factory(database_url)
        Base.metadata.create_all(factory.kw["bind"])
        settings = Settings(
            environment="test",
            database_url=database_url,
            auth_provider="local",
            local_auth_seed=True,
            demo_data_seed=False,
            cors_allowed_origins="http://127.0.0.1:3080",
            auth_session_secret="synthetic-browser-acceptance-only",
            evidence_storage_path=str(root / "evidence"),
            log_level="WARNING",
        )
        try:
            uvicorn.run(create_app(settings), host="127.0.0.1", port=8080, log_level="warning")
        finally:
            factory.kw["bind"].dispose()


if __name__ == "__main__":
    main()
