from sqlalchemy import Column, String, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel

class ExamCandidate(TimeStampedModel):
    __tablename__ = "exam_candidates"
    __table_args__ = (
        UniqueConstraint("exam_id", "directory_student_id", name="uq_exam_candidate_dir_student"),
    )
    
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False, index=True)
    directory_student_id = Column(String(36), ForeignKey("directory_students.id"), nullable=True, index=True)
    
    name_snapshot = Column(String(255), nullable=False)
    email_snapshot = Column(String(255), nullable=True)
    roll_number_snapshot = Column(String(100), nullable=True)
    
    status = Column(String(50), default="PENDING")  # "PENDING", "ACTIVE", "SUBMITTED", "ABSENT"
    metadata_json = Column(Text, nullable=True)

    exam = relationship("Exam", back_populates="candidates")
    directory_student = relationship("DirectoryStudent", back_populates="candidate_snapshots")
    credential = relationship("ExamCredential", back_populates="candidate", uselist=False, cascade="all, delete-orphan")
    submissions = relationship("ExamSubmission", back_populates="candidate", cascade="all, delete-orphan", order_by="ExamSubmission.attempt_number")

    @property
    def submission(self):
        """Returns latest active submission or latest completed submission for backward compatibility."""
        if not self.submissions:
            return None
        for s in reversed(self.submissions):
            if s.status in ["started", "in_progress", "submitting"]:
                return s
        return self.submissions[-1]
