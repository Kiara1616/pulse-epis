from pathlib import Path
import os
from uuid import uuid4
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from backend.app.learning.models import LearningInterest,LearningRoute,LearningStep,LearningCourse,LearningOpportunity,LearningWorkshop,LearningOfferInterest

ROOT=Path(__file__).resolve().parents[2]
def test_learning_migration_constraints_and_rollback(tmp_path):
    url=os.getenv("PULSE_DATABASE_URL") or os.getenv("DATABASE_URL") or f"sqlite:///{(tmp_path/'learning.db').as_posix()}"
    config=Config(str(ROOT/'backend/alembic.ini'));config.set_main_option('sqlalchemy.url',url)
    command.upgrade(config,'head');engine=create_engine(url)
    assert {'learning_interests','learning_routes','learning_steps','student_learning_profiles','student_learning_interests','learning_courses','learning_offers','learning_offer_interests','learning_workshops','learning_applications','learning_audit'} <= set(inspect(engine).get_table_names())
    with Session(engine) as s:
        interest=LearningInterest(name='Interés sintético');route=LearningRoute(title='Ruta sintética',description='Solo prueba');s.add_all([interest,route]);s.commit()
        s.add(LearningStep(route_id=route.id,position=1,title='Paso',skills=['Python'],prerequisites=[]));s.commit()
        s.add(LearningStep(route_id=route.id,position=1,title='Duplicado',skills=[],prerequisites=[]))
        with pytest.raises(IntegrityError):s.commit()
        s.rollback()
        s.add(LearningCourse(title='Demo',provider='Demo',source_url='https://example.invalid/demo',checked_on=__import__('datetime').date(2026,1,1),requirements=[],skills=[],status='WRONG'))
        with pytest.raises(IntegrityError):s.commit()
        s.rollback()
    command.downgrade(config,'0009_roster_student_code')
    tables=set(inspect(engine).get_table_names());assert 'certifications' in tables;assert 'learning_courses' not in tables
    command.upgrade(config,'head');assert 'learning_courses' in inspect(engine).get_table_names()
