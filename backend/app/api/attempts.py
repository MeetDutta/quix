import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query, Header, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from jose import jwt

from app.database import get_db, SessionLocal
from app.models.exam import Exam, ExamCredential, ExamSubmission, ProctoringLog
from app.models.candidate import ExamCandidate
from app.models.user import User, Student
from app.models.workspace import WorkspaceMember
from app.schemas.exam import ExamLogin, SubmitExam, ProctorLogCreate, ViolationReport
from app.services.ai_service import AIService
from app.services.notification_service import create_notification
from app.config import settings
from app.utils.security import RoleChecker, get_current_user
from app.utils.rate_limiter import rate_limit_dependency
from app.utils.timezone import (
    now_utc, to_utc_instant, to_iso_utc, to_ist, 
    format_ist, format_ist_time, format_ist_datetime
)
to_naive_utc = to_utc_instant

import asyncio


router = APIRouter(prefix="/attempts", tags=["attempts"])
teacher_required = RoleChecker(["teacher", "inst_admin", "super_admin"])
ai_service = AIService()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # exam_id -> list of teacher connections
        self._redis_client = None
        self._subscribed_channels = set()
        
    async def _get_redis(self):
        if self._redis_client is None and getattr(settings, "REDIS_URL", None):
            try:
                import redis.asyncio as aioredis
                self._redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            except Exception:
                self._redis_client = None
        return self._redis_client

    async def connect_teacher(self, exam_id: str, websocket: WebSocket):
        await websocket.accept()
        if exam_id not in self.active_connections:
            self.active_connections[exam_id] = []
        self.active_connections[exam_id].append(websocket)
        r = await self._get_redis()
        if r and exam_id not in self._subscribed_channels:
            self._subscribed_channels.add(exam_id)
            asyncio.create_task(self._listen_redis_channel(exam_id))

    async def _listen_redis_channel(self, exam_id: str):
        try:
            r = await self._get_redis()
            if not r:
                return
            pubsub = r.pubsub()
            await pubsub.subscribe(f"exam_events:{exam_id}")
            async for message in pubsub.listen():
                if message and message.get("type") == "message":
                    raw_data = message.get("data")
                    if raw_data:
                        try:
                            payload = json.loads(raw_data)
                            await self._deliver_locally(exam_id, payload)
                        except Exception:
                            pass
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

    async def _deliver_locally(self, exam_id: str, message: dict):
        if exam_id in self.active_connections:
            surviving = []
            for connection in self.active_connections[exam_id]:
                try:
                    await connection.send_json(message)
                    surviving.append(connection)
                except Exception:
                    pass
            self.active_connections[exam_id] = surviving
        
    def disconnect_teacher(self, exam_id: str, websocket: WebSocket):
        if exam_id in self.active_connections:
            try:
                self.active_connections[exam_id].remove(websocket)
            except ValueError:
                pass

    async def broadcast_event(self, exam_id: str, event_type: str, data: dict):
        payload = {
            "event_type": event_type,
            "exam_id": exam_id,
            "timestamp": to_iso_utc(now_utc()),
            **data
        }
        r = await self._get_redis()
        if r:
            try:
                await r.publish(f"exam_events:{exam_id}", json.dumps(payload))
            except Exception:
                await self._deliver_locally(exam_id, payload)
        else:
            await self._deliver_locally(exam_id, payload)
                
    async def broadcast_proctor_alert(self, exam_id: str, message: dict):
        await self.broadcast_event(exam_id, "PROCTOR_ALERT", message)

manager = ConnectionManager()

def resolve_exam_token(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
) -> str:
    auth_token = token
    if not auth_token and authorization:
        if authorization.startswith("Bearer "):
            auth_token = authorization.split(" ")[1]
        else:
            auth_token = authorization
    if not auth_token:
        raise HTTPException(status_code=401, detail="Exam session token required")
    return auth_token

