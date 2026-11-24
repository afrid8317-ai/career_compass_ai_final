"""Add persistent rate-limit buckets.

Revision ID: 0002_rate_limit_buckets
Revises: 0001_initial_schema
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "0002_rate_limit_buckets"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "rate_limit_buckets" not in inspector.get_table_names():
        op.create_table(
            "rate_limit_buckets",
            sa.Column("key_hash", sa.String(length=64), primary_key=True),
            sa.Column("scope", sa.String(length=40), nullable=False),
            sa.Column("bucket_start", sa.Integer(), nullable=False),
            sa.Column("request_count", sa.Integer(), nullable=False),
            sa.Column("expires_at", sa.Integer(), nullable=False),
        )
    existing_indexes = {index["name"] for index in inspect(bind).get_indexes("rate_limit_buckets")}
    if "ix_rate_limit_buckets_scope" not in existing_indexes:
        op.create_index("ix_rate_limit_buckets_scope", "rate_limit_buckets", ["scope"])
    if "ix_rate_limit_buckets_expires_at" not in existing_indexes:
        op.create_index("ix_rate_limit_buckets_expires_at", "rate_limit_buckets", ["expires_at"])


def downgrade():
    bind = op.get_bind()
    if "rate_limit_buckets" in inspect(bind).get_table_names():
        op.drop_table("rate_limit_buckets")
