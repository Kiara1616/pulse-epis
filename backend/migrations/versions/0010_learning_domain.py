"""Add learning catalogs and participation records without changing credentials."""
from alembic import op
import sqlalchemy as sa
revision="0010_learning_domain"
down_revision="0009_roster_student_code"
branch_labels=None
depends_on=None

def upgrade():
    op.create_table("learning_interests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table("learning_routes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False, unique=True),
        sa.Column("description", sa.String(2000), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('DRAFT','PUBLISHED','RETIRED')", name='ck_learning_route_status'),
    )
    op.create_table("learning_steps",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("route_id", sa.Uuid(), sa.ForeignKey("learning_routes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("prerequisites", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('route_id','position', name='uq_learning_step_order'),
        sa.CheckConstraint('position >= 1', name='ck_learning_step_position'),
    )
    op.create_index("ix_learning_steps_route_id", "learning_steps", ["route_id"])
    op.create_table("student_learning_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("route_id", sa.Uuid(), sa.ForeignKey("learning_routes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table("student_learning_interests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("interest_id", sa.Uuid(), sa.ForeignKey("learning_interests.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('student_id','interest_id', name='uq_student_learning_interest'),
    )
    op.create_index("ix_student_learning_interests_student_id", "student_learning_interests", ["student_id"])
    op.create_table("learning_courses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("provider", sa.String(150), nullable=False),
        sa.Column("source_url", sa.String(2048), nullable=False, unique=True),
        sa.Column("checked_on", sa.Date(), nullable=False),
        sa.Column("requirements", sa.JSON(), nullable=False),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('DETECTED','IN_REVIEW','PUBLISHED','DISCARDED','RETIRED')", name='ck_learning_course_status'),
    )
    op.create_table("learning_offers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("course_id", sa.Uuid(), sa.ForeignKey("learning_courses.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("cycles", sa.JSON(), nullable=False),
        sa.Column("relevance", sa.String(2000), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('DRAFT','PUBLISHED','RETIRED')", name='ck_learning_offer_status'),
    )
    op.create_table("learning_offer_interests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("offer_id", sa.Uuid(), sa.ForeignKey("learning_offers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("interest_id", sa.Uuid(), sa.ForeignKey("learning_interests.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("offer_id", "interest_id", name="uq_learning_offer_interest"))
    op.create_index("ix_learning_offer_interests_offer_id", "learning_offer_interests", ["offer_id"])
    op.create_table("learning_workshops",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("offer_id", sa.Uuid(), sa.ForeignKey("learning_offers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("requirements", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('capacity > 0', name='ck_learning_workshop_capacity'),
        sa.CheckConstraint("status IN ('DRAFT','OPEN','CLOSED','COMPLETED')", name='ck_learning_workshop_status'),
    )
    op.create_index("ix_learning_workshops_offer_id", "learning_workshops", ["offer_id"])
    op.create_table("learning_applications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workshop_id", sa.Uuid(), sa.ForeignKey("learning_workshops.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("comment", sa.String(2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('student_id','workshop_id', name='uq_learning_application'),
        sa.CheckConstraint("status IN ('SUBMITTED','ACCEPTED','REJECTED','COMPLETED')", name='ck_learning_application_status'),
    )
    op.create_index("ix_learning_applications_student_id", "learning_applications", ["student_id"])
    op.create_index("ix_learning_applications_workshop_id", "learning_applications", ["workshop_id"])
    op.create_table("learning_audit",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=False),
        sa.Column("reason", sa.String(2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_learning_audit_entity_id", "learning_audit", ["entity_id"])

def downgrade():
    op.drop_table("learning_audit")
    op.drop_table("learning_applications")
    op.drop_table("learning_workshops")
    op.drop_table("learning_offer_interests")
    op.drop_table("learning_offers")
    op.drop_table("learning_courses")
    op.drop_table("student_learning_interests")
    op.drop_table("student_learning_profiles")
    op.drop_table("learning_steps")
    op.drop_table("learning_routes")
    op.drop_table("learning_interests")
