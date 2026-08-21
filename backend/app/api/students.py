import uuid
import json
import io
import csv
import secrets
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, BackgroundTasks, Query
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

class BulkStudentActionRequest(BaseModel):
    student_ids: List[str]

from app.models.academic import StudentCohortMembership

@router.get("/")
def list_students(
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db),
    department_id: Optional[str] = None,
    division: Optional[str] = None,
    cohort_id: Optional[str] = None,
    search: Optional[str] = None,
    page: Optional[int] = None,
    page_size: int = Query(50, le=200)
):
    """Lists all students with server-side search, filtering and pagination."""
    query = db.query(Student).join(User).filter(
        User.is_deleted == False
    )
    if current_user.institution_id:
        query = query.filter(User.institution_id == current_user.institution_id)
        
    if department_id:
        query = query.filter(Student.department_id == department_id)
    if division:
        query = query.filter(Student.division == division)
    if cohort_id:
        student_ids_subquery = db.query(StudentCohortMembership.student_id).filter(
            StudentCohortMembership.cohort_id == cohort_id,
            StudentCohortMembership.is_current == True
        )
        query = query.filter(Student.id.in_(student_ids_subquery))
    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter(
            (User.full_name.ilike(s_term)) | 
            (User.email.ilike(s_term)) | 
            (Student.roll_number.ilike(s_term))
        )

    total_count = query.count()

    if page is not None and page > 0:
        offset = (page - 1) * page_size
        students = query.order_by(Student.roll_number).offset(offset).limit(page_size).all()
    else:
        students = query.order_by(Student.roll_number).all()

    resp = []
    for s in students:
        dept = db.query(Department).filter(Department.id == s.department_id).first() if s.department_id else None
        v_token = s.user.verification_token if (s.user and s.user.verification_token) else None
        v_url = f"{settings.FRONTEND_URL}/verify-student?token={v_token}" if v_token else None
        resp.append({
            "id": s.id,
            "email": s.user.email,
            "full_name": s.user.full_name,
            "roll_number": s.roll_number,
            "department_name": dept.name if dept else None,
            "division": s.division,
            "batch": s.batch,
            "status": s.status,
            "is_verified": s.user.is_verified if (s.user and s.user.is_verified is not None) else True,
            "verification_token": v_token,
            "verification_url": v_url
        })

    if page is not None and page > 0:
        import math
        return {
            "items": resp,
            "page": page,
            "page_size": page_size,
            "total": total_count,
            "total_pages": math.ceil(total_count / page_size) if page_size > 0 else 1
        }

    return resp

@router.post("", response_model=StudentResponse)
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
    
    background_tasks.add_task(
        email_service.send_student_authorization_email,
        student_name=str(user.full_name),
        email=str(user.email),
        verification_token=str(verification_token),
        roll_number=str(student.roll_number) if student.roll_number else None
    )
    
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
        
    background_tasks.add_task(
        email_service.send_student_authorization_email,
        student_name=str(student.user.full_name),
        email=str(student.user.email),
        verification_token=str(student.user.verification_token),
        roll_number=str(student.roll_number) if student.roll_number else None
    )
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

            background_tasks.add_task(
                email_service.send_student_authorization_email,
                student_name=str(full_name),
                email=str(email),
                verification_token=str(verification_token),
                roll_number=str(roll_number) if roll_number else None
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
    
    is_teacher = current_user.role in ["teacher", "inst_admin", "super_admin"]
    
    # Fetch all published exams (or teacher's exams if teacher previewing)
    if is_teacher:
        exams = db.query(Exam).filter(
            Exam.is_deleted == False
        ).order_by(Exam.created_at.desc()).all()
    else:
        exams = db.query(Exam).filter(
            Exam.is_published == True,
            Exam.is_deleted == False
        ).order_by(Exam.start_time.desc()).all()
    
    student = db.query(Student).filter(
        (Student.user_id == current_user.id) |
        (Student.user.has(User.email == current_user.email))
    ).first()
    
    if not student and current_user.role == "student":
        import secrets
        prefix = "".join(c for c in current_user.email.split("@")[0].upper() if c.isalnum())[:8] or "STU"
        roll = f"STU-{prefix}-{secrets.token_hex(2).upper()}"
        student = Student(
            user_id=current_user.id,
            institution_id=current_user.institution_id,
            roll_number=roll,
            status="active"
        )
        db.add(student)
        db.commit()
        db.refresh(student)
    
    results = []
    for exam in exams:
        # Check selective targeting
        if student and exam.settings_json:
            try:
                s_cfg = json.loads(exam.settings_json)
                target_dept_ids = s_cfg.get("target_department_ids") or []
                target_divisions = s_cfg.get("target_divisions") or []
                if target_dept_ids and student.department_id not in target_dept_ids:
                    continue
                if target_divisions and student.division not in target_divisions:
                    continue
            except Exception:
                pass

        cred = None
        if student:
            cred = db.query(ExamCredential).filter(
                ExamCredential.exam_id == exam.id,
                ExamCredential.student_id == student.id
            ).first()
            if not cred and exam.is_published:
                import secrets
                clean_roll = "".join(c for c in (student.roll_number or current_user.email.split('@')[0]) if c.isalnum()).upper()[:16]
                cand_username = f"{clean_roll}-{exam.exam_code}"[:40]
                if db.query(ExamCredential).filter(ExamCredential.username == cand_username).first():
                    cand_username = f"{cand_username}-{secrets.token_hex(2).upper()}"
                cred = ExamCredential(
                    exam_id=exam.id,
                    student_id=student.id,
                    username=cand_username,
                    password=str(secrets.randbelow(900000) + 100000),
                    expires_at=exam.end_time or (datetime.utcnow() + timedelta(days=7))
                )
                db.add(cred)
                try:
                    db.commit()
                    db.refresh(cred)
                except Exception:
                    db.rollback()
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

@router.get("/csv-template")
def download_student_csv_template():
    """Generates and returns a downloadable sample CSV template for bulk student import."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["full_name", "email", "roll_number", "division", "batch", "department_name"])
    writer.writerow(["Alex Johnson", "alex.johnson@university.edu", "CS-2026-101", "A", "2026", "Computer Science"])
    writer.writerow(["Samantha Miller", "samantha.m@university.edu", "CS-2026-102", "A", "2026", "Computer Science"])
    writer.writerow(["David Chen", "david.chen@university.edu", "CS-2026-103", "B", "2026", "Computer Science"])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=eduquizx_student_roster_template.csv"}
    )

@router.post("/{student_id}/instant-authorize")
def instant_authorize_student(
    student_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db)
):
    """
    Directly activates a student account without waiting for email verification link,
    generating a secure password immediately and emailing it to the student.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    generated_pwd = f"std_{secrets.randbelow(900000) + 100000}"
    student.user.hashed_password = get_password_hash(generated_pwd)
    student.user.is_verified = True
    student.user.verification_token = None
    
    db.commit()
    db.refresh(student)
    
    # Send credentials email in background
    if student.user.email:
        background_tasks.add_task(
            email_service.send_student_credentials_email,
            student_name=student.user.full_name,
            email=student.user.email,
            password=generated_pwd
        )
        
    return {
        "status": "success",
        "message": f"Student '{student.user.full_name}' authorized successfully!",
        "generated_password": generated_pwd,
        "email": student.user.email,
        "student_id": student.id
    }

@router.post("/bulk-authorize")
def bulk_authorize_students(
    req: BulkStudentActionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db)
):
    """Activates multiple selected student accounts simultaneously."""
    students = db.query(Student).filter(Student.id.in_(req.student_ids)).all()
    count = 0
    
    for s in students:
        if s.user:
            gen_pwd = f"std_{secrets.randbelow(900000) + 100000}"
            s.user.hashed_password = get_password_hash(gen_pwd)
            s.user.is_verified = True
            s.user.verification_token = None
            count += 1
            
            if s.user.email:
                background_tasks.add_task(
                    email_service.send_student_credentials_email,
                    student_name=s.user.full_name,
                    email=s.user.email,
                    password=gen_pwd
                )
                
    db.commit()
    return {
        "status": "success",
        "message": f"Successfully authorized {count} student(s).",
        "authorized_count": count
    }

