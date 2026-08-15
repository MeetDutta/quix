from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import TimeStampedModel

class AssessmentGroup(TimeStampedModel):
    __tablename__ = "assessment_groups"
    
    institution_id = Column(String(36), ForeignKey("institutions.id"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False, default="CUSTOM")  # "COHORT", "CUSTOM"
    cohort_id = Column(String(36), ForeignKey("cohorts.id"), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    institution = relationship("Institution")
    cohort = relationship("Cohort")
    creator = relationship("User")
    group_students = relationship("AssessmentGroupStudent", back_populates="assessment_group", cascade="all, delete-orphan")
    exam_targets = relationship("ExamTarget", back_populates="assessment_group", cascade="all, delete-orphan")

class AssessmentGroupStudent(TimeStampedModel):
    __tablename__ = "assessment_group_students"
    
    assessment_group_id = Column(String(36), ForeignKey("assessment_groups.id"), nullable=False)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)

    assessment_group = relationship("AssessmentGroup", back_populates="group_students")
    student = relationship("Student")

class ExamTarget(TimeStampedModel):
    __tablename__ = "exam_targets"
    
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False)
    assessment_group_id = Column(String(36), ForeignKey("assessment_groups.id"), nullable=False)

    exam = relationship("Exam", back_populates="targets")
    assessment_group = relationship("AssessmentGroup", back_populates="exam_targets")

class ExamStudentOverride(TimeStampedModel):
    __tablename__ = "exam_student_overrides"
    
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    action = Column(String(50), nullable=False)  # "INCLUDE", "EXCLUDE"
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    exam = relationship("Exam", back_populates="student_overrides")
    student = relationship("Student")
    creator = relationship("User")
