from sqlalchemy import Column, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel

class ExamCandidate(TimeStampedModel):
    __tablename__ = "exam_candidates"
    
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False, index=True)
    directory_student_id = Column(String(36), ForeignKey("directory_students.id"), nullable=True, index=True)
    
    name_snapshot = Column(String(255), nullable=False)
    email_snapshot = Column(String(255), nullable=True)
    roll_number_snapshot = Column(String(100), nullable=True)
    
    status = Column(String(50), default="PENDING")  # "PENDING", "ACTIVE", "SUBMITTED", "ABSENT"
    metadata_json = Column(Text, nullable=True)

    exam = relationship("Exam", back_populates="candidates")
    directory_student = relationship("DirectoryStudent", back_populates="candidate_snapshots")
