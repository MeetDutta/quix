from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User, Student
from app.models.assessment_group import AssessmentGroup, AssessmentGroupStudent
from app.models.academic import StudentCohortMembership, Cohort
from app.utils.security import get_current_user, RoleChecker

router = APIRouter(prefix="/assessment-groups", tags=["assessment_groups"])
teacher_required = RoleChecker(["teacher", "inst_admin", "super_admin"])

class AssessmentGroupCreate(BaseModel):
    name: str
    type: str = "CUSTOM"  # "COHORT" or "CUSTOM"
    cohort_id: Optional[str] = None
    student_ids: Optional[List[str]] = None

@router.get("/")
def list_assessment_groups(
    group_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists assessment groups accessible by the logged in user."""
    query = db.query(AssessmentGroup).filter(AssessmentGroup.is_deleted == False, AssessmentGroup.is_active == True)
    if current_user.institution_id:
        query = query.filter(AssessmentGroup.institution_id == current_user.institution_id)
    if group_type:
        query = query.filter(AssessmentGroup.type == group_type)
        
    groups = query.order_by(AssessmentGroup.created_at.desc()).all()
    res = []
    for g in groups:
        if g.type == "COHORT" and g.cohort_id:
            count = db.query(StudentCohortMembership).filter(
                StudentCohortMembership.cohort_id == g.cohort_id,
                StudentCohortMembership.is_current == True
            ).count()
        else:
            count = db.query(AssessmentGroupStudent).filter(
                AssessmentGroupStudent.assessment_group_id == g.id
            ).count()

        res.append({
            "id": g.id,
            "name": g.name,
            "type": g.type,
            "cohort_id": g.cohort_id,
            "created_by": g.created_by,
            "student_count": count,
            "created_at": g.created_at.isoformat() if g.created_at else ""
        })
    return res

@router.post("/")
def create_assessment_group(
    payload: AssessmentGroupCreate,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """Creates a new reusable Assessment Group (Class / Group)."""
    inst_id = current_user.institution_id or "inst-aegeus-001"
    
    group = AssessmentGroup(
        institution_id=inst_id,
        name=payload.name,
        type=payload.type.upper(),
        cohort_id=payload.cohort_id,
        created_by=current_user.id,
        is_active=True
    )
    db.add(group)
    db.flush()

    if payload.type.upper() == "CUSTOM" and payload.student_ids:
        for s_id in set(payload.student_ids):
            gs = AssessmentGroupStudent(
                assessment_group_id=group.id,
                student_id=s_id
            )
            db.add(gs)

    db.commit()
    db.refresh(group)
    return {
        "id": group.id,
        "name": group.name,
        "type": group.type,
        "cohort_id": group.cohort_id,
        "student_count": len(payload.student_ids) if payload.student_ids else 0
    }

@router.get("/{group_id}/students")
def get_group_students(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the list of students belonging to an assessment group."""
    group = db.query(AssessmentGroup).filter(AssessmentGroup.id == group_id, AssessmentGroup.is_deleted == False).first()
    if not group:
        raise HTTPException(status_code=404, detail="Assessment group not found")

    student_ids = []
    if group.type == "COHORT" and group.cohort_id:
        memberships = db.query(StudentCohortMembership).filter(
            StudentCohortMembership.cohort_id == group.cohort_id,
            StudentCohortMembership.is_current == True
        ).all()
        student_ids = [m.student_id for m in memberships]
    else:
        gs_list = db.query(AssessmentGroupStudent).filter(
            AssessmentGroupStudent.assessment_group_id == group_id
        ).all()
        student_ids = [gs.student_id for gs in gs_list]

    if not student_ids:
        return []

    students = db.query(Student).join(User).filter(
        Student.id.in_(student_ids),
        User.is_deleted == False
    ).all()

    return [
        {
            "id": s.id,
            "full_name": s.user.full_name,
            "email": s.user.email,
            "roll_number": s.roll_number,
            "status": s.status
        }
        for s in students
    ]
