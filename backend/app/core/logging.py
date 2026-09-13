"""Structured-enough console logging for local and container execution."""

from __future__ import annotations

import logging
from logging.config import dictConfig


def configure_logging(level: str) -> None:
    """Configure application and Uvicorn loggers without writing secrets to disk."""

    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "stream": "ext://sys.stdout",
                }
            },
            "root": {
                "level": level,
                "handlers": ["console"],
            },
        }
    )
