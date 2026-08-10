from sqlalchemy import Column, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel

class User(TimeStampedModel):
    __tablename__ = "users"
    
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # "super_admin", "inst_admin", "teacher", "student"
    institution_id = Column(String(36), ForeignKey("institutions.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    
    institution = relationship("Institution", back_populates="users")
    student_profile = relationship("Student", back_populates="user", uselist=False, cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="uploader")
    audit_logs = relationship("AuditLog", back_populates="user")

class Student(TimeStampedModel):
    __tablename__ = "students"
    
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    roll_number = Column(String(100), nullable=False)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    division = Column(String(50), nullable=True)
    batch = Column(String(100), nullable=True)
    status = Column(String(50), default="active")  # "active", "inactive", "suspended"
    
    user = relationship("User", back_populates="student_profile")
