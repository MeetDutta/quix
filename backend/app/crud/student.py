from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.user import User, Student

def get_students_by_institution(db: Session, institution_id: Optional[str] = None) -> List[Student]:
    """Fetch active students optionally filtered by institution_id."""
    query = db.query(Student).join(User).filter(User.is_deleted == False)
    if institution_id:
        query = query.filter(User.institution_id == institution_id)
    return query.all()

def get_student_by_id(db: Session, student_id: str) -> Optional[Student]:
    """Fetch student profile by ID."""
    return db.query(Student).filter(Student.id == student_id, Student.is_deleted == False).first()

def get_student_by_user_id(db: Session, user_id: str) -> Optional[Student]:
    """Fetch student profile by User ID."""
    return db.query(Student).filter(Student.user_id == user_id).first()
