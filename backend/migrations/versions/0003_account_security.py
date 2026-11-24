"""Add email verification and OAuth account fields.

Revision ID: 0003_account_security
Revises: 0002_rate_limit_buckets
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision = "0003_account_security"
down_revision = "0002_rate_limit_buckets"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in inspect(bind).get_columns("users")}
    if "email_verified" not in columns:
        op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "oauth_provider" not in columns:
        op.add_column("users", sa.Column("oauth_provider", sa.String(length=32), nullable=True))
    if "oauth_subject" not in columns:
        op.add_column("users", sa.Column("oauth_subject", sa.String(length=255), nullable=True))


def downgrade():
    with op.batch_alter_table("users") as batch:
        batch.drop_column("oauth_subject")
        batch.drop_column("oauth_provider")
        batch.drop_column("email_verified")
