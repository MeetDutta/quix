import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.database import get_db
from app.models.user import User, Student
from app.models.exam import Exam, ExamSubmission, ExamCredential, ProctoringLog
from app.models.institution import Department
from app.utils.security import RoleChecker, get_current_user
from app.services.ai_service import AIService

router = APIRouter(prefix="/reports", tags=["reports"])
teacher_required = RoleChecker(["teacher", "inst_admin", "super_admin"])
ai_service = AIService()

@router.get("/exam-summary/{exam_id}")
def get_exam_summary(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns high-level statistics for a completed exam.
    Attendance rate, scores range (high, low, average), and proctor alert counts.
    """
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    total_credentials = db.query(ExamCredential).filter(ExamCredential.exam_id == exam_id).count()
    submissions = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id, ExamSubmission.status == "submitted").all()
    
    attendance = len(submissions)
    if not submissions:
        return {
            "exam_name": exam.name,
            "total_students": total_credentials,
            "attended_students": 0,
            "average_score": 0.0,
            "highest_score": 0.0,
            "lowest_score": 0.0,
            "pass_rate": 0.0,
            "submissions": []
        }
        
    scores = [s.score for s in submissions]
    avg_score = sum(scores) / len(scores)
    highest = max(scores)
    lowest = min(scores)
    
    passing = sum(1 for s in submissions if s.score >= exam.passing_marks)
    pass_rate = (passing / len(submissions)) * 100.0
    
    submissions_list = []
    for s in submissions:
        proctor_alerts_count = db.query(ProctoringLog).filter(ProctoringLog.submission_id == s.id).count()
        submissions_list.append({
            "submission_id": s.id,
            "student_name": s.credential.student.user.full_name if s.credential.student else "Guest",
            "roll_number": s.credential.student.roll_number if s.credential.student else "",
            "score": s.score,
            "percentage": s.percentage,
            "proctor_alerts": proctor_alerts_count,
            "started_at": s.started_at,
            "submitted_at": s.submitted_at
        })
        
    return {
        "exam_name": exam.name,
        "total_students": total_credentials,
        "attended_students": attendance,
        "average_score": round(avg_score, 2),
        "highest_score": highest,
        "lowest_score": lowest,
        "pass_rate": round(pass_rate, 2),
        "submissions": submissions_list
    }

@router.get("/my-submissions")
def get_my_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all submitted exam attempts for the logged-in student/user.
    """
    # Find student records matching current_user
    student_records = db.query(Student).filter(
        (Student.user_id == current_user.id) |
        (Student.user.has(User.email == current_user.email)) |
        (Student.user.has(User.full_name == current_user.full_name))
    ).all()
    
    student_ids = [s.id for s in student_records]
    
    if student_ids:
        submissions = db.query(ExamSubmission).join(ExamCredential).filter(
            ExamSubmission.status == "submitted",
            ExamCredential.student_id.in_(student_ids)
        ).order_by(ExamSubmission.submitted_at.desc()).all()
    else:
        # Fallback: if student profile isn't explicitly linked, return all submitted exams
        submissions = db.query(ExamSubmission).filter(
            ExamSubmission.status == "submitted"
        ).order_by(ExamSubmission.submitted_at.desc()).all()
        
    result = []
    for s in submissions:
        result.append({
            "id": s.id,
            "submission_id": s.id,
            "exam_id": s.exam_id,
            "exam_name": s.exam.name if s.exam else "Exam Quiz",
            "score": s.score,
            "max_score": s.exam.total_marks if s.exam else 50.0,
            "percentage": s.percentage,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else ""
        })
    return result

@router.get("/submission-detail/{submission_id}")
def get_submission_detail(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns full question-by-question response breakdown and AI critique.
    Accessible by student (their own) and teachers.
    """
    sub = db.query(ExamSubmission).filter(ExamSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission record not found")
        
    # Check permissions
    if current_user.role == "student":
        # Allow access if credential student is linked to current_user
        if sub.credential and sub.credential.student and sub.credential.student.user_id:
            if sub.credential.student.user_id != current_user.id and sub.credential.student.user.email != current_user.email:
                raise HTTPException(status_code=403, detail="Access denied to this report")
            
    # Load detailed evaluation answers from answers_json
    answers_data = json.loads(sub.answers_json) if sub.answers_json else {}
    
    # Load proctoring alerts
    proctor_logs = db.query(ProctoringLog).filter(ProctoringLog.submission_id == submission_id).all()
    proctor_events = [
        {"event_type": log.event_type, "event_details": log.event_details, "timestamp": log.timestamp}
        for log in proctor_logs
    ]
    
    # Build topic analysis with accuracy percentages
    topic_analysis = {}
    exam_questions = json.loads(sub.exam.questions_json) if sub.exam.questions_json else []
    for q_id, q_eval in answers_data.items():
        q_topic = "General"
        q_marks = 1.0
        for eq in exam_questions:
            if eq["id"] == q_id:
                q_topic = eq.get("topic", "General")
                q_marks = float(eq.get("marks", 1))
                break
        
        if q_topic not in topic_analysis:
            topic_analysis[q_topic] = {"correct": 0, "total": 0, "marks_earned": 0.0, "marks_possible": 0.0}
        topic_analysis[q_topic]["total"] += 1
        topic_analysis[q_topic]["marks_possible"] += q_marks
        if q_eval.get("is_correct", False):
            topic_analysis[q_topic]["correct"] += 1
        topic_analysis[q_topic]["marks_earned"] += max(0, float(q_eval.get("score_awarded", 0)))
    
    # Compute accuracy percentage per topic
    for t in topic_analysis:
        if topic_analysis[t]["marks_possible"] > 0:
            topic_analysis[t]["accuracy"] = round((topic_analysis[t]["marks_earned"] / topic_analysis[t]["marks_possible"]) * 100, 1)
        else:
            topic_analysis[t]["accuracy"] = 0.0
        
    # Call Gemini to write educational feedback dynamically!
    ai_feedback_report = sub.ai_feedback
    if not ai_feedback_report and current_user.role == "student":
        try:
            topics_scores = {}
            for t, tdata in topic_analysis.items():
                topics_scores[t] = [tdata["marks_earned"]]
            analysis = ai_service.generate_learning_analytics(topics_scores)
            ai_feedback_report = f"Strengths in: {', '.join(analysis.get('strong_topics', []))}. Action plan: {', '.join(analysis.get('recommendations', []))}."
            # Save it back
            sub.ai_feedback = ai_feedback_report
            db.add(sub)
            db.commit()
        except Exception:
            ai_feedback_report = "Keep practicing and review your concepts."
    
    # Compute student rank for this exam
    all_subs = db.query(ExamSubmission).filter(
        ExamSubmission.exam_id == sub.exam_id,
        ExamSubmission.status == "submitted"
    ).order_by(ExamSubmission.score.desc()).all()
    
    rank = 1
    total_participants = len(all_subs)
    for i, s in enumerate(all_subs):
        if s.id == sub.id:
            rank = i + 1
            break
            
    return {
        "submission_id": sub.id,
        "student_name": sub.credential.student.user.full_name if sub.credential.student else "Guest",
        "roll_number": sub.credential.student.roll_number if sub.credential.student else "",
        "exam_name": sub.exam.name,
        "exam_id": sub.exam_id,
        "score": sub.score,
        "max_score": sub.exam.total_marks,
        "percentage": sub.percentage,
        "started_at": sub.started_at,
        "submitted_at": sub.submitted_at,
        "evaluated_answers": answers_data,
        "proctor_events": proctor_events,
        "topic_analysis": topic_analysis,
        "rank": rank,
        "total_participants": total_participants,
        "ai_feedback": ai_feedback_report
    }

@router.get("/leaderboard/{exam_id}")
def get_leaderboard(
    exam_id: str,
    db: Session = Depends(get_db)
):
    """Leaderboard ranking for a specific exam."""
    submissions = db.query(ExamSubmission).filter(
        ExamSubmission.exam_id == exam_id,
        ExamSubmission.status == "submitted"
    ).order_by(ExamSubmission.score.desc()).all()
    
    board = []
    for rank, s in enumerate(submissions):
        board.append({
            "rank": rank + 1,
            "student_name": s.credential.student.user.full_name if s.credential.student else "Guest",
            "roll_number": s.credential.student.roll_number if s.credential.student else "",
            "score": s.score,
            "percentage": s.percentage
        })
    return board

from fastapi.responses import HTMLResponse

@router.get("/submission-detail/{submission_id}/printable", response_class=HTMLResponse)
def export_printable_submission_response(
    submission_id: str,
    db: Session = Depends(get_db)
):
    """
    Exports full student exam response booklet with questions, selected answers, 
    correct answers, explanations, and scores as a printable HTML/PDF document.
    """
    sub = db.query(ExamSubmission).filter(ExamSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    student_name = sub.credential.student.user.full_name if (sub.credential and sub.credential.student and sub.credential.student.user) else "Student"
    roll_number = sub.credential.student.roll_number if (sub.credential and sub.credential.student) else "N/A"
    exam_name = sub.exam.name
    subject_id = sub.exam.subject_id
    answers_data = json.loads(sub.answers_json) if sub.answers_json else {}
    exam_questions = json.loads(sub.exam.questions_json) if (sub.exam and sub.exam.questions_json) else []
    
    # Map questions for fast lookup
    q_map = {q.get("id"): q for q in exam_questions if isinstance(q, dict) and "id" in q}
    
    normalized_evals = []
    
    # Process exam questions in paper order
    for idx, q in enumerate(exam_questions, start=1):
        q_id = q.get("id")
        q_eval = answers_data.get(q_id) if isinstance(answers_data, dict) else None
        
        q_text = q.get("question_text", f"Question {idx}")
        correct_ans = q.get("correct_answer", "N/A")
        explanation = q.get("explanation", "Standard concept explanation.")
        
        if isinstance(q_eval, dict):
            selected_ans = q_eval.get("selected_answer", "Not Answered")
            correct_ans = q_eval.get("correct_answer") or correct_ans
            is_correct = q_eval.get("is_correct", False)
            explanation = q_eval.get("explanation") or explanation
            ai_critique = q_eval.get("ai_feedback")
            score_awarded = q_eval.get("score_awarded", 0.0)
        elif q_eval is not None:
            selected_ans = str(q_eval)
            is_correct = str(selected_ans).strip().lower() == str(correct_ans).strip().lower()
            score_awarded = float(q.get("marks", 1.0)) if is_correct else 0.0
            ai_critique = None
        else:
            selected_ans = "Not Answered"
            is_correct = False
            score_awarded = 0.0
            ai_critique = None
            
        normalized_evals.append({
            "idx": idx,
            "question_text": q_text,
            "selected_answer": selected_ans,
            "correct_answer": correct_ans,
            "is_correct": is_correct,
            "score_awarded": score_awarded,
            "marks_possible": float(q.get("marks", 1.0)),
            "explanation": explanation,
            "ai_feedback": ai_critique
        })
    
    responses_html = ""
    for item in normalized_evals:
        is_correct = item["is_correct"]
        status_badge = '<span style="color: #15803d; background: #dcfce7; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 12px;">✓ Correct</span>' if is_correct else '<span style="color: #b91c1c; background: #fee2e2; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 12px;">✕ Incorrect</span>'
        
        selected_ans = item["selected_answer"]
        correct_ans = item["correct_answer"]
        explanation = item["explanation"]
        ai_feedback = item["ai_feedback"]
        
        ai_box = f'<div style="margin-top: 6px; font-size: 12px; color: #9a3412; background: #fff7ed; padding: 8px; border-radius: 6px; border: 1px solid #ffedd5;"><b>AI Evaluation Feedback:</b> {ai_feedback}</div>' if ai_feedback else ""
        
        responses_html += f"""
        <div style="margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="font-weight: bold; font-size: 14px; color: #111827; flex: 1;">Q{item['idx']}. {item['question_text']} <span style="font-weight: normal; color: #6b7280; font-size: 12px;">[{item['score_awarded']:.1f}/{item['marks_possible']:.1f} Marks]</span></div>
            <div style="margin-left: 12px;">{status_badge}</div>
          </div>
          
          <div style="margin-top: 10px; font-size: 13px;">
            <div style="margin-bottom: 4px;"><b>Your Answer:</b> <span style="color: {'#15803d' if is_correct else '#b91c1c'};">{selected_ans}</span></div>
            <div style="margin-bottom: 4px;"><b>Correct Answer:</b> <span style="color: #15803d; font-weight: bold;">{correct_ans}</span></div>
            <div style="margin-top: 6px; font-size: 12px; color: #4b5563; background: #f9fafb; padding: 8px; border-radius: 6px; border-left: 3px solid #9a3412;">
              <b>Explanation & Key Concepts:</b> {explanation}
            </div>
            {ai_box}
          </div>
        </div>
        """
        
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{exam_name} - Student Response Booklet</title>
      <style>
        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #111827; background-color: #f9fafb; line-height: 1.5; }}
        .container {{ max-width: 800px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }}
        .header {{ text-align: center; border-bottom: 2px solid #9a3412; padding-bottom: 16px; margin-bottom: 24px; }}
        .meta-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #fff7ed; padding: 16px; border-radius: 8px; border: 1px solid #ffedd5; margin-bottom: 24px; font-size: 13px; }}
        .btn-print {{ background: #9a3412; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; margin-bottom: 20px; }}
        .btn-print:hover {{ background: #7c2d12; }}
        @media print {{
          body {{ padding: 0; background: #ffffff; }}
          .container {{ border: none; padding: 0; box-shadow: none; max-width: 100%; }}
          .btn-print {{ display: none; }}
        }}
      </style>
    </head>
    <body>
      <div class="container" style="max-width: 800px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="text-align: right;">
          <button onclick="window.print()" class="btn-print">🖨️ Print / Save as PDF</button>
        </div>
        <div class="header">
          <h1 style="margin: 0; font-size: 22px; color: #9a3412; text-transform: uppercase;">Official Student Response Booklet</h1>
          <h2 style="margin: 6px 0 0 0; font-size: 15px; font-weight: normal; color: #4b5563;">Exam: {exam_name} ({subject_id})</h2>
        </div>
        
        <div class="meta-grid">
          <div><b>Student Name:</b> {student_name}</div>
          <div><b>Roll Number:</b> {roll_number}</div>
          <div><b>Score Obtained:</b> <span style="color: #9a3412; font-weight: bold;">{sub.score} / {sub.exam.total_marks}</span></div>
          <div><b>Percentage:</b> <span style="color: #9a3412; font-weight: bold;">{sub.percentage:.1f}%</span></div>
          <div><b>Submission Status:</b> Submitted</div>
          <div><b>Date & Time:</b> {sub.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if sub.submitted_at else "N/A"}</div>
        </div>

        {f'<div style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 12px; border-radius: 8px; margin-bottom: 24px; font-size: 13px;"><b>AI Performance Analytics Report:</b> {sub.ai_feedback}</div>' if sub.ai_feedback else ''}
        
        <div>
          <h3 style="font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px; color: #111827;">Detailed Question Responses & Solutions</h3>
          {responses_html}
        </div>
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)

