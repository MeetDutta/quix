from sqlalchemy import Column, String, ForeignKey, Integer, Float, Text, Boolean, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel
from app.utils.timezone import now_utc

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
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    exam_code = Column(String(50), unique=True, index=True, nullable=False)
    is_published = Column(Boolean, default=False)
    is_result_published = Column(Boolean, default=False)
    access_mode = Column(String(50), default="ENROLLED_ONLY", nullable=False) # "ENROLLED_ONLY", "OPEN_REGISTRATION"
    blueprint_json = Column(Text, nullable=True)
    questions_json = Column(Text, nullable=True)
    settings_json = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False)
    
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
    __table_args__ = (
        UniqueConstraint("exam_id", "candidate_id", name="uq_exam_credential_candidate"),
    )
    
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False)
    candidate_id = Column(String(36), ForeignKey("exam_candidates.id", ondelete="CASCADE"), nullable=True, index=True)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=True) # Optional association with legacy student record
    username = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(100), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    exam = relationship("Exam", back_populates="credentials")
    candidate = relationship("ExamCandidate", back_populates="credential")
    student = relationship("Student")
    submission = relationship("ExamSubmission", back_populates="credential", uselist=False, cascade="all, delete-orphan")

class ExamSubmission(TimeStampedModel):
    __tablename__ = "exam_submissions"
    
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False)
    candidate_id = Column(String(36), ForeignKey("exam_candidates.id", ondelete="CASCADE"), nullable=True, index=True)
    credential_id = Column(String(36), ForeignKey("exam_credentials.id"), unique=True, nullable=False)
    answers_json = Column(Text, nullable=True) # JSON of student answers
    questions_snapshot_json = Column(Text, nullable=True) # Immutable snapshot of questions at attempt start
    answer_version = Column(Integer, default=0, nullable=False) # Server-controlled monotonic autosave version
    score = Column(Float, default=0.0)
    percentage = Column(Float, default=0.0)
    status = Column(String(50), default="started") # "started", "submitting", "submitted", "auto_submitted", "graded", "terminated"
    grading_status = Column(String(50), default="COMPLETED", nullable=False) # "COMPLETED", "PENDING_MANUAL_REVIEW"
    ai_feedback = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=now_utc)
    deadline_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), default=now_utc, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    
    tab_switch_count = Column(Integer, default=0, nullable=False)
    auto_submit_reason = Column(String(100), nullable=True) # "TAB_SWITCH", "TIME_EXPIRED", etc.
    
    exam = relationship("Exam", back_populates="submissions")
    candidate = relationship("ExamCandidate", back_populates="submission")
    credential = relationship("ExamCredential", back_populates="submission")
    proctoring_logs = relationship("ProctoringLog", back_populates="submission", cascade="all, delete-orphan")

class ProctoringLog(TimeStampedModel):
    __tablename__ = "proctoring_logs"
    __table_args__ = (
        UniqueConstraint("submission_id", "client_event_id", name="uq_proctor_log_sub_client_event"),
    )
    
    submission_id = Column(String(36), ForeignKey("exam_submissions.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("exam_candidates.id", ondelete="CASCADE"), nullable=True, index=True)
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=True, index=True)
    event_type = Column(String(100), nullable=False) # "tab_switch", "copy_paste", "devtools", "resize", "idle"
    event_details = Column(Text, nullable=True)
    client_event_id = Column(String(64), nullable=True, index=True)
    source = Column(String(50), default="browser_visibility", nullable=True)
    client_timestamp = Column(DateTime(timezone=True), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=now_utc)
    
    submission = relationship("ExamSubmission", back_populates="proctoring_logs")

class AuditLog(TimeStampedModel):
    __tablename__ = "audit_logs"
    
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True) # None for unauthenticated actions (like public portal)
    action = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=now_utc)
    
    user = relationship("User", back_populates="audit_logs")

