from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.exam import Exam, ExamSubmission, ExamCredential

def get_all_exams(db: Session, is_published_only: bool = False) -> List[Exam]:
    """Fetch exams list."""
    query = db.query(Exam).filter(Exam.is_deleted == False)
    if is_published_only:
        query = query.filter(Exam.is_published == True)
    return query.order_by(Exam.created_at.desc()).all()

def get_exam_by_id(db: Session, exam_id: str) -> Optional[Exam]:
    """Fetch exam by ID."""
    return db.query(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False).first()

def get_exam_by_code(db: Session, exam_code: str) -> Optional[Exam]:
    """Fetch exam by public unique code."""
    return db.query(Exam).filter(Exam.exam_code == exam_code, Exam.is_deleted == False).first()
