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
