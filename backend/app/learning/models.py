"""Persisted learning catalogs, own preferences and workshop applications."""
import sqlalchemy as sa
from sqlalchemy.orm import mapped_column
from uuid import uuid4
from ..db.base import Base

class LearningInterest(Base):
    __tablename__ = "learning_interests"
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    name = mapped_column(sa.String(120), nullable=False, unique=True)
    active = mapped_column(sa.Boolean(), nullable=False, default=True)
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())

class LearningRoute(Base):
    __tablename__ = "learning_routes"
    __table_args__ = (sa.CheckConstraint("status IN ('DRAFT','PUBLISHED','RETIRED')", name='ck_learning_route_status'),)
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    title = mapped_column(sa.String(200), nullable=False, unique=True)
    description = mapped_column(sa.String(2000), nullable=False)
    status = mapped_column(sa.String(20), nullable=False, default="DRAFT")
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())

class LearningStep(Base):
    __tablename__ = "learning_steps"
    __table_args__ = (sa.UniqueConstraint('route_id','position', name='uq_learning_step_order'), sa.CheckConstraint('position >= 1', name='ck_learning_step_position'),)
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    route_id = mapped_column(sa.Uuid(), sa.ForeignKey("learning_routes.id", ondelete="CASCADE"), nullable=False, index=True)
    position = mapped_column(sa.Integer(), nullable=False)
    title = mapped_column(sa.String(200), nullable=False)
    skills = mapped_column(sa.JSON(), nullable=False)
    prerequisites = mapped_column(sa.JSON(), nullable=False)
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())

class StudentLearningProfile(Base):
    __tablename__ = "student_learning_profiles"
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    student_id = mapped_column(sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, unique=True)
    route_id = mapped_column(sa.Uuid(), sa.ForeignKey("learning_routes.id", ondelete="SET NULL"), nullable=True)
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())

class StudentLearningInterest(Base):
    __tablename__ = "student_learning_interests"
    __table_args__ = (sa.UniqueConstraint('student_id','interest_id', name='uq_student_learning_interest'),)
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    student_id = mapped_column(sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    interest_id = mapped_column(sa.Uuid(), sa.ForeignKey("learning_interests.id", ondelete="RESTRICT"), nullable=False)
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())

class LearningCourse(Base):
    __tablename__ = "learning_courses"
    __table_args__ = (sa.CheckConstraint("status IN ('DETECTED','IN_REVIEW','PUBLISHED','DISCARDED','RETIRED')", name='ck_learning_course_status'),)
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    title = mapped_column(sa.String(200), nullable=False)
    provider = mapped_column(sa.String(150), nullable=False)
    source_url = mapped_column(sa.String(2048), nullable=False, unique=True)
    checked_on = mapped_column(sa.Date(), nullable=False)
    requirements = mapped_column(sa.JSON(), nullable=False)
    skills = mapped_column(sa.JSON(), nullable=False)
    status = mapped_column(sa.String(20), nullable=False, default="DETECTED")
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())

class LearningOpportunity(Base):
    __tablename__ = "learning_offers"
    __table_args__ = (sa.CheckConstraint("status IN ('DRAFT','PUBLISHED','RETIRED')", name='ck_learning_offer_status'),)
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    course_id = mapped_column(sa.Uuid(), sa.ForeignKey("learning_courses.id", ondelete="RESTRICT"), nullable=False, unique=True)
    title = mapped_column(sa.String(200), nullable=False)
    cycles = mapped_column(sa.JSON(), nullable=False)
    relevance = mapped_column(sa.String(2000), nullable=False)
    status = mapped_column(sa.String(20), nullable=False, default="DRAFT")
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())

class LearningOfferInterest(Base):
    __tablename__ = "learning_offer_interests"
    __table_args__ = (sa.UniqueConstraint("offer_id", "interest_id", name="uq_learning_offer_interest"),)
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    offer_id = mapped_column(sa.Uuid(), sa.ForeignKey("learning_offers.id", ondelete="CASCADE"), nullable=False, index=True)
    interest_id = mapped_column(sa.Uuid(), sa.ForeignKey("learning_interests.id", ondelete="RESTRICT"), nullable=False)
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())

class LearningWorkshop(Base):
    __tablename__ = "learning_workshops"
    __table_args__ = (sa.CheckConstraint('capacity > 0', name='ck_learning_workshop_capacity'), sa.CheckConstraint("status IN ('DRAFT','OPEN','CLOSED','COMPLETED')", name='ck_learning_workshop_status'),)
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    offer_id = mapped_column(sa.Uuid(), sa.ForeignKey("learning_offers.id", ondelete="RESTRICT"), nullable=False, index=True)
    title = mapped_column(sa.String(200), nullable=False)
    capacity = mapped_column(sa.Integer(), nullable=False)
    requirements = mapped_column(sa.JSON(), nullable=False)
    status = mapped_column(sa.String(20), nullable=False, default="DRAFT")
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())

class LearningApplication(Base):
    __tablename__ = "learning_applications"
    __table_args__ = (sa.UniqueConstraint('student_id','workshop_id', name='uq_learning_application'), sa.CheckConstraint("status IN ('SUBMITTED','ACCEPTED','REJECTED','COMPLETED')", name='ck_learning_application_status'),)
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    student_id = mapped_column(sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    workshop_id = mapped_column(sa.Uuid(), sa.ForeignKey("learning_workshops.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = mapped_column(sa.String(20), nullable=False, default="SUBMITTED")
    comment = mapped_column(sa.String(2000), nullable=True)
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())

class LearningAudit(Base):
    __tablename__ = "learning_audit"
    __table_args__ = (sa.UniqueConstraint("entity_type", "entity_id", "sequence", name="uq_learning_audit_sequence"), sa.CheckConstraint("sequence > 0", name="ck_learning_audit_sequence"))
    sequence = mapped_column(sa.Integer(), nullable=False)
    id = mapped_column(sa.Uuid(), primary_key=True, default=uuid4)
    actor_id = mapped_column(sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    entity_type = mapped_column(sa.String(40), nullable=False)
    entity_id = mapped_column(sa.Uuid(), nullable=False, index=True)
    action = mapped_column(sa.String(40), nullable=False)
    before = mapped_column(sa.JSON(), nullable=True)
    after = mapped_column(sa.JSON(), nullable=False)
    reason = mapped_column(sa.String(2000), nullable=False)
    created_at = mapped_column(sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
