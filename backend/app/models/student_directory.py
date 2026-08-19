from sqlalchemy import Column, String, ForeignKey, Boolean, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel

class StudentDirectory(TimeStampedModel):
    __tablename__ = "student_directories"
    
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)

    workspace = relationship("Workspace", back_populates="directories")
    creator = relationship("User")
    students = relationship("DirectoryStudent", back_populates="directory", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="student_directory")

class DirectoryStudent(TimeStampedModel):
    __tablename__ = "directory_students"
    
    directory_id = Column(String(36), ForeignKey("student_directories.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    roll_number = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    student_code = Column(String(100), nullable=True)
    status = Column(String(50), default="active")  # "active", "inactive"
    metadata_json = Column(Text, nullable=True)

    directory = relationship("StudentDirectory", back_populates="students")
    candidate_snapshots = relationship("ExamCandidate", back_populates="directory_student")

    __table_args__ = (
        UniqueConstraint("directory_id", "email", name="uq_directory_student_email"),
        UniqueConstraint("directory_id", "roll_number", name="uq_directory_student_roll"),
    )
