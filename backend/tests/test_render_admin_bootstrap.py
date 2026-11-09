from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
import pytest

from backend.app.db.base import Base
from backend.app.db.models import User
from deploy.render.bootstrap_admin import bootstrap_admin, bootstrap_staff


def test_bootstrap_creates_only_allowlisted_admin_and_is_idempotent():
    engine = create_engine("sqlite+pysqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        assert bootstrap_admin(session, "KIARAMURILLO193@gmail.com", ("kiaramurillo193@gmail.com",))
        assert not bootstrap_admin(session, "kiaramurillo193@gmail.com", ("kiaramurillo193@gmail.com",))
        user = session.scalar(select(User))
        assert user.email == "kiaramurillo193@gmail.com"
        assert user.role == "ADMIN"
    engine.dispose()


def test_bootstrap_rejects_unlisted_email():
    engine = create_engine("sqlite+pysqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        with pytest.raises(ValueError, match="allowlisted"):
            bootstrap_admin(session, "other@gmail.com", ("kiaramurillo193@gmail.com",))
        assert session.scalar(select(User)) is None
    engine.dispose()


def test_bootstrap_creates_an_allowlisted_validator_without_changing_the_admin():
    engine = create_engine("sqlite+pysqlite://")
    Base.metadata.create_all(engine)
    allowed = ("kiaramurillo193@gmail.com", "kiara.murillo.student@gmail.com")
    with Session(engine) as session:
        assert bootstrap_admin(session, allowed[0], allowed)
        assert bootstrap_staff(session, allowed[1], "VALIDATOR", allowed)
        users = session.scalars(select(User).order_by(User.email)).all()
        assert [(user.email, user.role) for user in users] == [
            ("kiara.murillo.student@gmail.com", "VALIDATOR"),
            ("kiaramurillo193@gmail.com", "ADMIN"),
        ]
    engine.dispose()
