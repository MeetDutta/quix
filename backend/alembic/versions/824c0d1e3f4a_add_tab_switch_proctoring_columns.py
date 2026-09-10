"""add_tab_switch_proctoring_columns

Revision ID: 824c0d1e3f4a
Revises: 713b9c0d2e3f
Create Date: 2026-09-10 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '824c0d1e3f4a'
down_revision: Union[str, Sequence[str], None] = '713b9c0d2e3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Check exam_submissions table
    sub_cols = [c['name'] for c in inspector.get_columns('exam_submissions')]
    if 'tab_switch_count' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('tab_switch_count', sa.Integer(), server_default='0', nullable=False))
    if 'auto_submit_reason' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('auto_submit_reason', sa.String(100), nullable=True))

    # Check proctoring_logs table
    proc_cols = [c['name'] for c in inspector.get_columns('proctoring_logs')]
    if 'candidate_id' not in proc_cols:
        op.add_column('proctoring_logs', sa.Column('candidate_id', sa.String(36), nullable=True))
    if 'exam_id' not in proc_cols:
        op.add_column('proctoring_logs', sa.Column('exam_id', sa.String(36), nullable=True))
    if 'client_event_id' not in proc_cols:
        op.add_column('proctoring_logs', sa.Column('client_event_id', sa.String(64), nullable=True))
    if 'source' not in proc_cols:
        op.add_column('proctoring_logs', sa.Column('source', sa.String(50), server_default='browser_visibility', nullable=True))
    if 'client_timestamp' not in proc_cols:
        op.add_column('proctoring_logs', sa.Column('client_timestamp', sa.DateTime(timezone=True), nullable=True))

def downgrade() -> None:
    pass
