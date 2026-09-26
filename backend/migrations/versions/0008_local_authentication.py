"""Add optional password hashes for development-only local authentication.

The column remains nullable because institutional OIDC users do not need a
local password. Production configurations continue to require the OIDC
provider and never use this field for sign-in.
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_local_authentication"
down_revision = "0007_fact_student_cycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_hash")
