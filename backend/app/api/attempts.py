import json
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.database import get_db, SessionLocal
from app.models.exam import Exam, ExamCredential, ExamSubmission, ProctoringLog
from app.schemas.exam import ExamLogin, SubmitExam, ProctorLogCreate
from app.services.ai_service import AIService
from jose import jwt
from app.config import settings

router = APIRouter(prefix="/attempts", tags=["attempts"])
ai_service = AIService()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # exam_id -> list of teacher connections
        
    async def connect_teacher(self, exam_id: str, websocket: WebSocket):
        await websocket.accept()
        if exam_id not in self.active_connections:
            self.active_connections[exam_id] = []
        self.active_connections[exam_id].append(websocket)
        
    def disconnect_teacher(self, exam_id: str, websocket: WebSocket):
        if exam_id in self.active_connections:
            try:
                self.active_connections[exam_id].remove(websocket)
            except ValueError:
                pass
                
    async def broadcast_proctor_alert(self, exam_id: str, message: dict):
        if exam_id in self.active_connections:
            for connection in self.active_connections[exam_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

def get_submission_by_token(token: str, db: Session) -> ExamSubmission:
    """Helper to validate student exam session token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        sub_id = payload.get("sub")
        token_type = payload.get("type")
        if not sub_id or token_type != "exam_session":
            raise HTTPException(status_code=401, detail="Invalid exam session")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid exam session")
        
    submission = db.query(ExamSubmission).filter(ExamSubmission.id == sub_id).first()
    if not submission:
        raise HTTPException(status_code=401, detail="Exam session not found")
        
    # Check if credentials expired
    if datetime.utcnow() > submission.credential.expires_at:
        raise HTTPException(status_code=403, detail="Exam credentials expired")
        
    return submission

@router.get("/exam-status")
def get_exam_status(exam_code: str, db: Session = Depends(get_db)):
    """
    Public endpoint (no auth) that returns the exam's scheduling status.
    Used by the frontend to show a pre-exam countdown waiting room.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code, Exam.is_published == True).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found or not published")
    
    now = datetime.utcnow()
    
    if now < exam.start_time:
        status = "not_started"
        seconds_until_start = int((exam.start_time - now).total_seconds())
    elif now > exam.end_time:
        status = "ended"
        seconds_until_start = 0
    else:
        status = "active"
        seconds_until_start = 0
    
    return {
        "exam_name": exam.name,
        "exam_code": exam.exam_code,
        "status": status,
        "start_time": exam.start_time.isoformat(),
        "end_time": exam.end_time.isoformat(),
        "duration_minutes": exam.duration_minutes,
        "server_time": now.isoformat(),
        "seconds_until_start": seconds_until_start
    }

