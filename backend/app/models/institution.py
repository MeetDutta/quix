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

def get_or_create_subject(db, subject_id: str):
    if not subject_id:
        subject_id = "general_101"
    subj = db.query(Subject).filter(Subject.id == subject_id).first()
    if subj:
        return subj

    inst = db.query(Institution).filter(Institution.is_deleted == False).first()
    if not inst:
        inst = Institution(id="inst-aegeus-001", name="Aegeus Educational Institute")
        db.add(inst)
        db.flush()

    dept = db.query(Department).filter(Department.institution_id == inst.id).first()
    if not dept:
        dept = Department(id="dept-cs-001", name="Computer Science", institution_id=inst.id)
        db.add(dept)
        db.flush()

    course = db.query(Course).filter(Course.department_id == dept.id).first()
    if not course:
        course = Course(id="course-ug-001", name="Undergraduate Program", department_id=dept.id)
        db.add(course)
        db.flush()

    subj = Subject(id=subject_id, name=subject_id.replace("_", " ").title(), course_id=course.id)
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return subj
