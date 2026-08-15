from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import date
from app.database import get_db
from app.models.user import User, Student
from app.models.institution import Department, Course, Subject
from app.models.academic import AcademicSession, Cohort, StudentCohortMembership, SubjectOffering, StudentSubjectEnrollment
from app.utils.security import get_current_user, RoleChecker

router = APIRouter(prefix="/academic", tags=["academic_hierarchy"])
admin_or_teacher_required = RoleChecker(["teacher", "inst_admin", "super_admin"])

# --- Schemas ---
class AcademicSessionCreate(BaseModel):
    name: str  # e.g. "2026-27"
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class CohortCreate(BaseModel):
    course_id: str
    academic_session_id: str
    year_number: int
    semester_number: int
    division: str = "A"
    name: Optional[str] = None

class SubjectOfferingCreate(BaseModel):
    subject_id: str
    cohort_id: str
    academic_session_id: str
    teacher_id: Optional[str] = None

# --- Endpoints ---
@router.get("/sessions")
def get_academic_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List academic sessions for the user's institution."""
    query = db.query(AcademicSession).filter(AcademicSession.is_deleted == False)
    if current_user.institution_id:
        query = query.filter(AcademicSession.institution_id == current_user.institution_id)
    return query.order_by(AcademicSession.name.desc()).all()

