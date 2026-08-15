from sqlalchemy.orm import Session
from typing import List, Set
from app.models.exam import Exam
from app.models.assessment_group import AssessmentGroup, AssessmentGroupStudent, ExamTarget, ExamStudentOverride
from app.models.academic import StudentCohortMembership
from app.models.user import Student, User

class ExamEligibilityService:
    @staticmethod
    def resolve_students(db: Session, exam_id: str) -> List[Student]:
        """
        Resolves the exact set of eligible students for an exam based on:
        1. ExamTargets -> AssessmentGroups (COHORT or CUSTOM)
        2. EXCLUDE overrides
        3. INCLUDE overrides
        Returns unique Student objects.
        """
        exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False).first()
        if not exam:
            return []

        # Gather target assessment group IDs
        group_ids: Set[str] = set()
        if exam.assessment_group_id:
            group_ids.add(exam.assessment_group_id)
            
        targets = db.query(ExamTarget).filter(ExamTarget.exam_id == exam_id).all()
        for t in targets:
            group_ids.add(t.assessment_group_id)

        candidate_student_ids: Set[str] = set()

        # Resolve each AssessmentGroup
        for g_id in group_ids:
            group = db.query(AssessmentGroup).filter(AssessmentGroup.id == g_id, AssessmentGroup.is_active == True).first()
            if not group:
                continue

            if group.type == "COHORT" and group.cohort_id:
                # Resolve students currently in cohort
                memberships = db.query(StudentCohortMembership).filter(
                    StudentCohortMembership.cohort_id == group.cohort_id,
                    StudentCohortMembership.is_current == True
                ).all()
                for m in memberships:
                    candidate_student_ids.add(m.student_id)
                    
            elif group.type == "CUSTOM":
                # Resolve students in custom group
                group_students = db.query(AssessmentGroupStudent).filter(
                    AssessmentGroupStudent.assessment_group_id == g_id
                ).all()
                for gs in group_students:
                    candidate_student_ids.add(gs.student_id)

        # Apply EXCLUDE overrides
        exclude_overrides = db.query(ExamStudentOverride).filter(
            ExamStudentOverride.exam_id == exam_id,
            ExamStudentOverride.action == "EXCLUDE"
        ).all()
        exclude_ids = {o.student_id for o in exclude_overrides}
        candidate_student_ids -= exclude_ids

        # Apply INCLUDE overrides
        include_overrides = db.query(ExamStudentOverride).filter(
            ExamStudentOverride.exam_id == exam_id,
            ExamStudentOverride.action == "INCLUDE"
        ).all()
        include_ids = {o.student_id for o in include_overrides}
        candidate_student_ids |= include_ids

        if not candidate_student_ids:
            return []

        # Return unique Student records whose User accounts are active and not deleted
        students = db.query(Student).join(User).filter(
            Student.id.in_(candidate_student_ids),
            User.is_deleted == False,
            User.is_active == True
        ).all()

        return students
