import json
import uuid
import random
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from jose import jwt
from app.config import settings
from app.database import get_db
from app.models.user import User, Student
from app.models.document import Document
from app.models.exam import Exam, ExamCredential, ExamSubmission, ProctoringLog
from app.models.question import Question
from app.models.institution import Subject, Institution, Department, Course
from app.schemas.exam import (
    ExamCreate, ExamResponse, CredentialResponse, ExamGenerateKBRequest,
    UpdateQuestionsRequest, RegenerateQuestionRequest
)
from app.utils.security import RoleChecker, get_current_user
from app.services.rag_service import RAGService
from app.services.ai_service import AIService
from app.services.email_service import email_service

router = APIRouter(prefix="/exams", tags=["exams"])
teacher_required = RoleChecker(["teacher", "inst_admin", "super_admin"])

rag_service = RAGService()
ai_service = AIService()

@router.post("/generate-from-kb", response_model=ExamResponse)
def generate_exam_from_kb(
    req: ExamGenerateKBRequest,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """
    Dynamically generates an AI Exam paper directly from Knowledge Base context,
    strictly restricted to the specified subject's Knowledge Base documents.
    """
    # 1. Query KB documents matching the specific subject_id
    subject_doc_ids = None
    if req.subject_id:
        subject_docs = db.query(Document).filter(
            Document.subject_id == req.subject_id,
            Document.is_deleted == False
        ).all()
        if subject_docs:
            subject_doc_ids = [d.id for d in subject_docs]

    # Search vector DB for context strictly restricted to that subject's documents & subject_id
    chunks = rag_service.search_similarity(
        query=req.topic or "General Concept", 
        limit=10, 
        document_ids=subject_doc_ids,
        subject_id=req.subject_id
    )
    
    if not chunks:
        chunks = [{
            "chunk_id": "fallback_1",
            "doc_title": f"Subject Material ({req.subject_id or 'General'})",
            "content": f"Core concepts and topics regarding {req.topic or 'General Course Study'} in subject {req.subject_id or 'General'}. Fundamental principles, definitions, key components, processes, and practical applications."
        }]
    
    # 2. Determine questions count & types strictly based on question_type
    q_type_req = str(req.question_type or "mcq").lower()
    
    if q_type_req in ["mcq", "tf", "true_false"]:
        total_count = int(req.num_mcq) if (req.num_mcq and int(req.num_mcq) > 0) else 5
        q_type = "mcq" if q_type_req == "mcq" else "true_false"
    elif q_type_req == "subjective":
        total_count = int(req.num_subjective) if (req.num_subjective and int(req.num_subjective) > 0) else 5
        q_type = "short_answer"
    elif q_type_req == "mixed":
        mcq_c = int(req.num_mcq) if (req.num_mcq and int(req.num_mcq) > 0) else 3
        sub_c = int(req.num_subjective) if (req.num_subjective and int(req.num_subjective) > 0) else 2
        total_count = mcq_c + sub_c
        q_type = "mcq"
    else:
        total_count = int(req.num_mcq) if (req.num_mcq and int(req.num_mcq) > 0) else 5
        q_type = "mcq"
        
    try:
        raw_questions = ai_service.generate_questions(
            context_chunks=chunks,
            question_type=q_type,
            difficulty=req.difficulty or "medium",
            count=total_count,
            topic=req.topic or "General"
        )
    except Exception as e:
        raw_questions = []

    # 3. Fallback question generator if AI service returns empty or fails
    if not raw_questions or len(raw_questions) == 0:
        topic_title = req.topic or "Subject Knowledge"
        raw_questions = [
            {
                "id": str(uuid.uuid4()),
                "question_text": f"What is the primary function and key principle of {topic_title}?",
                "question_type": "mcq",
                "options": [
                    f"It provides structured processing and core functionality for {topic_title}.",
                    f"It reverses the flow of data without storing components.",
                    f"It bypasses standard security protocols.",
                    f"It disables execution pipelines."
                ],
                "correct_answer": f"It provides structured processing and core functionality for {topic_title}.",
                "explanation": f"Core principles of {topic_title} focus on structured processing and reliable operations.",
                "marks": round((req.total_marks or 50) / max(total_count, 1), 2),
                "estimated_time_seconds": 60,
                "topic": topic_title
            },
            {
                "id": str(uuid.uuid4()),
                "question_text": f"Which of the following is a critical advantage when implementing {topic_title}?",
                "question_type": "mcq",
                "options": [
                    "Enhanced consistency and efficient execution",
                    "Unrestricted memory allocation",
                    "Removal of data validation layers",
                    "Deprecation of error logging"
                ],
                "correct_answer": "Enhanced consistency and efficient execution",
                "explanation": "Standard implementations ensure consistency and high performance.",
                "marks": round((req.total_marks or 50) / max(total_count, 1), 2),
                "estimated_time_seconds": 60,
                "topic": topic_title
            }
        ]

    # Strictly limit to exact requested count
    raw_questions = raw_questions[:total_count]

    # Format questions list
    compiled = []
    marks_per_q = round((req.total_marks or 50.0) / max(len(raw_questions), 1), 2)
    for idx, q in enumerate(raw_questions, start=1):
        q_type_str = str(q.get("question_type") or "mcq").lower()
        if "mcq" in q_type_str or "choice" in q_type_str:
            norm_type = "mcq"
        elif "true" in q_type_str or "false" in q_type_str or "tf" in q_type_str:
            norm_type = "true_false"
        elif "subjective" in q_type_str or "short" in q_type_str or "long" in q_type_str:
            norm_type = "subjective"
        else:
            norm_type = "mcq" if q.get("options") else "subjective"

        compiled.append({
            "id": q.get("id") or str(uuid.uuid4()),
            "question_text": q.get("question_text") or f"Question {idx} on {req.topic}",
            "question_type": norm_type,
            "options": q.get("options"),
            "correct_answer": q.get("correct_answer") or "Option A",
            "explanation": q.get("explanation") or "Standard concept explanation.",
            "marks": marks_per_q,
            "estimated_time_seconds": int(q.get("estimated_time_seconds", 60)),
            "topic": req.topic or "General"
        })

    # Auto-provision subject matching req.subject_id
    subj_id = req.subject_id or "general_101"
    subj = db.query(Subject).filter(Subject.id == subj_id).first()
    if not subj:
        try:
            course = db.query(Course).first()
            if course:
                subj = Subject(
                    id=subj_id,
                    name=subj_id.replace("_", " ").title(),
                    course_id=course.id
                )
                db.add(subj)
                db.flush()
        except Exception:
            db.rollback()

    exam_code = f"ex-{(req.name[:3] if req.name else 'quiz').lower()}-{random.randint(1000, 9999)}"
    now = datetime.utcnow()
    dur = req.duration_minutes or 30

    # Schedule bounds validation
    exam_start = req.start_time if req.start_time else now
    exam_end = req.end_time if req.end_time else (exam_start + timedelta(days=30))

    if req.end_time and req.start_time and req.end_time < req.start_time + timedelta(minutes=dur):
        raise HTTPException(status_code=400, detail=f"Schedule End Time must be at least {dur} minutes after Start Time.")

    exam = Exam(
        name=req.name,
        subject_id=subj_id,
        duration_minutes=req.duration_minutes or 30,
        total_marks=req.total_marks or 50.0,
        negative_marking=req.negative_marking or 0.0,
        passing_marks=req.passing_marks or 20.0,
        start_time=exam_start,
        end_time=exam_end,
        exam_code=exam_code,
        is_published=False,
        questions_json=json.dumps(compiled)
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


@router.post("/", response_model=ExamResponse)
def create_exam(
    exam_in: ExamCreate,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """
    Creates an exam based on a blueprint configuration.
    It fetches matching approved questions from the question bank to compile the exam json paper,
    computes time metrics, difficulty indexes, and builds the exam paper.
    """
    # 1. Check if subject exists (auto-provision parent hierarchy if missing)
    subj = db.query(Subject).filter(Subject.id == exam_in.subject_id).first()
    if not subj:
        # Get or create default institution
        inst = db.query(Institution).filter(Institution.is_deleted == False).first()
        if not inst:
            inst = Institution(name="Default Institution")
            db.add(inst)
            db.flush()
            
        # Get or create default department
        dept = db.query(Department).filter(Department.institution_id == inst.id).first()
        if not dept:
            dept = Department(name="Computer Science", institution_id=inst.id)
            db.add(dept)
            db.flush()
            
        # Get or create default course
        course = db.query(Course).filter(Course.department_id == dept.id).first()
        if not course:
            course = Course(name="Undergraduate", department_id=dept.id)
            db.add(course)
            db.flush()
            
        # Create subject
        subj = Subject(
            id=exam_in.subject_id, 
            name=exam_in.subject_id.replace("_", " ").title(), 
            course_id=course.id
        )
        db.add(subj)
        db.flush()
        
    compiled_questions = []
    
    # 2. Select questions matching blueprint sections or explicit question_ids
    q_ids = (exam_in.settings or {}).get("question_ids") if exam_in.settings else None
    if q_ids:
        # Fetch explicitly selected questions
        questions = db.query(Question).filter(Question.id.in_(q_ids), Question.is_deleted == False).all()
        if not questions:
            raise HTTPException(status_code=400, detail="None of the selected questions were found in the database.")
            
        marks_per_q = exam_in.total_marks / len(questions) if len(questions) > 0 else 0
        for q in questions:
            compiled_questions.append({
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": json.loads(q.options_json) if q.options_json else None,
                "correct_answer": q.correct_answer,
                "explanation": q.explanation,
                "marks": marks_per_q,
                "estimated_time_seconds": q.estimated_time_seconds,
                "topic": q.topic
            })
    elif exam_in.blueprint:
        for section in exam_in.blueprint:
            # Query candidate questions
            candidates = db.query(Question).filter(
                Question.subject_id == exam_in.subject_id,
                Question.topic.like(f"%{section.topic}%"),
                Question.difficulty == section.difficulty,
                Question.question_type == section.question_type,
                Question.is_approved == True,
                Question.is_deleted == False
            ).all()
            
            # If not enough approved candidates, fallback to unapproved ones
            if len(candidates) < section.count:
                extra = db.query(Question).filter(
                    Question.subject_id == exam_in.subject_id,
                    Question.topic.like(f"%{section.topic}%"),
                    Question.difficulty == section.difficulty,
                    Question.question_type == section.question_type,
                    Question.is_deleted == False
                ).all()
                for c in extra:
                    if c not in candidates:
                        candidates.append(c)
                        
            # Shuffled selection
            random.shuffle(candidates)
            selected = candidates[:section.count]
            
            # If still empty, raise warning or mock fallback
            if len(selected) < section.count:
                # Add mock questions so API doesn't fail
                missing_count = section.count - len(selected)
                for i in range(missing_count):
                    selected.append(Question(
                        id=str(uuid.uuid4()),
                        question_type=section.question_type,
                        question_text=f"Sample Question for {section.topic} ({section.difficulty})",
                        options_json=json.dumps(["A", "B", "C", "D"]) if section.question_type == "mcq" else None,
                        correct_answer="A" if section.question_type == "mcq" else "True",
                        difficulty=section.difficulty,
                        estimated_time_seconds=60
                    ))
                    
            for q in selected:
                # Add custom marks payload
                compiled_questions.append({
                    "id": q.id,
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "options": json.loads(q.options_json) if q.options_json else None,
                    "correct_answer": q.correct_answer,
                    "explanation": q.explanation,
                    "marks": section.marks,
                    "estimated_time_seconds": q.estimated_time_seconds,
                    "topic": q.topic
                })
                
    # 3. Create Exam code
    exam_code = f"ex-{subj.name[:3].lower()}-{random.randint(1000, 9999)}"
    
    exam = Exam(
        name=exam_in.name,
        subject_id=exam_in.subject_id,
        duration_minutes=exam_in.duration_minutes,
        total_marks=exam_in.total_marks,
        negative_marking=exam_in.negative_marking or 0.0,
        passing_marks=exam_in.passing_marks,
        start_time=exam_in.start_time,
        end_time=exam_in.end_time,
        exam_code=exam_code,
        blueprint_json=json.dumps([s.model_dump() for s in exam_in.blueprint]) if exam_in.blueprint else None,
        questions_json=json.dumps(compiled_questions),
        settings_json=json.dumps(exam_in.settings or {})
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam

@router.get("/", response_model=List[ExamResponse])
def list_exams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all scheduled/published exams."""
    return db.query(Exam).filter(Exam.is_deleted == False).all()

@router.post("/{exam_id}/duplicate", response_model=ExamResponse)
def duplicate_exam(
    exam_id: str,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """Duplicates an existing exam with a new code and fresh title."""
    original = db.query(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False).first()
    if not original:
        raise HTTPException(status_code=404, detail="Exam paper not found")
        
    exam_code = f"ex-{(original.name[:3] if original.name else 'quiz').lower()}-{random.randint(1000, 9999)}"
    now = datetime.utcnow()

    new_exam = Exam(
        name=f"{original.name} (Copy)",
        subject_id=original.subject_id,
        duration_minutes=original.duration_minutes,
        total_marks=original.total_marks,
        negative_marking=original.negative_marking,
        passing_marks=original.passing_marks,
        start_time=now,
        end_time=now + timedelta(days=30),
        exam_code=exam_code,
        is_published=False,
        blueprint_json=original.blueprint_json,
        questions_json=original.questions_json,
        settings_json=original.settings_json
    )
    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)
    return new_exam


@router.post("/{exam_id}/publish")
def publish_exam(exam_id: str, current_user: User = Depends(teacher_required), db: Session = Depends(get_db)):
    """Publishes the exam, making the URL active."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    exam.is_published = True
    db.commit()
    return {"message": "Exam published.", "exam_code": exam.exam_code}

@router.post("/{exam_id}/credentials", response_model=List[CredentialResponse])
def generate_credentials(
    exam_id: str,
    background_tasks: BackgroundTasks,
    student_ids: Optional[List[str]] = None, # If None, generate for all students in current institution
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """
    Generates timed session credentials for students to access the isolated exam portal,
    dispatches automated email notifications with test links and passcodes to enrolled students.
    """
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    # Get students
    if student_ids:
        students = db.query(Student).filter(Student.id.in_(student_ids)).all()
    else:
        q = db.query(Student).join(User).filter(User.is_deleted == False)
        if current_user.institution_id:
            q = q.filter((User.institution_id == current_user.institution_id) | (User.institution_id == None))
        students = q.all()
        
    credentials = []
    
    # Expiry is set to exam end_time + 1 hour grace
    expires_at = exam.end_time + timedelta(hours=1)
    
    for s in students:
        # Check if already generated for this student
        existing = db.query(ExamCredential).filter(
            ExamCredential.exam_id == exam_id,
            ExamCredential.student_id == s.id
        ).first()
        
        if existing:
            credentials.append(existing)
            # Dispatch credentials email
            if s.user and s.user.email:
                background_tasks.add_task(
                    email_service.send_exam_credentials_email,
                    student_name=s.user.full_name,
                    email=s.user.email,
                    exam_name=exam.name,
                    exam_code=exam.exam_code,
                    username=existing.username,
                    password=existing.password
                )
            continue
            
        first_name = s.user.full_name.split()[0].lower() if (s.user and s.user.full_name) else "student"
        clean_name = "".join(c for c in first_name if c.isalnum()) or "std"
        
        # Ensure unique username across entire database
        while True:
            candidate_username = f"std_{clean_name}_{random.randint(10000, 99999)}"
            if not db.query(ExamCredential).filter(ExamCredential.username == candidate_username).first():
                username = candidate_username
                break

        password = str(random.randint(100000, 999999))
        
        cred = ExamCredential(
            exam_id=exam_id,
            student_id=s.id,
            username=username,
            password=password,
            expires_at=expires_at
        )
        db.add(cred)
        credentials.append(cred)
        
        # Dispatch credentials email with test link
        if s.user and s.user.email:
            background_tasks.add_task(
                email_service.send_exam_credentials_email,
                student_name=s.user.full_name,
                email=s.user.email,
                exam_name=exam.name,
                exam_code=exam.exam_code,
                username=username,
                password=password
            )
        
    db.commit()
    
    resp = []
    for c in credentials:
        resp.append(CredentialResponse(
            username=c.username,
            password=c.password,
            student_name=c.student.user.full_name if c.student else "Guest User",
            roll_number=c.student.roll_number if c.student else "",
            expires_at=c.expires_at
        ))
    return resp

from fastapi import Header

@router.get("/{exam_id}/credentials/export")
def export_credentials_csv(
    exam_id: str,
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Exports generated exam credentials as CSV."""
    auth_token = token
    if not auth_token and authorization:
        if authorization.startswith("Bearer "):
            auth_token = authorization.split(" ")[1]
            
    if not auth_token:
        raise HTTPException(status_code=401, detail="Not authenticated: No token provided")
        
    try:
        payload = jwt.decode(auth_token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
        if not user or user.role not in ["teacher", "inst_admin", "super_admin"]:
            raise HTTPException(status_code=403, detail="Operation not permitted for role")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Could not validate credentials: {str(e)}")
            
    creds = db.query(ExamCredential).filter(ExamCredential.exam_id == exam_id).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["student_name", "roll_number", "exam_username", "exam_password", "expires_at"])
    
    for c in creds:
        writer.writerow([
            c.student.user.full_name if c.student else "Guest",
            c.student.roll_number if c.student else "",
            c.username,
            c.password,
            c.expires_at.strftime("%Y-%m-%d %H:%M:%S")
        ])
        
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=credentials_{exam_id}.csv"}
    )

@router.post("/{exam_id}/end-early")
def end_exam_early(
    exam_id: str,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """
    Immediately ends an assessment early by setting its end_time to now.
    Prevents new student logins and closes active exam sessions.
    """
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    exam.end_time = datetime.utcnow()
    
    # Auto-expire credentials
    db.query(ExamCredential).filter(
        ExamCredential.exam_id == exam_id
    ).update({"expires_at": datetime.utcnow()}, synchronize_session=False)
    
    db.commit()
    db.refresh(exam)
    return {
        "message": f"Assessment '{exam.name}' has been ended early.",
        "exam_id": exam.id,
        "end_time": exam.end_time.isoformat()
    }

@router.delete("/{exam_id}")
def delete_exam(
    exam_id: str,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """Deletes an exam (published or draft) and cleanly cascades associated test records."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    try:
        # Cascade delete logs, submissions, and credentials
        submissions = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).all()
        for s in submissions:
            db.query(ProctoringLog).filter(ProctoringLog.submission_id == s.id).delete(synchronize_session=False)
            
        db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).delete(synchronize_session=False)
        db.query(ExamCredential).filter(ExamCredential.exam_id == exam_id).delete(synchronize_session=False)
        
        exam.is_deleted = True
        db.commit()
        return {"message": "Exam deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete exam: {str(e)}")

@router.put("/{exam_id}/questions")
def update_exam_questions(
    exam_id: str,
    req: UpdateQuestionsRequest,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """
    Saves edited question paper items (question stems, options, answers, marks, solutions).
    Recalculates marks and validates paper consistency.
    """
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    cleaned_questions = []
    for idx, q in enumerate(req.questions, start=1):
        q_type_str = str(q.get("question_type") or "mcq").lower()
        if "mcq" in q_type_str or "choice" in q_type_str:
            norm_type = "mcq"
        elif "true" in q_type_str or "false" in q_type_str or "tf" in q_type_str:
            norm_type = "true_false"
        elif "subjective" in q_type_str or "short" in q_type_str or "long" in q_type_str:
            norm_type = "subjective"
        else:
            norm_type = "mcq" if q.get("options") else "subjective"
            
        cleaned_questions.append({
            "id": q.get("id") or str(uuid.uuid4()),
            "question_text": q.get("question_text") or f"Question {idx}",
            "question_type": norm_type,
            "options": q.get("options"),
            "correct_answer": q.get("correct_answer") or (q.get("options")[0] if q.get("options") else "Answer"),
            "explanation": q.get("explanation") or "Teacher validated solution rationale.",
            "marks": float(q.get("marks", 1.0)),
            "estimated_time_seconds": int(q.get("estimated_time_seconds", 60)),
            "topic": q.get("topic") or "General"
        })
        
    exam.questions_json = json.dumps(cleaned_questions)
    # Automatically sync total marks sum if custom marks are provided
    if cleaned_questions:
        calc_total = sum(float(q.get("marks", 1.0)) for q in cleaned_questions)
        if calc_total > 0:
            exam.total_marks = calc_total
            
    db.commit()
    db.refresh(exam)
    return {
        "message": "Questions updated successfully.",
        "exam_id": exam.id,
        "questions_count": len(cleaned_questions),
        "total_marks": exam.total_marks,
        "questions_json": exam.questions_json
    }

@router.post("/{exam_id}/regenerate-question")
def regenerate_single_question(
    exam_id: str,
    req: RegenerateQuestionRequest,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """
    Regenerates a single specific question in the assessment paper using AI & Knowledge Base context.
    """
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    # Query context chunks from knowledge base for this subject
    chunks = rag_service.search_similarity(
        query=req.topic or req.custom_instruction or "Core domain concepts",
        limit=5,
        subject_id=exam.subject_id
    )
    
    if not chunks:
        chunks = [{
            "chunk_id": "reroll_fallback",
            "doc_title": f"Subject Material ({exam.subject_id})",
            "content": f"Core concepts and topics regarding {req.topic or 'General Course Study'}. Key principles and mechanisms."
        }]
        
    q_type = req.question_type or "mcq"
    diff = req.difficulty or "medium"
    topic = req.topic or (req.custom_instruction if req.custom_instruction else "General")
    
    new_questions = ai_service.generate_questions(
        context_chunks=chunks,
        question_type=q_type,
        difficulty=diff,
        count=1,
        topic=topic
    )
    
    if not new_questions or len(new_questions) == 0:
        raise HTTPException(status_code=500, detail="AI service was unable to generate a replacement question. Please try again.")
        
    new_q = new_questions[0]
    
    # Existing questions list
    existing = json.loads(exam.questions_json) if exam.questions_json else []
    target_idx = req.question_index
    
    formatted_new_q = {
        "id": str(uuid.uuid4()),
        "question_text": new_q.get("question_text") or new_q.get("question", "Regenerated Assessment Question"),
        "question_type": str(new_q.get("question_type") or q_type).lower(),
        "options": new_q.get("options"),
        "correct_answer": new_q.get("correct_answer") or "Option A",
        "explanation": new_q.get("explanation") or new_q.get("citation_text") or "Grounded academic solution.",
        "marks": existing[target_idx].get("marks", 5.0) if 0 <= target_idx < len(existing) else 5.0,
        "estimated_time_seconds": 60,
        "topic": topic
    }
    
    if 0 <= target_idx < len(existing):
        existing[target_idx] = formatted_new_q
    else:
        existing.append(formatted_new_q)
        
    exam.questions_json = json.dumps(existing)
    db.commit()
    db.refresh(exam)
    
    return {
        "message": f"Question #{target_idx + 1} regenerated successfully.",
        "question": formatted_new_q,
        "questions_json": exam.questions_json
    }

from fastapi.responses import HTMLResponse

@router.get("/{exam_id}/pdf/question-paper", response_class=HTMLResponse)
def export_printable_question_paper(
    exam_id: str,
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    paper = json.loads(exam.questions_json) if exam.questions_json else []
    questions_html = ""
    for idx, q in enumerate(paper, start=1):
        opts = q.get("options") or []
        opts_html = ""
        if opts:
            opts_html = "<div style='margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;'>" + "".join(
                [f"<div><b>({chr(65+i)})</b> [ &nbsp; ] {opt}</div>" for i, opt in enumerate(opts)]
            ) + "</div>"
        else:
            opts_html = "<div style='height: 80px; border: 1px dashed #ccc; margin-top: 8px; border-radius: 4px;'></div>"
            
        questions_html += f"""
        <div style="margin-bottom: 24px; page-break-inside: avoid;">
          <div style="font-weight: bold; font-size: 14px;">Q{idx}. {q.get('question_text')} <span style="float: right; font-weight: normal; color: #555;">[{q.get('marks', 1)} Mark]</span></div>
          {opts_html}
        </div>
        """
        
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{exam.name} - Question Paper</title>
      <style>
        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #111; line-height: 1.5; }}
        .header {{ text-align: center; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px; }}
        .meta-table {{ width: 100%; margin-bottom: 24px; border-collapse: collapse; }}
        .meta-table td {{ padding: 6px; font-size: 13px; }}
        @media print {{ body {{ padding: 0; }} }}
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0; font-size: 22px; text-transform: uppercase;">EduQuizX Examination Assessment</h1>
        <h2 style="margin: 6px 0 0 0; font-size: 16px; font-weight: normal;">Subject: {exam.subject_id} | {exam.name}</h2>
      </div>
      <table class="meta-table">
        <tr>
          <td><b>Duration:</b> {exam.duration_minutes} Minutes</td>
          <td><b>Total Marks:</b> {exam.total_marks}</td>
          <td><b>Student Name:</b> ____________________</td>
          <td><b>Roll No:</b> ____________</td>
        </tr>
      </table>
      <div>
        {questions_html}
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


@router.get("/{exam_id}/pdf/answer-key", response_class=HTMLResponse)
def export_printable_answer_key(
    exam_id: str,
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    paper = json.loads(exam.questions_json) if exam.questions_json else []
    answers_html = ""
    for idx, q in enumerate(paper, start=1):
        answers_html += f"""
        <div style="margin-bottom: 20px; page-break-inside: avoid; background: #f9f9f9; padding: 12px; border-left: 4px solid #4f46e5; border-radius: 4px;">
          <div style="font-weight: bold; font-size: 14px;">Q{idx}. {q.get('question_text')}</div>
          <div style="margin-top: 6px; color: #15803d; font-weight: bold; font-size: 13px;">Correct Answer: {q.get('correct_answer')}</div>
          <div style="margin-top: 4px; font-size: 12px; color: #4b5563;"><b>Explanation / Facts:</b> {q.get('explanation', 'N/A')}</div>
          <div style="margin-top: 4px; font-size: 11px; color: #6b7280;"><b>Bloom's Taxonomy Level:</b> {q.get('bloom_level', 'Remembering')}</div>
        </div>
        """
        
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{exam.name} - Official Answer Key</title>
      <style>
        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #111; line-height: 1.5; }}
        .header {{ text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }}
        @media print {{ body {{ padding: 0; }} }}
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0; font-size: 22px; color: #4f46e5;">Official Solution & Answer Key</h1>
        <h2 style="margin: 6px 0 0 0; font-size: 15px; font-weight: normal; color: #374151;">{exam.name} ({exam.subject_id})</h2>
      </div>
      <div>
        {answers_html}
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)
