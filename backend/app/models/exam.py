from sqlalchemy import Column, String, ForeignKey, Integer, Float, Text, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import TimeStampedModel

class Exam(TimeStampedModel):
    __tablename__ = "exams"
    
    name = Column(String(255), nullable=False)
    subject_id = Column(String(36), ForeignKey("subjects.id"), nullable=False)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), index=True, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    student_directory_id = Column(String(36), ForeignKey("student_directories.id"), nullable=True)
    subject_offering_id = Column(String(36), ForeignKey("subject_offerings.id"), nullable=True)
    assessment_group_id = Column(String(36), ForeignKey("assessment_groups.id"), nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    total_marks = Column(Integer, nullable=False)
    negative_marking = Column(Float, default=0.0)
    passing_marks = Column(Integer, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    is_published = Column(Boolean, default=False)
    is_result_published = Column(Boolean, default=False)
    exam_code = Column(String(100), unique=True, index=True, nullable=False) # For isolated portal link
    
    blueprint_json = Column(Text, nullable=True) # JSON config for paper builder
    questions_json = Column(Text, nullable=True) # JSON list of question objects
    settings_json = Column(Text, nullable=True)  # JSON for fullscreen, shuffle, calculators, etc.
    
    subject = relationship("Subject", back_populates="exams")
    workspace = relationship("Workspace", back_populates="exams")
    creator = relationship("User", foreign_keys=[created_by])
    student_directory = relationship("StudentDirectory", back_populates="exams")
    candidates = relationship("ExamCandidate", back_populates="exam", cascade="all, delete-orphan")
    subject_offering = relationship("SubjectOffering")
    assessment_group = relationship("AssessmentGroup")
    targets = relationship("ExamTarget", back_populates="exam", cascade="all, delete-orphan")
    student_overrides = relationship("ExamStudentOverride", back_populates="exam", cascade="all, delete-orphan")
    credentials = relationship("ExamCredential", back_populates="exam", cascade="all, delete-orphan")
    submissions = relationship("ExamSubmission", back_populates="exam", cascade="all, delete-orphan")

class ExamCredential(TimeStampedModel):
    __tablename__ = "exam_credentials"
    
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=True) # Optional association with student record
    username = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(100), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    
    exam = relationship("Exam", back_populates="credentials")
    student = relationship("Student")
    submission = relationship("ExamSubmission", back_populates="credential", uselist=False, cascade="all, delete-orphan")

class ExamSubmission(TimeStampedModel):
    __tablename__ = "exam_submissions"
    
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False)
    credential_id = Column(String(36), ForeignKey("exam_credentials.id"), unique=True, nullable=False)
    answers_json = Column(Text, nullable=True) # JSON of student answers
    score = Column(Float, default=0.0)
    percentage = Column(Float, default=0.0)
    status = Column(String(50), default="started") # "started", "submitted", "auto_submitted", "terminated"
    ai_feedback = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    
    exam = relationship("Exam", back_populates="submissions")
    credential = relationship("ExamCredential", back_populates="submission")
    proctoring_logs = relationship("ProctoringLog", back_populates="submission", cascade="all, delete-orphan")

class ProctoringLog(TimeStampedModel):
    __tablename__ = "proctoring_logs"
    
    submission_id = Column(String(36), ForeignKey("exam_submissions.id"), nullable=False)
    event_type = Column(String(100), nullable=False) # "tab_switch", "copy_paste", "devtools", "resize", "idle"
    event_details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    submission = relationship("ExamSubmission", back_populates="proctoring_logs")

class AuditLog(TimeStampedModel):
    __tablename__ = "audit_logs"
    
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True) # None for unauthenticated actions (like public portal)
    action = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="audit_logs")