@router.post("/sessions")
def create_academic_session(
    payload: AcademicSessionCreate,
    current_user: User = Depends(admin_or_teacher_required),
    db: Session = Depends(get_db)
):
    """Create a new academic session."""
    inst_id = current_user.institution_id or "inst-aegeus-001"
    session = AcademicSession(
        institution_id=inst_id,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        is_active=True
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("/cohorts")
def get_cohorts(
    course_id: Optional[str] = None,
    academic_session_id: Optional[str] = None,
    year_number: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List cohorts with optional course/session filters."""
    query = db.query(Cohort).filter(Cohort.is_deleted == False)
    if course_id:
        query = query.filter(Cohort.course_id == course_id)
    if academic_session_id:
        query = query.filter(Cohort.academic_session_id == academic_session_id)
    if year_number:
        query = query.filter(Cohort.year_number == year_number)

    cohorts = query.order_by(Cohort.year_number, Cohort.division).all()
    res = []
    for c in cohorts:
        student_count = db.query(StudentCohortMembership).filter(
            StudentCohortMembership.cohort_id == c.id,
            StudentCohortMembership.is_current == True
        ).count()
        res.append({
            "id": c.id,
            "name": c.name,
            "course_id": c.course_id,
            "academic_session_id": c.academic_session_id,
            "year_number": c.year_number,
            "semester_number": c.semester_number,
            "division": c.division,
            "is_active": c.is_active,
            "student_count": student_count
        })
    return res

@router.post("/cohorts")
def create_cohort(
    payload: CohortCreate,
    current_user: User = Depends(admin_or_teacher_required),
    db: Session = Depends(get_db)
):
    """Create or retrieve an academic cohort."""
    name = payload.name or f"Yr{payload.year_number}-{payload.division}"
    # Check if duplicate exists
    existing = db.query(Cohort).filter(
        Cohort.course_id == payload.course_id,
        Cohort.academic_session_id == payload.academic_session_id,
        Cohort.year_number == payload.year_number,
        Cohort.division == payload.division,
        Cohort.is_deleted == False
    ).first()
    if existing:
        return existing

    cohort = Cohort(
        course_id=payload.course_id,
        academic_session_id=payload.academic_session_id,
        year_number=payload.year_number,
        semester_number=payload.semester_number,
        division=payload.division,
        name=name,
        is_active=True
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)
    return cohort

@router.get("/cohorts/{cohort_id}/students")
def get_cohort_students(
    cohort_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch all active students enrolled in a specific cohort."""
    memberships = db.query(StudentCohortMembership).filter(
        StudentCohortMembership.cohort_id == cohort_id,
        StudentCohortMembership.is_current == True
    ).all()
    
    student_ids = [m.student_id for m in memberships]
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

@router.get("/subject-offerings")
def get_subject_offerings(
    cohort_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List subject offerings."""
    query = db.query(SubjectOffering).filter(SubjectOffering.is_deleted == False)
    if cohort_id:
        query = query.filter(SubjectOffering.cohort_id == cohort_id)
    if subject_id:
        query = query.filter(SubjectOffering.subject_id == subject_id)
    return query.all()

@router.post("/subject-offerings")
def create_subject_offering(
    payload: SubjectOfferingCreate,
    current_user: User = Depends(admin_or_teacher_required),
    db: Session = Depends(get_db)
):
    """Create a new subject offering."""
    offering = SubjectOffering(
        subject_id=payload.subject_id,
        cohort_id=payload.cohort_id,
        academic_session_id=payload.academic_session_id,
        teacher_id=payload.teacher_id or current_user.id,
        status="active"
    )
    db.add(offering)
    db.commit()
    db.refresh(offering)
    return offering

class ClassCreateRequest(BaseModel):
    name: str
    department_id: str
    division: str = "A"
    batch_year: Optional[str] = "2026"
    academic_session_id: Optional[str] = None

@router.post("/classes")
def create_academic_class(
    payload: ClassCreateRequest,
    current_user: User = Depends(admin_or_teacher_required),
    db: Session = Depends(get_db)
):
    """
    Streamlined class & cohort creation endpoint connecting department, division, and cohort.
    """
    dept = db.query(Department).filter(Department.id == payload.department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    # Find or create a default course under this department
    course = db.query(Course).filter(Course.department_id == dept.id, Course.is_deleted == False).first()
    if not course:
        course = Course(name=f"{dept.name} Program", department_id=dept.id)
        db.add(course)
        db.flush()

    # Find or create academic session
    session_id = payload.academic_session_id
    if not session_id:
        session = db.query(AcademicSession).filter(AcademicSession.is_deleted == False).order_by(AcademicSession.created_at.desc()).first()
        if not session:
            session = AcademicSession(
                institution_id=dept.institution_id,
                name=f"Session {payload.batch_year or '2026'}",
                is_active=True
            )
            db.add(session)
            db.flush()
        session_id = session.id

    # Create Cohort / Class
    class_name = payload.name.strip() or f"{dept.name} - Div {payload.division}"
    cohort = Cohort(
        course_id=course.id,
        academic_session_id=session_id,
        year_number=1,
        semester_number=1,
        division=payload.division.strip().upper() or "A",
        name=class_name,
        is_active=True
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)
    return {
        "id": cohort.id,
        "name": cohort.name,
        "division": cohort.division,
        "department_id": dept.id,
        "department_name": dept.name,
        "student_count": 0
    }

@router.delete("/classes/{cohort_id}")
def delete_academic_class(
    cohort_id: str,
    current_user: User = Depends(admin_or_teacher_required),
    db: Session = Depends(get_db)
):
    """Soft-delete an academic class/cohort."""
    cohort = db.query(Cohort).filter(Cohort.id == cohort_id).first()
    if not cohort:
        raise HTTPException(status_code=404, detail="Class not found")
    cohort.delete()
    db.commit()
    return {"message": f"Class '{cohort.name}' removed."}

@router.get("/classes/summary")
def get_academic_classes_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns complete summary of departments and active classes with live student counts."""
    # Departments
    dept_query = db.query(Department).filter(Department.is_deleted == False)
    if current_user.institution_id:
        dept_query = dept_query.filter(Department.institution_id == current_user.institution_id)
    depts = dept_query.all()
    
    dept_list = []
    for d in depts:
        count = db.query(Student).filter(Student.department_id == d.id, Student.is_deleted == False).count()
        dept_list.append({
            "id": d.id,
            "name": d.name,
            "student_count": count
        })

    # Cohorts / Classes
    cohort_query = db.query(Cohort).filter(Cohort.is_deleted == False)
    cohorts = cohort_query.all()
    
    class_list = []
    for c in cohorts:
        course = db.query(Course).filter(Course.id == c.course_id).first()
        dept = db.query(Department).filter(Department.id == course.department_id).first() if course else None
        
        # Student count by cohort membership or division match
        membership_count = db.query(StudentCohortMembership).filter(
            StudentCohortMembership.cohort_id == c.id,
            StudentCohortMembership.is_current == True
        ).count()
        
        # If no explicit membership yet, count by department & division match
        if membership_count == 0 and dept:
            membership_count = db.query(Student).filter(
                Student.department_id == dept.id,
                Student.division == c.division,
                Student.is_deleted == False
            ).count()
            
        class_list.append({
            "id": c.id,
            "name": c.name,
            "division": c.division,
            "department_id": dept.id if dept else None,
            "department_name": dept.name if dept else "General",
            "student_count": membership_count
        })

    return {
        "departments": dept_list,
        "classes": class_list
    }
