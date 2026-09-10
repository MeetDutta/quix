"""add_candidate_identity_and_presence_columns

Revision ID: 602a8b9c1d2e
Revises: 585de10d3e0e
Create Date: 2026-09-10 09:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '602a8b9c1d2e'
down_revision: Union[str, Sequence[str], None] = '585de10d3e0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Check exam_credentials
    cred_cols = [c['name'] for c in inspector.get_columns('exam_credentials')]
    if 'candidate_id' not in cred_cols:
        op.add_column('exam_credentials', sa.Column('candidate_id', sa.String(36), nullable=True))
        try:
            op.create_index('ix_exam_credentials_candidate_id', 'exam_credentials', ['candidate_id'])
        except Exception:
            pass

    # Check exam_submissions
    sub_cols = [c['name'] for c in inspector.get_columns('exam_submissions')]
    if 'candidate_id' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('candidate_id', sa.String(36), nullable=True))
        try:
            op.create_index('ix_exam_submissions_candidate_id', 'exam_submissions', ['candidate_id'])
        except Exception:
            pass
    if 'deadline_at' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('deadline_at', sa.DateTime(), nullable=True))
    if 'last_seen_at' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('last_seen_at', sa.DateTime(), nullable=True))

def downgrade() -> None:
    pass
