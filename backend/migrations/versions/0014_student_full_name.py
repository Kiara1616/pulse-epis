"""Keep the authorized student name associated with code and email."""

import sqlalchemy as sa
from alembic import op

revision = "0014_student_full_name"
down_revision = "0013_learning_discovery"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("students") as batch:
        batch.add_column(sa.Column("full_name", sa.String(200), nullable=True))


def downgrade():
    with op.batch_alter_table("students") as batch:
        batch.drop_column("full_name")
