"""add_reattempt_and_submission_columns

Revision ID: 935d1e2f4a5b
Revises: 824c0d1e3f4a
Create Date: 2026-09-10 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '935d1e2f4a5b'
down_revision: Union[str, Sequence[str], None] = '824c0d1e3f4a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Check exam_submissions table
    sub_cols = [c['name'] for c in inspector.get_columns('exam_submissions')]
    if 'attempt_number' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('attempt_number', sa.Integer(), server_default='1', nullable=False))
    if 'is_counted_for_result' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('is_counted_for_result', sa.Boolean(), server_default='1', nullable=False))
    if 'reattempt_granted_by' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('reattempt_granted_by', sa.String(36), nullable=True))
    if 'reopened_from_id' not in sub_cols:
        op.add_column('exam_submissions', sa.Column('reopened_from_id', sa.String(36), nullable=True))

    # Backfill any nulls
    op.execute("UPDATE exam_submissions SET attempt_number = 1 WHERE attempt_number IS NULL")
    op.execute("UPDATE exam_submissions SET is_counted_for_result = 1 WHERE is_counted_for_result IS NULL")

    # In PostgreSQL or environments with named unique constraint on credential_id, drop it
    try:
        if conn.dialect.name == "postgresql":
            op.execute("ALTER TABLE exam_submissions DROP CONSTRAINT IF EXISTS exam_submissions_credential_id_key")
            op.execute("ALTER TABLE exam_submissions ADD CONSTRAINT uq_candidate_attempt UNIQUE (candidate_id, attempt_number)")
    except Exception:
        pass

def downgrade() -> None:
    pass
