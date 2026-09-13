"""SQLAlchemy engine and session helpers."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker


def create_engine_from_url(database_url: str, *, echo: bool = False) -> Engine:
    """Create an engine for PostgreSQL or a local SQLite test database."""

    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(
        database_url,
        echo=echo,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


def create_session_factory(database_url: str, *, echo: bool = False) -> sessionmaker[Session]:
    """Create a typed session factory for a configured database URL."""

    return sessionmaker(
        bind=create_engine_from_url(database_url, echo=echo),
        autoflush=False,
        expire_on_commit=False,
    )
