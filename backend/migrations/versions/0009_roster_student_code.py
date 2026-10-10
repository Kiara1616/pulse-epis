"""Keep authorized student codes for the administrator roster directory."""
from alembic import op
import sqlalchemy as sa

revision = "0009_roster_student_code"
down_revision = "0008_local_authentication"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("students", sa.Column("student_code", sa.String(64), nullable=True))

def downgrade():
    op.drop_column("students", "student_code")
