"""Widen college course names for source cutoff records."""
import sqlalchemy as sa
from alembic import op


revision = "0004_college_course_length"
down_revision = "0003_account_security"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("college_cutoffs") as batch:
        batch.alter_column(
            "course",
            existing_type=sa.String(length=180),
            type_=sa.String(length=240),
            existing_nullable=False,
        )


def downgrade():
    bind = op.get_bind()
    long_course = bind.execute(
        sa.text("SELECT 1 FROM college_cutoffs WHERE length(course) > 180 LIMIT 1")
    ).first()
    if long_course:
        raise RuntimeError("Cannot shrink college course names while values longer than 180 characters exist.")
    with op.batch_alter_table("college_cutoffs") as batch:
        batch.alter_column(
            "course",
            existing_type=sa.String(length=240),
            type_=sa.String(length=180),
            existing_nullable=False,
        )
