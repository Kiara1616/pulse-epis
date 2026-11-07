"""Historical local preview revision, retained so old databases can upgrade.

The old preview created learning_opportunities outside the current migration
tree. Fresh installations do not need that table; the merge migration imports
it when it is present.
"""

revision = "0010_learning_opportunities"
down_revision = "0009_roster_student_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
