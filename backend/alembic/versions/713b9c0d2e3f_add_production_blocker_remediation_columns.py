"""add_production_blocker_remediation_columns

Revision ID: 713b9c0d2e3f
Revises: 602a8b9c1d2e
Create Date: 2026-09-10 10:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '713b9c0d2e3f'
down_revision: Union[str, Sequence[str], None] = '602a8b9c1d2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Check exams table
    exam_cols = [c['name'] for c in inspector.get_columns('exams')]
    if 'access_mode' not in exam_cols:
        op.add_column('exams', sa.Column('access_mode', sa.String(50), server_default='ENROLLED_ONLY', nullable=False))

    # Check exam_submissions table
    sub_cols = [c['name'] for c in inspector.get_columns('exam_submissions')]
    if 'answer_version' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('answer_version', sa.Integer(), server_default='0', nullable=False))
    if 'grading_status' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('grading_status', sa.String(50), server_default='COMPLETED', nullable=False))
    if 'questions_snapshot_json' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('questions_snapshot_json', sa.Text(), nullable=True))

def downgrade() -> None:
    pass
