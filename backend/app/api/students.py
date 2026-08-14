import uuid
import threading
import json
import io
import csv
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User, Student
from app.models.exam import Exam, ExamCredential, ExamSubmission
from app.models.institution import Department, Institution
from app.schemas.student import StudentCreate, StudentResponse, InstitutionResponse
from app.utils.security import get_password_hash, RoleChecker, get_current_user
from app.services.email_service import email_service
from app.services.notification_service import create_notification
from app.config import settings

router = APIRouter(prefix="/students", tags=["students"])
teacher_or_admin_required = RoleChecker(["inst_admin", "teacher", "super_admin"])

@router.get("/", response_model=List[StudentResponse])
def list_students(
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db),
    department_id: Optional[str] = None,
    division: Optional[str] = None
):
    """Lists all students matching current user's institution."""
    query = db.query(Student).join(User).filter(
        User.is_deleted == False,
        User.institution_id == current_user.institution_id
    )
    if department_id:
        query = query.filter(Student.department_id == department_id)
    if division:
        query = query.filter(Student.division == division)
        
    students = query.all()
    
    resp = []
    for s in students:
        dept = db.query(Department).filter(Department.id == s.department_id).first() if s.department_id else None
        v_token = s.user.verification_token if (s.user and s.user.verification_token) else None
        v_url = f"{settings.FRONTEND_URL}/verify-student?token={v_token}" if v_token else None
        resp.append(StudentResponse(
            id=s.id,
            email=s.user.email,
            full_name=s.user.full_name,
            roll_number=s.roll_number,
            department_name=dept.name if dept else None,
            division=s.division,
            batch=s.batch,
            status=s.status,
            is_verified=s.user.is_verified if (s.user and s.user.is_verified is not None) else True,
            verification_token=v_token,
            verification_url=v_url
        ))
    return resp

@router.post("/", response_model=StudentResponse)
def create_student(
    student_in: StudentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db)
):
    """Manually creates a new student profile and sends an authorization email."""
    # Check email duplicate
    exists = db.query(User).filter(User.email == student_in.email, User.is_deleted == False).first()
    if exists:
        raise HTTPException(status_code=400, detail="Student email already exists")
        
    # Generate temporary verification token & initial password hash
    verification_token = str(uuid.uuid4())
    temp_pwd = str(uuid.uuid4())[:12]
    hashed_pwd = get_password_hash(temp_pwd)
    
    user = User(
        email=student_in.email,
        hashed_password=hashed_pwd,
        full_name=student_in.full_name,
        role="student",
        institution_id=current_user.institution_id,
        is_verified=False,
        verification_token=verification_token,
        auth_provider="local"
    )
    db.add(user)
    db.flush() # get user id
    
    student = Student(
        user_id=user.id,
        roll_number=student_in.roll_number,
        department_id=student_in.department_id,
        division=student_in.division,
        batch=student_in.batch
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    
    # Send in-app notification
    create_notification(
        db, 
        user_id=user.id, 
        title="Welcome to EduQuizX", 
        message="Your student profile has been created. Check your email for authorization steps.", 
        notification_type="system"
    )
    
    # Trigger automated authorization email with verification link in a non-blocking thread
    def _dispatch_create_email():
        try:
            email_service.send_student_authorization_email(
                student_name=user.full_name,
                email=user.email,
                verification_token=verification_token,
                roll_number=student.roll_number
            )
        except Exception as email_err:
            print(f"⚠️ Async email dispatch notice: {email_err}")

    threading.Thread(target=_dispatch_create_email, daemon=True).start()
    
    dept = db.query(Department).filter(Department.id == student.department_id).first() if student.department_id else None
    return StudentResponse(
        id=student.id,
        email=user.email,
        full_name=user.full_name,
        roll_number=student.roll_number,
        department_name=dept.name if dept else None,
        division=student.division,
        batch=student.batch,
        status=student.status,
        is_verified=False,
        verification_token=verification_token,
        verification_url=f"{settings.FRONTEND_URL}/verify-student?token={verification_token}"
    )

@router.post("/{student_id}/resend-auth")
def resend_student_authorization(
    student_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db)
):
    """Resends authorization email to pending student."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student or not student.user:
        raise HTTPException(status_code=404, detail="Student not found")
        
    if not student.user.verification_token:
        student.user.verification_token = str(uuid.uuid4())
        db.commit()
        
    def _dispatch_resend_email():
        try:
            email_service.send_student_authorization_email(
                student_name=student.user.full_name,
                email=student.user.email,
                verification_token=student.user.verification_token,
                roll_number=student.roll_number
            )
        except Exception as email_err:
            print(f"⚠️ Async resend email notice: {email_err}")

    threading.Thread(target=_dispatch_resend_email, daemon=True).start()
    return {"message": f"Authorization email re-sent to {student.user.email}"}

@router.post("/import")
def import_students_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db)
):
    """
    Imports students from a CSV file.
    Expected CSV columns: full_name, email, roll_number, division, batch
    """
    contents = file.file.read().decode("utf-8")
    io_string = io.StringIO(contents)
    reader = csv.DictReader(io_string)
    
    imported_count = 0
    errors = []
    
    for idx, row in enumerate(reader):
        email = row.get("email", "").strip()
        full_name = row.get("full_name", "").strip()
        roll_number = row.get("roll_number", "").strip()
        division = row.get("division", "").strip()
        batch = row.get("batch", "").strip()
        
        if not email or not full_name or not roll_number:
            errors.append(f"Row {idx+1}: Missing required columns")
            continue
            
        exists = db.query(User).filter(User.email == email, User.is_deleted == False).first()
        if exists:
            # Skip or update
            continue
            
        verification_token = str(uuid.uuid4())
        temp_pwd = str(uuid.uuid4())[:12]
        hashed_pwd = get_password_hash(temp_pwd)
        
        try:
            user = User(
                email=email,
                hashed_password=hashed_pwd,
                full_name=full_name,
                role="student",
                institution_id=current_user.institution_id,
                is_verified=False,
                verification_token=verification_token,
                auth_provider="local"
            )
            db.add(user)
            db.flush()
            
            student = Student(
                user_id=user.id,
                roll_number=roll_number,
                division=division,
                batch=batch
            )
            db.add(student)
            imported_count += 1

            # Dispatch authorization email for each CSV imported student
            background_tasks.add_task(
                email_service.send_student_authorization_email,
                student_name=user.full_name,
                email=user.email,
                verification_token=verification_token,
                roll_number=student.roll_number
            )
        except Exception as e:
            errors.append(f"Row {idx+1}: Error saving to DB ({str(e)})")
            
    db.commit()
    return {"message": f"Successfully imported {imported_count} students. Authorization emails dispatched.", "errors": errors}

@router.get("/export")
def export_students_csv(
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db)
):
    """Exports the student directory as a CSV download."""
    students = db.query(Student).join(User).filter(
        User.is_deleted == False,
        User.institution_id == current_user.institution_id
    ).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["full_name", "email", "roll_number", "division", "batch", "status"])
    
    for s in students:
        writer.writerow([
            s.user.full_name,
            s.user.email,
            s.roll_number,
            s.division or "",
            s.batch or "",
            s.status
        ])
        
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=students_directory.csv"}
    )

@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: str,
    student_in: StudentCreate,
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db)
):
    """Updates specific student fields dynamically."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    student.roll_number = student_in.roll_number
    student.division = student_in.division
    student.batch = student_in.batch
    student.department_id = student_in.department_id
    
    # Update user details
    student.user.full_name = student_in.full_name
    
    db.add(student)
    db.commit()
    db.refresh(student)
    
    dept = db.query(Department).filter(Department.id == student.department_id).first() if student.department_id else None
    return StudentResponse(
        id=student.id,
        email=student.user.email,
        full_name=student.user.full_name,
        roll_number=student.roll_number,
        department_name=dept.name if dept else None,
        division=student.division,
        batch=student.batch,
        status=student.status
    )

