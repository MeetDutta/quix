from sqlalchemy import Column, String, ForeignKey, Boolean, Date
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel

class Institution(TimeStampedModel):
    __tablename__ = "institutions"
    
    name = Column(String(255), nullable=False)
    subscription_status = Column(String(50), default="active")
    max_users = Column(String(50), default="1000")
    
    departments = relationship("Department", back_populates="institution", cascade="all, delete-orphan")
    users = relationship("User", back_populates="institution", cascade="all, delete-orphan")

class Department(TimeStampedModel):
    __tablename__ = "departments"
    
    name = Column(String(255), nullable=False)
    institution_id = Column(String(36), ForeignKey("institutions.id"), nullable=False)
    
    institution = relationship("Institution", back_populates="departments")
    courses = relationship("Course", back_populates="department", cascade="all, delete-orphan")
    divisions = relationship("Division", back_populates="department", cascade="all, delete-orphan")

class Course(TimeStampedModel):
    __tablename__ = "courses"
    
    name = Column(String(255), nullable=False)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=False)
    
    department = relationship("Department", back_populates="courses")
    subjects = relationship("Subject", back_populates="course", cascade="all, delete-orphan")
    semesters = relationship("Semester", back_populates="course", cascade="all, delete-orphan")

class Subject(TimeStampedModel):
    __tablename__ = "subjects"
    
    name = Column(String(255), nullable=False)
    course_id = Column(String(36), ForeignKey("courses.id"), nullable=False)
    
    course = relationship("Course", back_populates="subjects")
    questions = relationship("Question", back_populates="subject")
    exams = relationship("Exam", back_populates="subject")

class Semester(TimeStampedModel):
    __tablename__ = "semesters"
    
    name = Column(String(50), nullable=False)
    course_id = Column(String(36), ForeignKey("courses.id"), nullable=False)
    
    course = relationship("Course", back_populates="semesters")

class Division(TimeStampedModel):
    __tablename__ = "divisions"
    
    name = Column(String(50), nullable=False)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=False)
    
    department = relationship("Department", back_populates="divisions")

class AcademicYear(TimeStampedModel):
    __tablename__ = "academic_years"
    
    name = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True)