@router.post("/bulk-delete")
def bulk_delete_students(
    req: BulkStudentActionRequest,
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db)
):
    """Soft deletes multiple selected students."""
    students = db.query(Student).filter(Student.id.in_(req.student_ids)).all()
    count = 0
    for s in students:
        s.delete()
        if s.user:
            s.user.delete()
        count += 1
    db.commit()
    return {
        "status": "success",
        "message": f"Successfully deleted {count} student profile(s).",
        "deleted_count": count
    }

@router.get("/{student_id}/overview")
def get_student_overview(
    student_id: str,
    current_user: User = Depends(teacher_or_admin_required),
    db: Session = Depends(get_db)
):
    """Returns comprehensive profile overview, past test submissions, and assigned assessments for an individual student."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    dept = db.query(Department).filter(Department.id == student.department_id).first() if student.department_id else None
    
    # Submissions
    submissions = db.query(ExamSubmission).join(ExamCredential).filter(
        ExamCredential.student_id == student.id,
        ExamSubmission.is_deleted == False
    ).order_by(ExamSubmission.submitted_at.desc()).all()
    
    sub_list = []
    total_score_sum = 0
    total_marks_sum = 0
    
    for sub in submissions:
        exam = sub.exam
        total_score_sum += (sub.score or 0)
        total_marks_sum += (exam.total_marks if exam else 0)
        sub_list.append({
            "id": sub.id,
            "exam_name": exam.name if exam else "Assessment",
            "exam_code": exam.exam_code if exam else "",
            "score": sub.score,
            "total_marks": exam.total_marks if exam else 0,
            "percentage": sub.percentage,
            "status": sub.status,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "passed": sub.score >= exam.passing_marks if (exam and sub.score is not None) else False
        })
        
    avg_score = round((total_score_sum / total_marks_sum * 100), 1) if total_marks_sum > 0 else 0
    
    v_token = student.user.verification_token if (student.user and student.user.verification_token) else None
    v_url = f"{settings.FRONTEND_URL}/verify-student?token={v_token}" if v_token else None
    
    return {
        "student": {
            "id": student.id,
            "full_name": student.user.full_name if student.user else "Student",
            "email": student.user.email if student.user else "",
            "roll_number": student.roll_number,
            "department_name": dept.name if dept else "General",
            "division": student.division,
            "batch": student.batch,
            "is_verified": student.user.is_verified if student.user else True,
            "verification_url": v_url,
            "created_at": student.created_at.isoformat() if student.created_at else None
        },
        "stats": {
            "total_submissions": len(submissions),
            "average_percentage": avg_score,
            "passed_count": sum(1 for s in sub_list if s["passed"]),
        },
        "submissions": sub_list
    }