@router.post("/login")
def login_student(login_in: ExamLogin, exam_code: str, db: Session = Depends(get_db)):
    """
    Validates a student session login at /exam/{exam_code}
    and issues an active session token.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code, Exam.is_published == True).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not active or invalid code")
        
    # Verify timeframe
    now = datetime.utcnow()
    if now < exam.start_time:
        raise HTTPException(status_code=400, detail=f"Exam has not started yet. Opens at {exam.start_time}")
    if now > exam.end_time:
        raise HTTPException(status_code=400, detail="Exam has already ended")
        
    cred = db.query(ExamCredential).filter(
        ExamCredential.exam_id == exam.id,
        ExamCredential.username == login_in.username,
        ExamCredential.password == login_in.password
    ).first()
    
    if not cred:
        raise HTTPException(status_code=400, detail="Incorrect credentials for this exam")
        
    sub = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred.id).first()
    
    # Issue exam token
    token_expire = exam.end_time
    if sub:
        payload = {"sub": sub.id, "exp": token_expire, "type": "exam_session"}
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    else:
        sub = ExamSubmission(
            exam_id=exam.id,
            credential_id=cred.id,
            status="started"
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        payload = {"sub": sub.id, "exp": token_expire, "type": "exam_session"}
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    is_completed = sub.status in ["submitted", "auto_submitted"]
    
    return {
        "session_token": token,
        "student_name": cred.student.user.full_name if (cred.student and cred.student.user) else "Guest Student",
        "duration_minutes": exam.duration_minutes,
        "is_completed": is_completed,
        "submission_id": sub.id,
        "score": sub.score,
        "percentage": sub.percentage
    }

@router.get("/exam-info")
def get_exam_info(token: str, db: Session = Depends(get_db)):
    """Fetches details of the exam and the questions checklist or completed submission review."""
    sub = get_submission_by_token(token, db)
    exam = sub.exam
    
    is_completed = sub.status in ["submitted", "auto_submitted"]
    evaluated_answers = json.loads(sub.answers_json) if (is_completed and sub.answers_json) else {}
    
    # Strip answers from questions payload before serving to student if in active exam!
    questions = json.loads(exam.questions_json) if exam.questions_json else []
    student_questions = []
    for q in questions:
        student_questions.append({
            "id": q["id"],
            "question_text": q["question_text"],
            "question_type": q["question_type"],
            "options": q.get("options"),
            "marks": q.get("marks", 1)
        })
        
    settings_dict = json.loads(exam.settings_json) if exam.settings_json else {}
    
    # Fetch existing progress
    saved_answers = json.loads(sub.answers_json) if (not is_completed and sub.answers_json) else {}
    
    # Compute correct time remaining:
    now = datetime.utcnow()
    from datetime import timedelta
    time_until_exam_ends = max(0, int((exam.end_time - now).total_seconds()))
    student_personal_deadline = sub.started_at + timedelta(minutes=exam.duration_minutes)
    time_until_personal_deadline = max(0, int((student_personal_deadline - now).total_seconds()))
    time_remaining = min(time_until_exam_ends, time_until_personal_deadline)
    
    return {
        "exam_name": exam.name,
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "questions": student_questions,
        "settings": settings_dict,
        "saved_answers": saved_answers,
        "time_remaining_seconds": time_remaining,
        "is_completed": is_completed,
        "submission_id": sub.id,
        "score": sub.score,
        "percentage": sub.percentage,
        "evaluated_answers": evaluated_answers
    }

@router.post("/save-progress")
def save_progress(token: str, progress: Dict[str, Any], db: Session = Depends(get_db)):
    """Persists responses dynamically; auto-submits if schedule window has ended."""
    sub = get_submission_by_token(token, db)
    if sub.status in ["submitted", "auto_submitted"]:
        raise HTTPException(status_code=400, detail="Cannot save progress on submitted exam")
        
    now = datetime.utcnow()
    if sub.exam and sub.exam.end_time and now > sub.exam.end_time:
        sub.answers_json = json.dumps(progress)
        db.commit()
        return submit_exam(token, db)

    sub.answers_json = json.dumps(progress)
    db.add(sub)
    db.commit()
    return {"message": "Progress auto-saved."}

@router.post("/proctor-alert")
def proctor_alert(token: str, alert: ProctorLogCreate, db: Session = Depends(get_db)):
    """Logs proctoring incidents (tab switches, resizing, dev tools, copy/paste)."""
    sub = get_submission_by_token(token, db)
    log = ProctoringLog(
        submission_id=sub.id,
        event_type=alert.event_type,
        event_details=alert.event_details
    )
    db.add(log)
    db.commit()
    return {"message": "Proctor event logged."}

@router.post("/submit")
def submit_exam(token: str, db: Session = Depends(get_db)):
    """
    Submits the exam, scores objective questions instantly,
    runs Gemini AI Subjective evaluations against rubrics, and finalizes results.
    """
    sub = get_submission_by_token(token, db)
    if sub.status in ["submitted", "auto_submitted"]:
        raise HTTPException(status_code=400, detail="Exam already submitted")
        
    exam = sub.exam
    original_questions = json.loads(exam.questions_json)
    student_responses = json.loads(sub.answers_json) if sub.answers_json else {}
    
    total_score = 0.0
    evaluated_responses = {}
    
    # 1. Evaluate responses question-by-question
    for q in original_questions:
        q_id = q["id"]
        q_type = q["question_type"]
        correct_ans = q["correct_answer"]
        marks = float(q.get("marks", 1.0))
        student_ans = student_responses.get(q_id)
        
        is_correct = False
        score_awarded = 0.0
        ai_critique = None
        
        if student_ans is not None and str(student_ans).strip() != "":
            # Objective scoring
            if q_type in ["mcq", "true_false", "numerical", "fill_blank", "arrange_order"]:
                # Normalizing spaces and case for robust matching
                if str(student_ans).strip().lower() == str(correct_ans).strip().lower():
                    is_correct = True
                    score_awarded = marks
                else:
                    # Apply negative marking
                    score_awarded = -float(exam.negative_marking) * marks
            
            # Subjective scoring using AI Service
            elif q_type in ["short_answer", "long_answer", "subjective"]:
                try:
                    # Call Gemini
                    ai_grade = ai_service.evaluate_subjective_answer(
                        question_text=q["question_text"],
                        student_answer=str(student_ans),
                        correct_rubric=correct_ans # holds model guidelines
                    )
                    score_awarded = (float(ai_grade.get("score", 2.5)) / 5.0) * marks
                    ai_critique = ai_grade.get("feedback")
                    is_correct = score_awarded >= (marks * 0.5) # pass threshold
                except Exception:
                    # Fallback score if service times out
                    score_awarded = marks * 0.5
                    ai_critique = "Grading fallback due to system timeout."
        else:
            student_ans = "Not Answered"
            is_correct = False
            score_awarded = 0.0
            ai_critique = None
            
        evaluated_responses[q_id] = {
            "question_text": q["question_text"],
            "selected_answer": student_ans,
            "correct_answer": correct_ans,
            "is_correct": is_correct,
            "score_awarded": score_awarded,
            "explanation": q.get("explanation"),
            "ai_feedback": ai_critique
        }
        total_score += score_awarded
            
    # 2. Finalize submission states
    sub.score = max(0.0, total_score) # prevent negative total marks
    sub.percentage = (sub.score / float(exam.total_marks)) * 100.0 if exam.total_marks > 0 else 0.0
    sub.status = "submitted"
    sub.submitted_at = datetime.utcnow()
    
    # Store evaluated results back in submission
    sub.answers_json = json.dumps(evaluated_responses)
    
    # Mark credential as used
    sub.credential.is_used = True
    
    db.add(sub)
    db.commit()
    
    return {
        "message": "Exam submitted successfully.",
        "submission_id": sub.id,
        "score": sub.score,
        "percentage": sub.percentage
    }

@router.websocket("/ws/teacher/{exam_id}")
async def websocket_teacher_endpoint(websocket: WebSocket, exam_id: str):
    await manager.connect_teacher(exam_id, websocket)
    try:
        while True:
            # Keep socket alive and receive heartbeats
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_teacher(exam_id, websocket)

@router.websocket("/ws/student/{submission_id}")
async def websocket_student_endpoint(websocket: WebSocket, submission_id: str):
    await websocket.accept()
    db: Session = SessionLocal() # Manual session lookup since WebSocket doesn't use Depends easily
    try:
        submission = db.query(ExamSubmission).filter(ExamSubmission.id == submission_id).first()
        if not submission:
            await websocket.close(code=1008)
            return
            
        while True:
            data = await websocket.receive_text()
            event = json.loads(data)
            
            # Log event to database
            log = ProctoringLog(
                submission_id=submission_id,
                event_type=event.get("event_type", "unknown"),
                event_details=event.get("event_details", "")
            )
            db.add(log)
            db.commit()
            
            # Broadcast alert to all active teacher connections!
            await manager.broadcast_proctor_alert(
                exam_id=submission.exam_id,
                message={
                    "student_name": submission.credential.student.user.full_name if submission.credential.student else "Guest Student",
                    "roll_number": submission.credential.student.roll_number if submission.credential.student else "",
                    "event_type": event.get("event_type"),
                    "event_details": event.get("event_details"),
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
    except WebSocketDisconnect:
        pass
    finally:
        db.close()