@router.delete("/{student_id}")
def delete_student(
    student_id: str,
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db)
):
    """Soft deletes student accounts."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    student.delete()
    student.user.delete()
    db.commit()
    return {"message": "Student successfully deleted."}

@router.get("/assigned-exams")
def get_student_assigned_exams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all active, scheduled, and completed assessments for the student portal,
    along with student-specific session passcodes, start times, and test room URLs.
    """
    now = datetime.utcnow()
    
    # Fetch all published exams
    exams = db.query(Exam).filter(
        Exam.is_published == True,
        Exam.is_deleted == False
    ).order_by(Exam.start_time.desc()).all()
    
    student = db.query(Student).filter(
        (Student.user_id == current_user.id) |
        (Student.user.has(User.email == current_user.email))
    ).first()
    
    results = []
    for exam in exams:
        cred = None
        if student:
            cred = db.query(ExamCredential).filter(
                ExamCredential.exam_id == exam.id,
                ExamCredential.student_id == student.id
            ).first()
            
        submission = None
        if cred:
            submission = db.query(ExamSubmission).filter(
                ExamSubmission.exam_id == exam.id,
                ExamSubmission.credential_id == cred.id
            ).first()
        elif student:
            submission = db.query(ExamSubmission).join(ExamCredential).filter(
                ExamSubmission.exam_id == exam.id,
                ExamCredential.student_id == student.id
            ).first()
            
        if exam.end_time < now:
            sched_status = "ended"
        elif exam.start_time > now:
            sched_status = "upcoming"
        else:
            sched_status = "active"
            
        try:
            questions_count = len(json.loads(exam.questions_json)) if exam.questions_json else 0
        except Exception:
            questions_count = 0
            
        results.append({
            "exam_id": exam.id,
            "name": exam.name,
            "exam_code": exam.exam_code,
            "duration_minutes": exam.duration_minutes,
            "total_marks": exam.total_marks,
            "passing_marks": exam.passing_marks,
            "start_time": exam.start_time.isoformat(),
            "end_time": exam.end_time.isoformat(),
            "status": sched_status,
            "questions_count": questions_count,
            "has_submitted": submission is not None and submission.status in ["submitted", "auto_submitted"],
            "submission_score": submission.score if submission else None,
            "submission_percentage": submission.percentage if submission else None,
            "submission_id": submission.id if submission else None,
            "credentials": {
                "username": cred.username,
                "password": cred.password,
                "expires_at": cred.expires_at.isoformat()
            } if cred else None
        })
        
    return results