def get_submission_by_token(token: str, db: Session) -> ExamSubmission:
    """Helper to validate student exam session token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        sub_id = payload.get("sub")
        token_type = payload.get("type")
        if not sub_id or token_type not in ["exam_session", "teacher_simulation"]:
            raise HTTPException(status_code=401, detail="Invalid exam session")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid exam session")
        
    if token_type == "teacher_simulation":
        # Create virtual submission wrapper for simulation
        exam_id = payload.get("exam_id")
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found for simulation")
        virtual_sub = ExamSubmission(
            id=sub_id,
            exam_id=exam.id,
            status="started",
            answers_json="{}"
        )
        virtual_sub.exam = exam
        return virtual_sub
        
    submission = db.query(ExamSubmission).filter(ExamSubmission.id == sub_id).first()
    if not submission:
        raise HTTPException(status_code=401, detail="Exam session not found")
        
    # Check if credentials expired
    if submission.credential and submission.credential.expires_at and now_utc() > to_utc_instant(submission.credential.expires_at):
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
    
    now = now_utc()
    exam_start = to_utc_instant(exam.start_time) or (now - timedelta(seconds=10))
    exam_end = to_utc_instant(exam.end_time) or (exam_start + timedelta(days=30))
    
    if now < exam_start:
        exam_status = "not_started"
        seconds_until_start = int((exam_start - now).total_seconds())
    elif now > exam_end:
        exam_status = "ended"
        seconds_until_start = 0
    else:
        exam_status = "active"
        seconds_until_start = 0
    
    return {
        "exam_name": exam.name,
        "exam_code": exam.exam_code,
        "status": exam_status,
        "start_time": to_iso_utc(exam_start),
        "end_time": to_iso_utc(exam_end),
        "start_time_ist": format_ist_datetime(exam_start),
        "end_time_ist": format_ist_datetime(exam_end),
        "duration_minutes": exam.duration_minutes,
        "server_time": to_iso_utc(now),
        "seconds_until_start": seconds_until_start
    }

@router.post("/login", dependencies=[Depends(rate_limit_dependency(max_requests=300, window_seconds=60))])
def login_student(login_in: ExamLogin, exam_code: str, db: Session = Depends(get_db)):
    """
    Validates a student session login at /exam/{exam_code}
    and issues an active session token.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code, Exam.is_published == True).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not active or invalid code")
        
    # Verify timeframe
    now = now_utc()
    exam_start = to_utc_instant(exam.start_time) or (now - timedelta(seconds=10))
    exam_end = to_utc_instant(exam.end_time) or (exam_start + timedelta(days=30))
    
    if now < exam_start:
        raise HTTPException(status_code=400, detail=f"Exam has not started yet. Opens at {format_ist_time(exam_start)}")
    if now > exam_end:
        raise HTTPException(status_code=400, detail="Exam has already ended")
        
    raw_uname = login_in.username.strip()
    raw_pass = login_in.password.strip()

    # 1. Match credential via username, email_snapshot, or roll_number_snapshot
    cred = db.query(ExamCredential).filter(
        ExamCredential.exam_id == exam.id,
        ExamCredential.password == raw_pass
    ).join(ExamCandidate, ExamCredential.candidate_id == ExamCandidate.id, isouter=True).filter(
        (ExamCredential.username == raw_uname) |
        (func.lower(ExamCandidate.email_snapshot) == raw_uname.lower()) |
        (ExamCandidate.roll_number_snapshot == raw_uname) |
        (ExamCredential.student.has(Student.user.has(func.lower(User.email) == raw_uname.lower()))) |
        (ExamCredential.student.has(Student.roll_number == raw_uname))
    ).first()
    
    access_mode = getattr(exam, "access_mode", "ENROLLED_ONLY") or "ENROLLED_ONLY"

    if not cred:
        # If exam is ENROLLED_ONLY, un-enrolled students cannot register on-the-fly with master passwords
        if access_mode != "OPEN_REGISTRATION":
            raise HTTPException(status_code=403, detail="You are not enrolled as an eligible candidate for this examination.")

        from app.utils.security import verify_password
        user = db.query(User).filter(func.lower(User.email) == raw_uname.lower(), User.is_deleted == False).first()
        if user and verify_password(raw_pass, user.hashed_password):
            student = db.query(Student).filter(Student.user_id == user.id, Student.is_deleted == False).first()
            if not student:
                import secrets
                prefix = "".join(c for c in user.email.split("@")[0].upper() if c.isalnum())[:8] or "STU"
                roll = f"STU-{prefix}-{secrets.token_hex(2).upper()}"
                student = Student(
                    user_id=user.id,
                    institution_id=user.institution_id,
                    roll_number=roll,
                    status="active"
                )
                db.add(student)
                db.commit()
                db.refresh(student)
            cred = db.query(ExamCredential).filter(
                ExamCredential.exam_id == exam.id,
                ExamCredential.student_id == student.id
            ).first()
            if not cred:
                import secrets
                clean_roll = "".join(c for c in (student.roll_number or user.email.split('@')[0]) if c.isalnum()).upper()[:16]
                cand_username = f"{clean_roll}-{exam.exam_code}"[:40]
                if db.query(ExamCredential).filter(ExamCredential.username == cand_username).first():
                    cand_username = f"{cand_username}-{secrets.token_hex(2).upper()}"
                cred = ExamCredential(
                    exam_id=exam.id,
                    student_id=student.id,
                    username=cand_username,
                    password=raw_pass,
                    expires_at=to_utc_instant(exam.end_time) or (now_utc() + timedelta(days=7))
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
        else:
            raise HTTPException(status_code=400, detail="Incorrect credentials for this exam. Please check your passcode or portal login.")
        
    cand = cred.candidate if cred else None
    if cred and not cand and cred.candidate_id:
        cand = db.query(ExamCandidate).filter(ExamCandidate.id == cred.candidate_id).first()

    cand_name = "Candidate"
    if cand:
        cand_name = cand.name_snapshot
    elif cred.student and cred.student.user:
        cand_name = cred.student.user.full_name
    elif cred:
        cand_name = cred.username

    exam_duration = exam.duration_minutes or 30
    allowed_end = to_naive_utc(exam.end_time) or (now + timedelta(minutes=exam_duration))
    deadline = min(now + timedelta(minutes=exam_duration), allowed_end)

    # Resolve or create single submission (respecting reattempt history)
    sub = None
    if cand:
        # First look for an active in-progress attempt
        sub = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.candidate_id == cand.id,
            ExamSubmission.status.in_(["started", "in_progress", "submitting"])
        ).order_by(ExamSubmission.attempt_number.desc()).first()
        # If no active attempt, select latest attempt overall
        if not sub:
            sub = db.query(ExamSubmission).filter(
                ExamSubmission.exam_id == exam.id,
                ExamSubmission.candidate_id == cand.id
            ).order_by(ExamSubmission.attempt_number.desc()).first()
    if not sub and cred:
        sub = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.credential_id == cred.id,
            ExamSubmission.status.in_(["started", "in_progress", "submitting"])
        ).order_by(ExamSubmission.attempt_number.desc()).first()
        if not sub:
            sub = db.query(ExamSubmission).filter(
                ExamSubmission.exam_id == exam.id,
                ExamSubmission.credential_id == cred.id
            ).order_by(ExamSubmission.attempt_number.desc()).first()

    if not sub:
        sub = ExamSubmission(
            exam_id=exam.id,
            candidate_id=cand.id if cand else None,
            credential_id=cred.id if cred else None,
            attempt_number=1,
            is_counted_for_result=True,
            status="started",
            started_at=now,
            deadline_at=deadline,
            last_seen_at=now,
            questions_snapshot_json=exam.questions_json,
            answer_version=0,
            grading_status="COMPLETED"
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
    else:
        if cand and not sub.candidate_id:
            sub.candidate_id = cand.id
        if not sub.deadline_at:
            sub.deadline_at = min((to_utc_instant(sub.started_at) or now) + timedelta(minutes=exam_duration), allowed_end)
        if not sub.questions_snapshot_json and exam.questions_json:
            sub.questions_snapshot_json = exam.questions_json
        sub.last_seen_at = now
        db.commit()

    # If already past deadline, mark auto_submitted immediately
    sub_deadline = to_utc_instant(sub.deadline_at)
    if sub.status in ["started", "in_progress", "submitting"] and sub_deadline and now >= sub_deadline:
        process_exam_submission(sub, db, auto_submitted=True)

    # Issue exam session token
    end_instant = to_utc_instant(exam.end_time) or (now + timedelta(days=30))
    token_expire = max(end_instant, now + timedelta(hours=6))
    payload = {"sub": sub.id, "exp": token_expire, "type": "exam_session"}
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    is_completed = sub.status in ["submitted", "auto_submitted", "graded"]
    questions_list = json.loads(exam.questions_json) if exam.questions_json else []

    return {
        "token": token,
        "session_token": token,
        "student_name": cand_name,
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "passing_marks": exam.passing_marks,
        "questions_count": len(questions_list),
        "is_completed": is_completed,
        "attempt_number": sub.attempt_number or 1,
        "is_reattempt": (sub.attempt_number or 1) > 1
    }

@router.get("/exam-info")
def get_exam_info(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Fetches details of the exam and the questions checklist or completed submission review."""
    actual_token = resolve_exam_token(token, authorization)
    sub = get_submission_by_token(actual_token, db)
    exam = sub.exam
    
    is_completed = sub.status in ["submitted", "auto_submitted"]
    evaluated_answers = json.loads(sub.answers_json) if (is_completed and sub.answers_json) else {}
    
    # Strip answers from questions payload before serving to student if in active exam!
    q_source = sub.questions_snapshot_json if sub.questions_snapshot_json else exam.questions_json
    questions = json.loads(q_source) if q_source else []
    settings_dict = json.loads(exam.settings_json) if exam.settings_json else {}

    student_questions = []
    for q in questions:
        opts = list(q.get("options")) if (q.get("options") and isinstance(q.get("options"), list)) else q.get("options")
        # Deterministic option shuffling per candidate if enabled
        if settings_dict.get("shuffle_options") and isinstance(opts, list):
            import random
            opt_rng = random.Random(f"{sub.id}_{q['id']}")
            opt_rng.shuffle(opts)

        student_questions.append({
            "id": q.get("id") or str(q.get("question_id", "q")),
            "question_text": q.get("question_text") or q.get("question", "Question"),
            "question_type": q.get("question_type") or q.get("type", "mcq"),
            "options": opts,
            "marks": q.get("marks", 1),
            "code_snippet": q.get("code_snippet"),
            "code_language": q.get("code_language")
        })

    # Deterministic question order shuffling per candidate if enabled
    if settings_dict.get("shuffle_questions") and student_questions:
        import random
        q_rng = random.Random(sub.id)
        q_rng.shuffle(student_questions)
    
    # Fetch existing progress
    raw_saved = json.loads(sub.answers_json) if (not is_completed and sub.answers_json) else {}
    saved_answers = {k: v for k, v in raw_saved.items() if k != "_meta"} if isinstance(raw_saved, dict) else {}
    
    # Compute authoritative time remaining based on personal deadline
    now = now_utc()
    exam_duration = exam.duration_minutes or 30
    allowed_end = to_utc_instant(exam.end_time) or (now + timedelta(minutes=exam_duration))
    sub_deadline = to_utc_instant(sub.deadline_at)
    deadline = sub_deadline or min((to_utc_instant(sub.started_at) or now) + timedelta(minutes=exam_duration), allowed_end)

    if sub.status in ["started", "in_progress", "submitting"] and now >= deadline:
        process_exam_submission(sub, db, auto_submitted=True)
        is_completed = True
        evaluated_answers = json.loads(sub.answers_json) if sub.answers_json else {}

    time_remaining = max(0, int((deadline - now).total_seconds())) if not is_completed else 0

    if not is_completed:
        sub.last_seen_at = now
        db.commit()
    
    return {
        "exam_name": exam.name,
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "questions": student_questions,
        "settings": settings_dict,
        "saved_answers": saved_answers,
        "time_remaining_seconds": time_remaining,
        "server_time": to_iso_utc(now),
        "deadline_at": to_iso_utc(deadline),
        "deadline_at_ist": format_ist_time(deadline),
        "start_time": to_iso_utc(exam.start_time),
        "end_time": to_iso_utc(exam.end_time),
        "start_time_ist": format_ist_datetime(exam.start_time),
        "end_time_ist": format_ist_datetime(exam.end_time),
        "is_completed": is_completed,
        "submission_id": sub.id,
        "score": sub.score,
        "percentage": sub.percentage,
        "evaluated_answers": evaluated_answers,
        "attempt_number": sub.attempt_number or 1,
        "is_counted_for_result": sub.is_counted_for_result if sub.is_counted_for_result is not None else True
    }

def process_exam_submission(sub: ExamSubmission, db: Session, auto_submitted: bool = False, auto_submit_reason: Optional[str] = None) -> dict:
    """Internal helper to process exam evaluation and submission with live broadcast."""
    exam = sub.exam
    q_source = sub.questions_snapshot_json if sub.questions_snapshot_json else exam.questions_json
    original_questions = json.loads(q_source) if q_source else []
    student_responses = json.loads(sub.answers_json) if sub.answers_json else {}
    
    total_score = 0.0
    evaluated_responses = {}
    has_pending_manual_review = False
    
    # 1. Evaluate responses question-by-question
    for q in original_questions:
        q_id = q.get("id") or str(q.get("question_id", "q"))
        q_type = q.get("question_type") or q.get("type") or "mcq"
        correct_ans = q.get("correct_answer") or ""
        marks = float(q.get("marks") or 1.0)
        student_ans = student_responses.get(q_id)
        
        is_correct = False
        score_awarded = 0.0
        ai_critique = None
        evaluation_status = "COMPLETED"
        
        if student_ans is not None and str(student_ans).strip() != "":
            # Objective scoring
            if q_type in ["mcq", "true_false", "numerical", "fill_blank", "arrange_order"]:
                # Normalizing spaces and case for robust matching
                if str(student_ans).strip().lower() == str(correct_ans).strip().lower():
                    is_correct = True
                    score_awarded = marks
                else:
                    # Apply negative marking
                    score_awarded = -float(exam.negative_marking or 0.0) * marks
                evaluation_status = "COMPLETED"
            
            # Subjective scoring using AI Service with retry policy
            elif q_type in ["short_answer", "long_answer", "subjective"]:
                ai_grade = None
                for attempt in range(2):
                    try:
                        ai_grade = ai_service.evaluate_subjective_answer(
                            question_text=q["question_text"],
                            student_answer=str(student_ans),
                            correct_rubric=correct_ans # holds model guidelines
                        )
                        if ai_grade and ai_grade.get("score") is not None:
                            break
                    except Exception:
                        pass

                if ai_grade and ai_grade.get("score") is not None:
                    raw_score = float(ai_grade["score"])
                    max_s = float(ai_grade.get("max_score", 5.0) or 5.0)
                    score_awarded = (raw_score / max_s) * marks
                    ai_critique = ai_grade.get("feedback")
                    is_correct = score_awarded >= (marks * 0.5)
                    evaluation_status = "COMPLETED"
                else:
                    # AI failure (429, timeout, network failure, 5xx, or quota) must NEVER penalize the student!
                    score_awarded = 0.0
                    is_correct = None
                    ai_critique = "Subjective evaluation pending instructor manual review (AI service unavailable)."
                    evaluation_status = "PENDING_MANUAL_REVIEW"
                    has_pending_manual_review = True
        else:
            student_ans = "Not Answered"
            is_correct = False
            score_awarded = 0.0
            ai_critique = None
            evaluation_status = "COMPLETED"
            
        evaluated_responses[q_id] = {
            "question_text": q["question_text"],
            "selected_answer": student_ans,
            "correct_answer": correct_ans,
            "is_correct": is_correct,
            "score_awarded": score_awarded,
            "evaluation_status": evaluation_status,
            "explanation": q.get("explanation"),
            "ai_feedback": ai_critique
        }
        total_score += score_awarded
            
    # Fallback to preserve student responses if exam had no pre-seeded question schema
    if not original_questions and student_responses:
        evaluated_responses = {
            k: {
                "question_text": k,
                "selected_answer": v,
                "correct_answer": None,
                "is_correct": True,
                "score_awarded": 1.0,
                "explanation": None,
                "ai_feedback": None
            }
            for k, v in student_responses.items() if k != "_meta"
        }

    # 2. Finalize submission states
    sub.score = max(0.0, total_score) # prevent negative total marks
    sub.percentage = (sub.score / float(exam.total_marks or 1.0)) * 100.0 if exam.total_marks else 0.0
    sub.status = "auto_submitted" if auto_submitted else "submitted"
    if auto_submitted:
        sub.auto_submit_reason = auto_submit_reason or sub.auto_submit_reason or "TAB_SWITCH"
    sub.grading_status = "PENDING_MANUAL_REVIEW" if has_pending_manual_review else "COMPLETED"
    sub.submitted_at = now_utc()
    sub.answers_json = json.dumps(evaluated_responses)
    
    # If simulation, return directly without DB writes
    if str(sub.id).startswith("sim_"):
        return {
            "status": sub.status,
            "grading_status": sub.grading_status,
            "auto_submit_reason": sub.auto_submit_reason,
            "message": "Teacher Preview Simulation evaluated successfully.",
            "submission_id": sub.id,
            "score": round(sub.score, 2),
            "total_marks": exam.total_marks,
            "percentage": round(sub.percentage, 1),
            "is_passed": sub.score >= float(exam.passing_marks or 0.0),
            "is_simulation": True,
            "has_pending_manual_review": has_pending_manual_review,
            "evaluated_answers": evaluated_responses
        }

    # Mark credential as used
    if sub.credential:
        sub.credential.is_used = True
    
    # Synchronize candidate status
    if sub.candidate:
        sub.candidate.status = "SUBMITTED"

    db.add(sub)
    db.commit()
    
    # Broadcast submission event to all connected teachers across workers
    cand_name = "Candidate"
    roll_no = ""
    if sub.candidate:
        cand_name = sub.candidate.name_snapshot
        roll_no = sub.candidate.roll_number_snapshot or ""
    elif sub.credential and sub.credential.student and sub.credential.student.user:
        cand_name = sub.credential.student.user.full_name
        roll_no = sub.credential.student.roll_number or ""

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            broadcast_type = "AUTO_SUBMITTED" if auto_submitted else "SUBMISSION_COMPLETED"
            violation_count = db.query(func.count(ProctoringLog.id)).filter(ProctoringLog.submission_id == sub.id).scalar() or 0
            asyncio.create_task(manager.broadcast_event(
                exam_id=sub.exam_id,
                event_type=broadcast_type,
                data={
                    "student_name": cand_name,
                    "roll_number": roll_no,
                    "status": "AUTO_SUBMITTED" if auto_submitted else "SUBMITTED",
                    "reason": sub.auto_submit_reason or ("TAB_SWITCH" if auto_submitted else "NORMAL"),
                    "violation_count": violation_count,
                    "grading_status": sub.grading_status,
                    "score": round(sub.score, 2),
                    "timestamp": to_iso_utc(sub.submitted_at or now_utc()),
                    "submitted_at_ist": format_ist_time(sub.submitted_at) if sub.submitted_at else format_ist_time(now_utc())
                }
            ))
    except Exception:
        pass

    # Notify student in-app
    if sub.credential and sub.credential.student and sub.credential.student.user_id:
        create_notification(
            db,
            user_id=sub.credential.student.user_id,
            title=f"Submission Received: {exam.name}",
            message=f"Your responses for '{exam.name}' have been recorded successfully.",
            notification_type="grade",
            link="/dashboard/student"
        )
    
    return {
        "status": sub.status,
        "grading_status": sub.grading_status,
        "auto_submit_reason": sub.auto_submit_reason,
        "message": "Exam submitted. Subjective answers pending instructor manual review." if has_pending_manual_review else "Exam submitted successfully.",
        "submission_id": sub.id,
        "score": round(sub.score, 2),
        "total_marks": exam.total_marks,
        "percentage": round(sub.percentage, 1),
        "is_passed": sub.score >= float(exam.passing_marks or 0.0),
        "has_pending_manual_review": has_pending_manual_review,
        "evaluated_answers": evaluated_responses
    }

@router.post("/teacher-preview")
def create_teacher_preview_session(
    exam_code: Optional[str] = None,
    exam_id: Optional[str] = None,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """
    Creates a temporary Sandbox Simulation session token for an instructor
    to test-run any assessment as a student without mutating real student stats.
    """
    query = db.query(Exam)
    if exam_id:
        exam = query.filter(Exam.id == exam_id).first()
    elif exam_code:
        exam = query.filter(Exam.exam_code == exam_code).first()
    else:
        raise HTTPException(status_code=400, detail="Must provide exam_id or exam_code")
        
    if not exam:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    token_expire = now_utc() + timedelta(hours=3)
    payload = {
        "sub": f"sim_{exam.id}",
        "exam_id": exam.id,
        "type": "teacher_simulation",
        "exp": token_expire
    }
    sim_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    
    questions = json.loads(exam.questions_json) if exam.questions_json else []
    
    return {
        "session_token": sim_token,
        "exam_name": exam.name,
        "exam_code": exam.exam_code,
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "passing_marks": exam.passing_marks,
        "student_name": f"Simulator ({current_user.full_name})",
        "is_simulation": True,
        "questions": questions
    }

@router.post("/direct-start")
def direct_start_for_student(
    exam_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allows an authenticated student to 1-click launch an assigned assessment
    without manually typing in their PIN.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code, Exam.is_published == True).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Assessment not active or invalid code")
        
    student = db.query(Student).filter(Student.user_id == current_user.id, Student.is_deleted == False).first()
    if not student:
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

    # 1. Resolve candidate for this exam
    cand = db.query(ExamCandidate).filter(
        ExamCandidate.exam_id == exam.id,
        (ExamCandidate.email_snapshot == current_user.email) |
        (ExamCandidate.roll_number_snapshot == student.roll_number)
    ).first()

    cred = db.query(ExamCredential).filter(
        ExamCredential.exam_id == exam.id,
        ExamCredential.student_id == student.id
    ).first()
    if not cred and cand and cand.credential:
        cred = cand.credential

    # 2. Strict Enrollment Gate:
    access_mode = getattr(exam, "access_mode", "ENROLLED_ONLY") or "ENROLLED_ONLY"
    if access_mode != "OPEN_REGISTRATION":
        # In ENROLLED_ONLY mode, a zero-candidate exam MUST NOT allow entry,
        # and un-enrolled students cannot dynamically enroll!
        has_enrolled_roster = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam.id).count() > 0
        if not has_enrolled_roster and not cand:
            raise HTTPException(status_code=403, detail="You are not enrolled as an eligible candidate for this examination.")
        
        if not cand and not cred:
            from app.services.eligibility_service import ExamEligibilityService
            eligible_students = ExamEligibilityService.resolve_students(db, exam.id)
            if not any(s.id == student.id for s in eligible_students):
                raise HTTPException(status_code=403, detail="You are not enrolled as an eligible candidate for this examination.")

    if not cred:
        if access_mode != "OPEN_REGISTRATION" and not cand:
            raise HTTPException(status_code=403, detail="You are not enrolled as an eligible candidate for this examination.")
        import secrets
        clean_roll = "".join(c for c in (student.roll_number or current_user.email.split('@')[0]) if c.isalnum()).upper()[:16]
        cand_username = f"{clean_roll}-{exam.exam_code}"[:40]
        if db.query(ExamCredential).filter(ExamCredential.username == cand_username).first():
            cand_username = f"{cand_username}-{secrets.token_hex(2).upper()}"
        cred = ExamCredential(
            exam_id=exam.id,
            candidate_id=cand.id if cand else None,
            student_id=student.id,
            username=cand_username,
            password=str(secrets.randbelow(900000) + 100000),
            expires_at=to_utc_instant(exam.end_time) or (now_utc() + timedelta(days=7))
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

    now = now_utc()
    exam_duration = exam.duration_minutes or 30
    allowed_end = to_utc_instant(exam.end_time) or (now + timedelta(minutes=exam_duration))
    deadline = min(now + timedelta(minutes=exam_duration), allowed_end)

    sub = None
    if cand:
        sub = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.candidate_id == cand.id
        ).first()
    if not sub:
        sub = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.credential_id == cred.id
        ).first()

    if not sub:
        sub = ExamSubmission(
            exam_id=exam.id,
            candidate_id=cand.id if cand else (cred.candidate_id if cred else None),
            credential_id=cred.id,
            status="started",
            started_at=now,
            deadline_at=deadline,
            last_seen_at=now,
            questions_snapshot_json=exam.questions_json,
            answer_version=0,
            grading_status="COMPLETED"
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
    else:
        if cand and not sub.candidate_id:
            sub.candidate_id = cand.id
        if not sub.deadline_at:
            sub.deadline_at = min((to_utc_instant(sub.started_at) or now) + timedelta(minutes=exam_duration), allowed_end)
        if not sub.questions_snapshot_json and exam.questions_json:
            sub.questions_snapshot_json = exam.questions_json
        sub.last_seen_at = now
        db.commit()

    sub_deadline = to_utc_instant(sub.deadline_at)
    if sub.status in ["started", "in_progress", "submitting"] and sub_deadline and now >= sub_deadline:
        process_exam_submission(sub, db, auto_submitted=True)

    end_instant = to_utc_instant(exam.end_time) or (now + timedelta(days=30))
    token_expire = max(end_instant, now + timedelta(hours=6))
    payload = {"sub": sub.id, "exp": token_expire, "type": "exam_session"}
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    is_completed = sub.status in ["submitted", "auto_submitted", "graded"]
    
    return {
        "token": token,
        "session_token": token,
        "student_name": cand.name_snapshot if cand else current_user.full_name,
        "duration_minutes": exam.duration_minutes,
        "is_completed": is_completed,
        "submission_id": sub.id,
        "score": sub.score,
        "percentage": sub.percentage
    }

@router.post("/save-progress")
def save_progress(
    progress: Dict[str, Any],
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Persists responses dynamically; uses server-controlled optimistic concurrency; auto-submits if deadline passed."""
    actual_token = resolve_exam_token(token, authorization)
    sub = get_submission_by_token(actual_token, db)
    if sub.status in ["submitted", "auto_submitted", "submitting", "graded"]:
        raise HTTPException(status_code=400, detail="Cannot save progress on submitted exam")
        
    now = now_utc()
    exam = sub.exam
    exam_duration = exam.duration_minutes or 30
    allowed_end = to_utc_instant(exam.end_time) or (now + timedelta(minutes=exam_duration))
    started_instant = to_utc_instant(sub.started_at) or now
    sub_deadline = to_utc_instant(sub.deadline_at)
    deadline = sub_deadline or min(started_instant + timedelta(minutes=exam_duration), allowed_end)

    if now >= deadline:
        # Strict deadline enforcement: do not accept late incoming answers! Auto-submit whatever was on record before deadline.
        return process_exam_submission(sub, db, auto_submitted=True)

    incoming_answers = dict(progress)
    expected_version = incoming_answers.pop("expected_version", None)
    client_version = incoming_answers.pop("_version", None)
    client_ts = incoming_answers.pop("_client_timestamp", None)
    
    existing_answers = json.loads(sub.answers_json) if sub.answers_json else {}
    if not isinstance(existing_answers, dict):
        existing_answers = {}
    stored_meta = existing_answers.get("_meta", {}) if isinstance(existing_answers, dict) else {}
    last_saved_ts = stored_meta.get("last_answer_timestamp", 0)
    current_ver = sub.answer_version or 0

    # 1. Monotonic client sequence check
    if client_version is not None and int(client_version) < current_ver:
        return {
            "saved": False,
            "conflict": True,
            "discarded": True,
            "server_version": current_ver,
            "version": current_ver,
            "message": "Stale autosave version discarded.",
            "time_remaining_seconds": max(0, int((deadline - now).total_seconds()))
        }

    # 2. Client timestamp out-of-order safeguard
    if client_ts is not None and float(client_ts) < float(last_saved_ts):
        return {
            "saved": False,
            "conflict": True,
            "discarded": True,
            "server_version": current_ver,
            "version": current_ver,
            "message": "Stale autosave discarded.",
            "time_remaining_seconds": max(0, int((deadline - now).total_seconds()))
        }

    # 3. Explicit Optimistic Concurrency check (Phase 5)
    if expected_version is not None:
        try:
            expected_ver_int = int(expected_version)
        except (ValueError, TypeError):
            expected_ver_int = -1
        if expected_ver_int != current_ver:
            return {
                "saved": False,
                "conflict": True,
                "discarded": True,
                "server_version": current_ver,
                "version": current_ver,
                "message": f"Autosave conflict: expected version {expected_version} does not match server version {current_ver}.",
                "time_remaining_seconds": max(0, int((deadline - now).total_seconds()))
            }

    merged_answers = {**existing_answers, **incoming_answers}
    target_ver = max(current_ver, int(client_version or current_ver)) + 1
    stored_meta["version"] = target_ver
    if client_ts is not None:
        stored_meta["last_answer_timestamp"] = float(client_ts)
    merged_answers["_meta"] = stored_meta

    sub.answers_json = json.dumps(merged_answers)
    sub.answer_version = target_ver
    sub.last_seen_at = now
    sub.updated_at = now
    db.commit()
    db.refresh(sub)

    return {
        "saved": True,
        "conflict": False,
        "discarded": False,
        "message": "Progress auto-saved.",
        "version": sub.answer_version,
        "server_version": sub.answer_version,
        "time_remaining_seconds": max(0, int((deadline - now).total_seconds()))
    }

async def handle_violation_logic(sub: ExamSubmission, violation: ViolationReport, db: Session) -> dict:
    """
    Locked EduQuizX tab-switch policy:
    FIRST TAB SWITCH:
      - Persist TAB_SWITCH violation
      - violation_count = 1
      - DO NOT submit exam
      - Student remains ACTIVE
      - Return prominent warning
    SECOND TAB SWITCH:
      - Persist TAB_SWITCH violation
      - violation_count = 2
      - Immediately AUTO_SUBMIT server-side
      - Concurrency-safe atomic database state transition
      - Freeze answers, invalidate exam session, trigger grading exactly once
      - Broadcast final state to teacher live monitor
    """
    server_now = now_utc()
    
    # Check if already submitted/auto-submitted/graded
    if sub.status in ["submitted", "auto_submitted", "graded"]:
        return {
            "action": "already_submitted",
            "status": sub.status,
            "force_submit": True,
            "reason": sub.auto_submit_reason or "TAB_SWITCH",
            "violation_count": sub.tab_switch_count or 0,
            "message": "Exam already finalized."
        }

    # Idempotency check: if client_event_id already recorded for this submission
    if violation.client_event_id:
        existing_event = db.query(ProctoringLog).filter(
            ProctoringLog.submission_id == sub.id,
            ProctoringLog.client_event_id == violation.client_event_id
        ).first()
        if existing_event:
            return {
                "action": "ignored_duplicate",
                "status": sub.status,
                "force_submit": sub.status in ["submitted", "auto_submitted", "graded"],
                "reason": sub.auto_submit_reason,
                "violation_count": sub.tab_switch_count or 0,
                "message": "Duplicate violation event ignored."
            }

    # Query current count of tab_switch violations for this submission
    current_tab_switches = db.query(func.count(ProctoringLog.id)).filter(
        ProctoringLog.submission_id == sub.id,
        ProctoringLog.event_type == "tab_switch"
    ).scalar() or 0
    new_count = current_tab_switches + 1

    # Persist the violation log
    client_ts = None
    if violation.occurred_at:
        try:
            client_ts = to_utc_instant(violation.occurred_at)
        except Exception:
            pass

    details_str = json.dumps(violation.metadata) if violation.metadata else f"Tab switch violation #{new_count} detected via {violation.source or 'browser_visibility'}"

    log = ProctoringLog(
        submission_id=sub.id,
        candidate_id=sub.candidate_id,
        exam_id=sub.exam_id,
        event_type="tab_switch",
        event_details=details_str,
        client_event_id=violation.client_event_id,
        source=violation.source or "browser_visibility",
        client_timestamp=client_ts,
        timestamp=server_now
    )
    db.add(log)
    sub.tab_switch_count = new_count
    try:
        db.commit()
    except Exception:
        db.rollback()
        sub = db.query(ExamSubmission).filter(ExamSubmission.id == sub.id).first()
        return {
            "action": "ignored_duplicate",
            "status": sub.status if sub else "started",
            "force_submit": sub.status in ["submitted", "auto_submitted", "graded"] if sub else False,
            "reason": sub.auto_submit_reason if sub else None,
            "violation_count": sub.tab_switch_count if sub else 0,
            "message": "Duplicate violation event ignored."
        }

    # Resolve candidate details for live broadcast
    cand_name = "Candidate"
    roll_no = ""
    if sub.candidate:
        cand_name = sub.candidate.name_snapshot
        roll_no = sub.candidate.roll_number_snapshot or ""
    elif sub.credential and sub.credential.student and sub.credential.student.user:
        cand_name = sub.credential.student.user.full_name
        roll_no = sub.credential.student.roll_number or ""

    if new_count == 1:
        # Policy: FIRST TAB SWITCH -> Warning only, remain ACTIVE
        await manager.broadcast_proctor_alert(
            exam_id=sub.exam_id,
            message={
                "student_name": cand_name,
                "roll_number": roll_no,
                "event_type": "tab_switch",
                "event_details": "Warning: Tab switch #1 recorded. Allowed switches remaining: 0",
                "violation_count": 1,
                "timestamp": to_iso_utc(server_now)
            }
        )
        return {
            "action": "warn",
            "violation_count": 1,
            "warning": "Warning: Tab switching is not allowed. One more tab switch will automatically submit your exam.",
            "status": sub.status,
            "allowed_switches_remaining": 0
        }
    else:
        # Policy: SECOND TAB SWITCH -> Immediately AUTO_SUBMIT server-side
        # Atomic DB state transition row lock
        rows_updated = db.query(ExamSubmission).filter(
            ExamSubmission.id == sub.id,
            ExamSubmission.status.in_(["started", "in_progress", "submitting"])
        ).update({
            "status": "auto_submitted",
            "submitted_at": server_now,
            "auto_submit_reason": "TAB_SWITCH"
        }, synchronize_session=False)
        db.commit()

        if rows_updated > 0:
            eval_res = process_exam_submission(sub, db, auto_submitted=True, auto_submit_reason="TAB_SWITCH")
            return {
                "action": "auto_submit",
                "violation_count": new_count,
                "status": "auto_submitted",
                "force_submit": True,
                "reason": "TAB_SWITCH",
                "message": "Exam automatically submitted due to tab switching.",
                "result": eval_res
            }
        else:
            # Already transitioned concurrently
            db.rollback()
            sub = db.query(ExamSubmission).filter(ExamSubmission.id == sub.id).first()
            evaluated = json.loads(sub.answers_json) if (sub and sub.answers_json) else {}
            return {
                "action": "auto_submit",
                "violation_count": new_count,
                "status": sub.status if sub else "auto_submitted",
                "force_submit": True,
                "reason": (sub.auto_submit_reason if sub else None) or "TAB_SWITCH",
                "message": "Exam automatically submitted due to tab switching.",
                "result": {
                    "status": sub.status if sub else "auto_submitted",
                    "score": sub.score if sub else 0.0,
                    "percentage": sub.percentage if sub else 0.0,
                    "evaluated_answers": evaluated
                }
            }

@router.post("/violation")
async def report_violation_token(
    violation: ViolationReport,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Server-authoritative violation enforcement endpoint."""
    actual_token = resolve_exam_token(token, authorization)
    sub = get_submission_by_token(actual_token, db)
    return await handle_violation_logic(sub, violation, db)

@router.post("/{submission_id}/violation")
async def report_violation_path(
    submission_id: str,
    violation: ViolationReport,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Server-authoritative violation enforcement endpoint by submission ID or token."""
    sub = db.query(ExamSubmission).filter(ExamSubmission.id == submission_id).first()
    if not sub:
        actual_token = resolve_exam_token(token, authorization)
        sub = get_submission_by_token(actual_token, db)
    return await handle_violation_logic(sub, violation, db)

@router.post("/heartbeat")
async def student_heartbeat(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Receives periodic presence heartbeats (every 10-15s) from student test room.
    Enforces server-authoritative exam deadline, tab-switch policy state sync, and records last_seen_at.
    """
    actual_token = resolve_exam_token(token, authorization)
    sub = get_submission_by_token(actual_token, db)
    now = now_utc()

    if sub.status in ["submitted", "auto_submitted", "graded"]:
        return {
            "status": sub.status,
            "action": "force_submit" if sub.status == "auto_submitted" else "redirect_completed",
            "force_submit": True,
            "reason": (sub.auto_submit_reason or "tab_switch") if sub.status == "auto_submitted" else "completed",
            "time_remaining_seconds": 0
        }

    # Tab-switch policy enforcement check during heartbeat
    if (sub.tab_switch_count or 0) >= 2:
        rows_updated = db.query(ExamSubmission).filter(
            ExamSubmission.id == sub.id,
            ExamSubmission.status.in_(["started", "in_progress", "submitting"])
        ).update({
            "status": "auto_submitted",
            "submitted_at": now,
            "auto_submit_reason": "TAB_SWITCH"
        }, synchronize_session=False)
        db.commit()
        if rows_updated > 0:
            process_exam_submission(sub, db, auto_submitted=True, auto_submit_reason="TAB_SWITCH")
        return {
            "status": "auto_submitted",
            "action": "force_submit",
            "force_submit": True,
            "reason": "tab_switch",
            "time_remaining_seconds": 0
        }

    exam = sub.exam
    exam_duration = exam.duration_minutes or 30
    allowed_end = to_utc_instant(exam.end_time) or (now + timedelta(minutes=exam_duration))
    started_instant = to_utc_instant(sub.started_at) or now
    sub_deadline = to_utc_instant(sub.deadline_at)
    deadline = sub_deadline or min(started_instant + timedelta(minutes=exam_duration), allowed_end)

    if now >= deadline:
        if sub.status not in ["submitted", "auto_submitted", "submitting", "graded"]:
            process_exam_submission(sub, db, auto_submitted=True, auto_submit_reason="TIME_EXPIRED")
        return {
            "status": "auto_submitted",
            "action": "time_expired",
            "force_submit": True,
            "reason": "time_expired",
            "time_remaining_seconds": 0
        }

    sub.last_seen_at = now
    db.commit()

    return {
        "status": "ok",
        "time_remaining_seconds": max(0, int((deadline - now).total_seconds()))
    }

@router.post("/proctor-alert")
async def proctor_alert(
    alert: ProctorLogCreate,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Logs proctoring incidents and broadcasts to teacher live streams; delegates tab_switch to policy engine."""
    actual_token = resolve_exam_token(token, authorization)
    sub = get_submission_by_token(actual_token, db)
    
    if alert.event_type == "tab_switch":
        violation_report = ViolationReport(
            type="TAB_SWITCH",
            client_event_id=None,
            occurred_at=to_iso_utc(now_utc()),
            source="browser_visibility",
            metadata={"details": alert.event_details}
        )
        return await handle_violation_logic(sub, violation_report, db)

    log = ProctoringLog(
        submission_id=sub.id,
        candidate_id=sub.candidate_id,
        exam_id=sub.exam_id,
        event_type=alert.event_type,
        event_details=alert.event_details,
        source="client_telemetry",
        timestamp=now_utc()
    )
    db.add(log)
    db.commit()

    # Resolve candidate details for live alert HUD
    cand_name = "Candidate"
    roll_no = ""
    if sub.candidate:
        cand_name = sub.candidate.name_snapshot
        roll_no = sub.candidate.roll_number_snapshot or ""
    elif sub.credential and sub.credential.student and sub.credential.student.user:
        cand_name = sub.credential.student.user.full_name
        roll_no = sub.credential.student.roll_number or ""

    # Broadcast alert to all active teacher connections
    await manager.broadcast_proctor_alert(
        exam_id=sub.exam_id,
        message={
            "student_name": cand_name,
            "roll_number": roll_no,
            "event_type": alert.event_type,
            "event_details": alert.event_details,
            "timestamp": to_iso_utc(now_utc())
        }
    )

    return {"message": "Proctor event logged and broadcasted."}

@router.post("/submit", dependencies=[Depends(rate_limit_dependency(max_requests=300, window_seconds=60))])
def submit_exam(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    answers: Optional[Dict[str, Any]] = Body(default=None),
    db: Session = Depends(get_db)
):
    """
    Submits the exam, scores objective questions instantly,
    runs Gemini AI Subjective evaluations against rubrics, and finalizes results.
    Guarded against concurrent double-submissions with idempotency.
    """
    actual_token = resolve_exam_token(token, authorization)
    sub = get_submission_by_token(actual_token, db)
    
    # Idempotent response if already submitted
    if sub.status in ["submitted", "auto_submitted", "graded"]:
        evaluated = json.loads(sub.answers_json) if sub.answers_json else {}
        return {
            "status": sub.status,
            "message": "Exam has already been submitted.",
            "submission_id": sub.id,
            "score": round(sub.score or 0.0, 2),
            "total_marks": sub.exam.total_marks if sub.exam else 50,
            "percentage": round(sub.percentage or 0.0, 1),
            "is_passed": (sub.score or 0.0) >= float(sub.exam.passing_marks or 0.0) if sub.exam else True,
            "evaluated_answers": evaluated
        }

    # Atomic concurrency lock for real submissions (non-simulations)
    if not str(sub.id).startswith("sim_"):
        rows_updated = db.query(ExamSubmission).filter(
            ExamSubmission.id == sub.id,
            ExamSubmission.status.notin_(["submitted", "auto_submitted", "submitting", "graded"])
        ).update({"status": "submitting"}, synchronize_session=False)
        db.commit()
        if rows_updated == 0:
            import time
            for _ in range(25):
                db.rollback()
                sub = db.query(ExamSubmission).filter(ExamSubmission.id == sub.id).first()
                if sub and sub.status in ["submitted", "auto_submitted", "graded"]:
                    evaluated = json.loads(sub.answers_json) if sub.answers_json else {}
                    return {
                        "status": sub.status,
                        "message": "Exam has already been submitted.",
                        "submission_id": sub.id,
                        "score": round(sub.score or 0.0, 2),
                        "total_marks": sub.exam.total_marks if sub.exam else 50,
                        "percentage": round(sub.percentage or 0.0, 1),
                        "is_passed": (sub.score or 0.0) >= float(sub.exam.passing_marks or 0.0) if sub.exam else True,
                        "evaluated_answers": evaluated
                    }
                time.sleep(0.08)

            sub = db.query(ExamSubmission).filter(ExamSubmission.id == sub.id).first()
            if sub and sub.status in ["submitted", "auto_submitted", "graded"]:
                evaluated = json.loads(sub.answers_json) if sub.answers_json else {}
                return {
                    "status": sub.status,
                    "message": "Exam has already been submitted.",
                    "submission_id": sub.id,
                    "score": round(sub.score or 0.0, 2),
                    "total_marks": sub.exam.total_marks if sub.exam else 50,
                    "percentage": round(sub.percentage or 0.0, 1),
                    "is_passed": (sub.score or 0.0) >= float(sub.exam.passing_marks or 0.0) if sub.exam else True,
                    "evaluated_answers": evaluated
                }
            raise HTTPException(status_code=409, detail="Exam submission currently processing. Please wait.")

    now = now_utc()
    exam = sub.exam
    exam_duration = exam.duration_minutes or 30 if exam else 30
    allowed_end = to_utc_instant(exam.end_time) if exam else None
    started_instant = to_utc_instant(sub.started_at) or now
    sub_deadline = to_utc_instant(sub.deadline_at)
    deadline = sub_deadline or (started_instant + timedelta(minutes=exam_duration))
    if allowed_end and allowed_end < deadline:
        deadline = allowed_end

    is_late = now >= deadline

    # Only accept new answers if submitted BEFORE or AT deadline
    if answers and not is_late:
        final_answers = answers.get("answers") if isinstance(answers, dict) and "answers" in answers and isinstance(answers["answers"], dict) else answers
        sub.answers_json = json.dumps(final_answers)
        db.commit()
        
    try:
        return process_exam_submission(sub, db, auto_submitted=is_late)
    except Exception as e:
        if not str(sub.id).startswith("sim_"):
            db.query(ExamSubmission).filter(ExamSubmission.id == sub.id, ExamSubmission.status == "submitting").update({"status": "started"}, synchronize_session=False)
            db.commit()
        raise e

@router.websocket("/ws/teacher/{exam_id}")
async def websocket_teacher_endpoint(websocket: WebSocket, exam_id: str, token: Optional[str] = Query(None)):
    """Authenticated WebSocket endpoint for teachers to monitor proctoring alerts."""
    if not token:
        await websocket.close(code=1008)
        return
    db = SessionLocal()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
        if not user or user.role not in ["teacher", "inst_admin", "super_admin"]:
            await websocket.close(code=1008)
            return
        exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False).first()
        if not exam:
            await websocket.close(code=1008)
            return

        # Enforce multi-tenant workspace isolation for teacher monitor
        if user.role != "super_admin":
            teacher_ws_ids = [m.workspace_id for m in db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).all()]
            if not (exam.created_by == user.id or (exam.workspace_id and exam.workspace_id in teacher_ws_ids)):
                await websocket.close(code=1008)
                return
    except Exception:
        await websocket.close(code=1008)
        return
    finally:
        db.close()

    await manager.connect_teacher(exam_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_teacher(exam_id, websocket)

@router.websocket("/ws/student/{submission_id}")
async def websocket_student_endpoint(websocket: WebSocket, submission_id: str, token: Optional[str] = Query(None)):
    """Authenticated WebSocket endpoint for student sessions to broadcast proctoring events."""
    if not token:
        await websocket.close(code=1008)
        return
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        sub_id = payload.get("sub")
        if not sub_id or sub_id != submission_id:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return

    # 1. Authorize BEFORE accepting the socket connection
    db: Session = SessionLocal()
    try:
        submission = db.query(ExamSubmission).filter(ExamSubmission.id == submission_id).first()
        if not submission:
            await websocket.close(code=1008)
            return
        exam_id = submission.exam_id
        cand_name = submission.candidate.name_snapshot if submission.candidate else (
            submission.credential.student.user.full_name if (submission.credential and submission.credential.student and submission.credential.student.user) else "Student"
        )
        roll_no = submission.candidate.roll_number_snapshot if submission.candidate else (
            submission.credential.student.roll_number if (submission.credential and submission.credential.student) else ""
        )
    except Exception:
        await websocket.close(code=1008)
        return
    finally:
        db.close()

    # 2. Authorization succeeded — accept socket
    await websocket.accept()

    # Broadcast STUDENT_CONNECTED to all workers
    await manager.broadcast_event(
        exam_id=exam_id,
        event_type="STUDENT_CONNECTED",
        data={
            "submission_id": submission_id,
            "student_name": cand_name,
            "roll_number": roll_no
        }
    )

    db = SessionLocal()
    try:
        while True:
            data = await websocket.receive_text()
            event = json.loads(data)
            
            log = ProctoringLog(
                submission_id=submission_id,
                event_type=event.get("event_type", "unknown"),
                event_details=event.get("event_details", "")
            )
            db.add(log)
            db.commit()
            
            await manager.broadcast_proctor_alert(
                exam_id=exam_id,
                message={
                    "student_name": cand_name,
                    "roll_number": roll_no,
                    "event_type": event.get("event_type"),
                    "event_details": event.get("event_details"),
                    "timestamp": to_iso_utc(now_utc())
                }
            )
    except WebSocketDisconnect:
        # Broadcast STUDENT_DISCONNECTED across workers
        await manager.broadcast_event(
            exam_id=exam_id,
            event_type="STUDENT_DISCONNECTED",
            data={
                "submission_id": submission_id,
                "student_name": cand_name,
                "roll_number": roll_no
            }
        )
    finally:
        db.close()
