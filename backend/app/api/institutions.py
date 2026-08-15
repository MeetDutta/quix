from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.institution import Institution, Department, Course, Subject
from app.models.user import User
from app.schemas.student import InstitutionResponse
from app.utils.security import RoleChecker, get_current_user

router = APIRouter(prefix="/institutions", tags=["institutions"])
admin_required = RoleChecker(["inst_admin", "super_admin"])

@router.get("/", response_model=List[InstitutionResponse])
def get_institutions(db: Session = Depends(get_db)):
    """Fetch all active institutions."""
    return db.query(Institution).filter(Institution.is_deleted == False).all()

@router.post("/", response_model=InstitutionResponse)
def create_institution(name: str, db: Session = Depends(get_db), current_user: User = Depends(admin_required)):
    """Create a new institution (admin only)."""
    inst = Institution(name=name)
    db.add(inst)
    db.commit()
    db.refresh(inst)
    return inst

from pydantic import BaseModel
from app.models.user import Student

class DepartmentCreate(BaseModel):
    name: str

@router.get("/departments")
def get_departments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch departments under current user's institution with student counts."""
    query = db.query(Department).filter(Department.is_deleted == False)
    if current_user.institution_id:
        query = query.filter(Department.institution_id == current_user.institution_id)
    depts = query.all()
    res = []
    for d in depts:
        count = db.query(Student).filter(Student.department_id == d.id, Student.is_deleted == False).count()
        res.append({
            "id": d.id,
            "name": d.name,
            "institution_id": d.institution_id,
            "student_count": count
        })
    return res

@router.post("/departments")
def create_department(
    payload: DepartmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new academic department."""
    inst_id = current_user.institution_id
    if not inst_id:
        inst = db.query(Institution).first()
        if not inst:
            inst = Institution(name="Main Campus Institution")
            db.add(inst)
            db.flush()
        inst_id = inst.id

    # Check duplicate
    existing = db.query(Department).filter(
        Department.institution_id == inst_id,
        Department.name.ilike(payload.name.strip()),
        Department.is_deleted == False
    ).first()
    if existing:
        return {"id": existing.id, "name": existing.name, "message": "Department already exists."}

    dept = Department(
        name=payload.name.strip(),
        institution_id=inst_id
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"id": dept.id, "name": dept.name, "student_count": 0}

@router.delete("/departments/{department_id}")
def delete_department(
    department_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete an academic department."""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.delete()
    db.commit()
    return {"message": f"Department '{dept.name}' removed."}

@router.get("/{institution_id}", response_model=InstitutionResponse)
def get_institution_by_id(institution_id: str, db: Session = Depends(get_db)):
    """Fetch institution details by ID."""
    inst = db.query(Institution).filter(Institution.id == institution_id, Institution.is_deleted == False).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")
    return inst

@router.get("/{institution_id}/departments")
def get_institution_departments(institution_id: str, db: Session = Depends(get_db)):
    """Fetch departments under an institution."""
    depts = db.query(Department).filter(Department.institution_id == institution_id, Department.is_deleted == False).all()
    return [{"id": d.id, "name": d.name} for d in depts]
