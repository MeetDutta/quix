from sqlalchemy import Column, String, ForeignKey, Boolean, Date, Integer, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import TimeStampedModel

class AcademicSession(TimeStampedModel):
    __tablename__ = "academic_sessions"
    
    institution_id = Column(String(36), ForeignKey("institutions.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g. "2026-27"
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)

    institution = relationship("Institution")
    cohorts = relationship("Cohort", back_populates="academic_session", cascade="all, delete-orphan")

class Cohort(TimeStampedModel):
    __tablename__ = "cohorts"
    
    course_id = Column(String(36), ForeignKey("courses.id"), nullable=False)
    academic_session_id = Column(String(36), ForeignKey("academic_sessions.id"), nullable=False)
    year_number = Column(Integer, default=1, nullable=False)
    semester_number = Column(Integer, default=1, nullable=False)
    division = Column(String(50), default="A", nullable=False)
    name = Column(String(100), nullable=False)  # e.g. "CE-3-A"
    is_active = Column(Boolean, default=True)

    course = relationship("Course")
    academic_session = relationship("AcademicSession", back_populates="cohorts")
    memberships = relationship("StudentCohortMembership", back_populates="cohort", cascade="all, delete-orphan")
    subject_offerings = relationship("SubjectOffering", back_populates="cohort", cascade="all, delete-orphan")

class StudentCohortMembership(TimeStampedModel):
    __tablename__ = "student_cohort_memberships"
    
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    cohort_id = Column(String(36), ForeignKey("cohorts.id"), nullable=False)
    is_current = Column(Boolean, default=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)

    student = relationship("Student", back_populates="cohort_memberships")
    cohort = relationship("Cohort", back_populates="memberships")

class SubjectOffering(TimeStampedModel):
    __tablename__ = "subject_offerings"
    
    subject_id = Column(String(36), ForeignKey("subjects.id"), nullable=False)
    cohort_id = Column(String(36), ForeignKey("cohorts.id"), nullable=False)
    teacher_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    academic_session_id = Column(String(36), ForeignKey("academic_sessions.id"), nullable=False)
    status = Column(String(50), default="active")  # "active", "archived"

    subject = relationship("Subject")
    cohort = relationship("Cohort", back_populates="subject_offerings")
    teacher = relationship("User")
    academic_session = relationship("AcademicSession")
    enrollments = relationship("StudentSubjectEnrollment", back_populates="subject_offering", cascade="all, delete-orphan")

class StudentSubjectEnrollment(TimeStampedModel):
    __tablename__ = "student_subject_enrollments"
    
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    subject_offering_id = Column(String(36), ForeignKey("subject_offerings.id"), nullable=False)
    status = Column(String(50), default="ENROLLED")  # "ENROLLED", "DROPPED", "COMPLETED"
    enrolled_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="subject_enrollments")
    subject_offering = relationship("SubjectOffering", back_populates="enrollments")
