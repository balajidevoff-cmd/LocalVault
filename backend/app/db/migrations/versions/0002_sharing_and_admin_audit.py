"""Add cross-user sharing and admin audit logs

Revision ID: 0002_sharing_and_admin_audit
Revises: 0001_initial_schema
Create Date: 2026-10-20 13:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_sharing_and_admin_audit'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Update share_links table with shared_with_user_id
    with op.batch_alter_table('share_links', schema=None) as batch_op:
        batch_op.add_column(sa.Column('shared_with_user_id', sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            'fk_share_links_shared_with_user_id',
            'users',
            ['shared_with_user_id'],
            ['id'],
            ondelete='CASCADE'
        )
        batch_op.create_index(batch_op.f('ix_share_links_shared_with_user_id'), ['shared_with_user_id'], unique=False)

    # 2. Create admin_audit_logs table
    op.create_table(
        'admin_audit_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('admin_id', sa.String(length=36), nullable=True),
        sa.Column('admin_username', sa.String(length=64), nullable=False),
        sa.Column('target_user_id', sa.String(length=36), nullable=True),
        sa.Column('target_username', sa.String(length=64), nullable=True),
        sa.Column('file_id', sa.String(length=36), nullable=True),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('result', sa.String(length=20), nullable=False),
        sa.Column('details', sa.String(length=512), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_admin_audit_logs_id'), 'admin_audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_admin_audit_logs_admin_id'), 'admin_audit_logs', ['admin_id'], unique=False)
    op.create_index(op.f('ix_admin_audit_logs_target_user_id'), 'admin_audit_logs', ['target_user_id'], unique=False)
    op.create_index(op.f('ix_admin_audit_logs_file_id'), 'admin_audit_logs', ['file_id'], unique=False)

def downgrade() -> None:
    op.drop_table('admin_audit_logs')
    with op.batch_alter_table('share_links', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_share_links_shared_with_user_id'))
        batch_op.drop_constraint('fk_share_links_shared_with_user_id', type_='foreignkey')
        batch_op.drop_column('shared_with_user_id')
