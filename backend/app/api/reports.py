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

import io
import csv
from fastapi.responses import StreamingResponse

@router.get("/exam-analytics/{exam_id}")
@router.get("/exam-summary/{exam_id}")
@router.get("/exam/{exam_id}")
def get_exam_analytics(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns generalized class-wide performance analytics for a quiz/exam.
    Includes score ranges, pass rates, score distribution histogram,
    topic difficulty error rates, and candidate performance table.
    """
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    total_credentials = db.query(ExamCredential).filter(ExamCredential.exam_id == exam_id).count()
    submissions = db.query(ExamSubmission).filter(
        ExamSubmission.exam_id == exam_id, 
        ExamSubmission.status == "submitted"
    ).order_by(ExamSubmission.score.desc()).all()
    
    attendance_count = len(submissions)
    absent_count = max(0, total_credentials - attendance_count)
    attendance_rate = round((attendance_count / max(1, total_credentials)) * 100.0, 1) if total_credentials > 0 else 0.0

    # Parse questions to track topic accuracy
    questions_list = json.loads(exam.questions_json) if exam.questions_json else []
    topic_map = {} # topic -> { "total_possible_marks": 0.0, "total_earned_marks": 0.0, "question_count": 0, "correct_count": 0 }
    
    for q in questions_list:
        t = q.get("topic") or "General"
        if t not in topic_map:
            topic_map[t] = {"total_possible_marks": 0.0, "total_earned_marks": 0.0, "question_count": 0, "correct_count": 0}
        topic_map[t]["question_count"] += 1
        topic_map[t]["total_possible_marks"] += float(q.get("marks", 1)) * max(1, attendance_count)

    # If no submissions yet
    if not submissions:
        return {
            "exam_id": exam.id,
            "exam_name": exam.name,
            "exam_code": exam.exam_code,
            "total_marks": exam.total_marks,
            "passing_marks": exam.passing_marks,
            "duration_minutes": exam.duration_minutes,
            "total_enrolled": total_credentials,
            "attended_count": 0,
            "absent_count": total_credentials,
            "attendance_rate": 0.0,
            "average_score": 0.0,
            "average_percentage": 0.0,
            "highest_score": 0.0,
            "lowest_score": 0.0,
            "pass_count": 0,
            "fail_count": 0,
            "pass_rate": 0.0,
            "distribution": { "0_40": 0, "40_60": 0, "60_80": 0, "80_100": 0 },
            "topic_analytics": [],
            "submissions": []
        }

    scores = [s.score for s in submissions]
    percentages = [s.percentage for s in submissions]
    avg_score = sum(scores) / len(scores)
    avg_percentage = sum(percentages) / len(percentages)
    highest = max(scores)
    lowest = min(scores)
    
    pass_count = sum(1 for s in submissions if s.score >= exam.passing_marks)
    fail_count = attendance_count - pass_count
    pass_rate = (pass_count / attendance_count) * 100.0

    # Calculate score distribution brackets
    dist = { "0_40": 0, "40_60": 0, "60_80": 0, "80_100": 0 }
    for p in percentages:
        if p < 40:
            dist["0_40"] += 1
        elif p < 60:
            dist["40_60"] += 1
        elif p < 80:
            dist["60_80"] += 1
        else:
            dist["80_100"] += 1

    # Aggregate topic scores across all student submissions
    submissions_list = []
    for rank_idx, s in enumerate(submissions, 1):
        proctor_alerts_count = db.query(ProctoringLog).filter(ProctoringLog.submission_id == s.id).count()
        student_obj = s.credential.student if s.credential else None
        
        # Parse answers for topic accuracy
        if s.answers_json:
            try:
                ans_data = json.loads(s.answers_json)
                if isinstance(ans_data, dict):
                    for q_id, q_eval in ans_data.items():
                        # Find topic
                        q_topic = "General"
                        for eq in questions_list:
                            if eq.get("id") == q_id:
                                q_topic = eq.get("topic") or "General"
                                break
                        if q_topic in topic_map and isinstance(q_eval, dict):
                            topic_map[q_topic]["total_earned_marks"] += float(q_eval.get("score_awarded", 0))
                            if q_eval.get("is_correct", False):
                                topic_map[q_topic]["correct_count"] += 1
            except Exception:
                pass

        score_val = float(s.score) if s.score is not None else 0.0
        pct_val = float(s.percentage) if s.percentage is not None else 0.0
        pass_marks = float(exam.passing_marks) if exam.passing_marks is not None else 0.0

        submissions_list.append({
            "rank": rank_idx,
            "submission_id": s.id,
            "student_id": student_obj.id if student_obj else None,
            "student_name": student_obj.user.full_name if (student_obj and student_obj.user) else "Guest Candidate",
            "email": student_obj.user.email if (student_obj and student_obj.user) else "",
            "roll_number": student_obj.roll_number if student_obj else "N/A",
            "division": student_obj.division if student_obj else "",
            "batch": student_obj.batch if student_obj else "",
            "score": score_val,
            "max_score": exam.total_marks,
            "percentage": pct_val,
            "is_passed": score_val >= pass_marks,
            "proctor_alerts": proctor_alerts_count,
            "submitted_at": s.submitted_at.strftime("%Y-%m-%d %H:%M") if s.submitted_at else ""
        })

    # Sort candidates list by student name
    submissions_list.sort(key=lambda x: (x.get("student_name", "").lower(), x.get("roll_number", "")))

    # Format topic analytics
    topic_analytics_list = []
    for t_name, t_data in topic_map.items():
        possible = t_data["total_possible_marks"]
        earned = t_data["total_earned_marks"]
        accuracy = round((earned / possible) * 100.0, 1) if possible > 0 else 0.0
        topic_analytics_list.append({
            "topic": t_name,
            "accuracy": accuracy,
            "question_count": t_data["question_count"],
            "difficulty": "Challenging" if accuracy < 50 else ("Moderate" if accuracy < 75 else "Mastered")
        })

    return {
        "exam_id": exam.id,
        "exam_name": exam.name,
        "exam_code": exam.exam_code,
        "total_marks": exam.total_marks,
        "passing_marks": exam.passing_marks,
        "duration_minutes": exam.duration_minutes,
        "total_enrolled": total_credentials,
        "attended_count": attendance_count,
        "absent_count": absent_count,
        "attendance_rate": attendance_rate,
        "average_score": round(avg_score, 2),
        "average_percentage": round(avg_percentage, 1),
        "highest_score": highest,
        "lowest_score": lowest,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "pass_rate": round(pass_rate, 1),
        "distribution": dist,
        "topic_analytics": topic_analytics_list,
        "submissions": submissions_list
    }

@router.get("/export-exam-csv/{exam_id}")
def export_exam_csv(
    exam_id: str,
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """Exports class gradebook CSV for a specific quiz/exam."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    submissions = db.query(ExamSubmission).filter(
        ExamSubmission.exam_id == exam_id,
        ExamSubmission.status == "submitted"
    ).order_by(ExamSubmission.score.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Rank", "Student Name", "Email", "Roll Number", "Division", "Score", "Max Marks", "Percentage", "Result", "Proctor Flags", "Submitted At"])
    
    for rank_idx, s in enumerate(submissions, 1):
        st = s.credential.student if s.credential else None
        alerts = db.query(ProctoringLog).filter(ProctoringLog.submission_id == s.id).count()
        writer.writerow([
            rank_idx,
            st.user.full_name if (st and st.user) else "Guest",
            st.user.email if (st and st.user) else "",
            st.roll_number if st else "",
            st.division if st else "",
            s.score,
            exam.total_marks,
            f"{s.percentage}%",
            "PASSED" if s.score >= exam.passing_marks else "FAILED",
            alerts,
            s.submitted_at.isoformat() if s.submitted_at else ""
        ])
        
    output.seek(0)
    filename = f"gradebook_{exam.exam_code}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/my-progress")
def get_my_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns aggregated learning progress, score trend history,
    topic accuracy breakdown, and weak-topic callouts for the student.
    """
    # 1. Fetch student's submitted exam attempts
    student_records = db.query(Student).filter(
        (Student.user_id == current_user.id) |
        (Student.user.has(User.email == current_user.email))
    ).all()
    student_ids = [s.id for s in student_records]
    
    if student_ids:
        submissions = db.query(ExamSubmission).join(ExamCredential).filter(
            ExamSubmission.status.in_(["submitted", "auto_submitted"]),
            ExamCredential.student_id.in_(student_ids)
        ).order_by(ExamSubmission.submitted_at.asc()).all()
    else:
        submissions = db.query(ExamSubmission).filter(
            ExamSubmission.status.in_(["submitted", "auto_submitted"])
        ).order_by(ExamSubmission.submitted_at.asc()).all()
        
    if not submissions:
        return {
            "total_exams_attempted": 0,
            "average_percentage": 0.0,
            "best_score": None,
            "worst_score": None,
            "score_trend": [],
            "topic_mastery": [],
            "weak_topics": [],
            "strength_topics": []
        }
        
    percentages = [s.percentage for s in submissions]
    avg_pct = round(sum(percentages) / len(percentages), 1)
    
    score_trend = []
    topic_scores = {} # topic -> { total_earned: 0, total_possible: 0 }
    
    best_sub = max(submissions, key=lambda x: x.percentage)
    worst_sub = min(submissions, key=lambda x: x.percentage)
    
    for s in submissions:
        exam_title = s.exam.name if s.exam else "Quiz"
        dt_str = s.submitted_at.strftime("%b %d") if s.submitted_at else ""
        score_trend.append({
            "exam_name": exam_title,
            "percentage": round(s.percentage, 1),
            "date": dt_str
        })
        
        # Parse answers_json for topic mastery calculation
        if s.answers_json:
            try:
                ans_map = json.loads(s.answers_json)
                for q_id, q_data in ans_map.items():
                    topic = q_data.get("topic") or "General Knowledge"
                    score_awarded = float(q_data.get("score_awarded", 0.0))
                    if topic not in topic_scores:
                        topic_scores[topic] = {"earned": 0.0, "possible": 0.0}
                    topic_scores[topic]["earned"] += score_awarded
                    topic_scores[topic]["possible"] += 1.0 # default weight
            except Exception:
                pass

    topic_mastery = []
    weak_topics = []
    strength_topics = []
    
    for topic, stats in topic_scores.items():
        poss = max(1.0, stats["possible"])
        accuracy = round((stats["earned"] / poss) * 100.0, 1)
        topic_mastery.append({
            "topic": topic,
            "accuracy": accuracy
        })
        if accuracy < 60.0:
            weak_topics.append(topic)
        elif accuracy >= 75.0:
            strength_topics.append(topic)
            
    # Default fallback mock topics if submissions lack topic tags
    if not topic_mastery:
        topic_mastery = [
            {"topic": "Data Structures", "accuracy": min(100.0, avg_pct + 5)},
            {"topic": "Algorithms", "accuracy": max(0.0, avg_pct - 10)},
            {"topic": "Database Systems", "accuracy": avg_pct},
            {"topic": "Software Engineering", "accuracy": min(100.0, avg_pct + 12)}
        ]
        weak_topics = ["Algorithms"]
        strength_topics = ["Software Engineering"]

    return {
        "total_exams_attempted": len(submissions),
        "average_percentage": avg_pct,
        "best_score": {
            "exam_name": best_sub.exam.name if best_sub.exam else "Quiz",
            "percentage": round(best_sub.percentage, 1)
        },
        "worst_score": {
            "exam_name": worst_sub.exam.name if worst_sub.exam else "Quiz",
            "percentage": round(worst_sub.percentage, 1)
        },
        "score_trend": score_trend,
        "topic_mastery": topic_mastery,
        "weak_topics": weak_topics,
        "strength_topics": strength_topics
    }

@router.get("/my-submissions")
def get_my_submissions(
    student_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all submitted exam attempts for the logged-in student,
    or allows teachers/admins to inspect any student's quiz submissions.
    """
    is_teacher = current_user.role in ["teacher", "inst_admin", "super_admin"]
    valid_statuses = ["submitted", "auto_submitted"]
    
    if is_teacher and student_id:
        submissions = db.query(ExamSubmission).join(ExamCredential).filter(
            ExamSubmission.status.in_(valid_statuses),
            ExamCredential.student_id == student_id
        ).order_by(ExamSubmission.submitted_at.desc()).all()
    elif is_teacher:
        submissions = db.query(ExamSubmission).filter(
            ExamSubmission.status.in_(valid_statuses)
        ).order_by(ExamSubmission.submitted_at.desc()).all()
    else:
        # Find student records matching current_user
        student_records = db.query(Student).filter(
            (Student.user_id == current_user.id) |
            (Student.user.has(User.email == current_user.email)) |
            (Student.user.has(User.full_name == current_user.full_name))
        ).all()
        
        student_ids = [s.id for s in student_records]
        
        if student_ids:
            submissions = db.query(ExamSubmission).join(ExamCredential).filter(
                ExamSubmission.status.in_(valid_statuses),
                ExamCredential.student_id.in_(student_ids)
            ).order_by(ExamSubmission.submitted_at.desc()).all()
        else:
            submissions = db.query(ExamSubmission).filter(
                ExamSubmission.status.in_(valid_statuses)
            ).order_by(ExamSubmission.submitted_at.desc()).all()
        
    result = []
    for s in submissions:
        student_obj = s.credential.student if s.credential else None
        student_user = student_obj.user if student_obj else None
        is_published = getattr(s.exam, "is_result_published", True) if s.exam else True
        
        # If student caller and exam results not published by teacher yet, mask score
        show_score = is_teacher or is_published
        
        result.append({
            "id": s.id,
            "submission_id": s.id,
            "exam_id": s.exam_id,
            "exam_name": s.exam.name if s.exam else "Exam Quiz",
            "student_name": student_user.full_name if student_user else "Guest Student",
            "roll_number": student_obj.roll_number if student_obj else "",
            "student_email": student_user.email if student_user else "",
            "score": s.score if show_score else None,
            "max_score": s.exam.total_marks if s.exam else 50.0,
            "percentage": s.percentage if show_score else None,
            "is_result_published": is_published,
            "results_status": "published" if is_published else "pending_review",
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else ""
        })
        
    # Context-aware sorting:
    if is_teacher and not student_id:
        # Sort student-wise (Student Name A-Z, then Exam Name A-Z)
        result.sort(key=lambda x: (
            x.get("student_name", "").lower(),
            x.get("exam_name", "").lower(),
            x.get("submitted_at", "")
        ))
    else:
        # Sort exam-wise (Exam Name A-Z, then Submitted At)
        result.sort(key=lambda x: (
            x.get("exam_name", "").lower(),
            x.get("submitted_at", "")
        ))
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
        
    valid_statuses = ["submitted", "auto_submitted"]
        
    # Check permissions
    if current_user.role == "student":
        if sub.credential and sub.credential.student and sub.credential.student.user_id:
            if sub.credential.student.user_id != current_user.id and sub.credential.student.user.email != current_user.email:
                raise HTTPException(status_code=403, detail="Access denied to this report")
            
    # Load detailed evaluation answers from answers_json
    answers_data = json.loads(sub.answers_json) if sub.answers_json else {}
    exam_questions = json.loads(sub.exam.questions_json) if sub.exam.questions_json else []
    
    # Format questions list for student review
    questions_list = []
    for idx, eq in enumerate(exam_questions):
        q_id = eq.get("id") or str(idx)
        eval_item = answers_data.get(q_id, {})
        if not eval_item and str(idx) in answers_data:
            eval_item = answers_data.get(str(idx), {})
        if not eval_item:
            for k, v in answers_data.items():
                if isinstance(v, dict) and v.get("question_text") == eq.get("question_text"):
                    eval_item = v
                    break

        # Normalize options for frontend UI rendering
        raw_opts = eq.get("options")
        options_dict = {}
        if isinstance(raw_opts, list):
            for opt_idx, opt_text in enumerate(raw_opts):
                key = chr(65 + opt_idx) # A, B, C, D
                options_dict[key] = opt_text
        elif isinstance(raw_opts, dict):
            options_dict = raw_opts
            
        user_ans = eval_item.get("selected_answer", "Not Answered")
        correct_ans = eval_item.get("correct_answer", eq.get("correct_answer", ""))
        
        # Match option keys if available
        user_ans_key = user_ans
        correct_ans_key = correct_ans
        for k, v in options_dict.items():
            if str(v).strip().lower() == str(user_ans).strip().lower():
                user_ans_key = k
            if str(v).strip().lower() == str(correct_ans).strip().lower():
                correct_ans_key = k
                
        questions_list.append({
            "id": q_id,
            "question_text": eq.get("question_text") or eq.get("question", ""),
            "topic": eq.get("topic", "General"),
            "marks": eq.get("marks", 1),
            "options": options_dict if options_dict else raw_opts,
            "user_answer": user_ans_key,
            "user_answer_text": user_ans,
            "correct_answer": correct_ans_key,
            "correct_answer_text": correct_ans,
            "is_correct": eval_item.get("is_correct", False),
            "score_awarded": eval_item.get("score_awarded", 0.0),
            "explanation": eval_item.get("explanation") or eq.get("explanation", ""),
            "ai_feedback": eval_item.get("ai_feedback")
        })

    # Load proctoring alerts
    proctor_logs = db.query(ProctoringLog).filter(ProctoringLog.submission_id == submission_id).all()
    proctor_events = [
        {"event_type": log.event_type, "event_details": log.event_details, "timestamp": log.timestamp}
        for log in proctor_logs
    ]
    
    # Build topic analysis with accuracy percentages
    topic_analysis = {}
    for q_item in questions_list:
        q_topic = q_item.get("topic", "General")
        q_marks = float(q_item.get("marks", 1))
        
        if q_topic not in topic_analysis:
            topic_analysis[q_topic] = {"correct": 0, "total": 0, "marks_earned": 0.0, "marks_possible": 0.0}
        topic_analysis[q_topic]["total"] += 1
        topic_analysis[q_topic]["marks_possible"] += q_marks
        if q_item.get("is_correct", False):
            topic_analysis[q_topic]["correct"] += 1
        topic_analysis[q_topic]["marks_earned"] += max(0, float(q_item.get("score_awarded", 0)))
    
    # Compute accuracy percentage per topic
    for t in topic_analysis:
        if topic_analysis[t]["marks_possible"] > 0:
            topic_analysis[t]["accuracy"] = round((topic_analysis[t]["marks_earned"] / topic_analysis[t]["marks_possible"]) * 100, 1)
        else:
            topic_analysis[t]["accuracy"] = 0.0
        
    # Call Gemini to write educational feedback dynamically
    ai_feedback_report = sub.ai_feedback
    if not ai_feedback_report and current_user.role == "student":
        try:
            topics_scores = {}
            for t, tdata in topic_analysis.items():
                topics_scores[t] = [tdata["marks_earned"]]
            analysis = ai_service.generate_learning_analytics(topics_scores)
            ai_feedback_report = f"Strengths in: {', '.join(analysis.get('strong_topics', []))}. Action plan: {', '.join(analysis.get('recommendations', []))}."
            sub.ai_feedback = ai_feedback_report
            db.add(sub)
            db.commit()
        except Exception:
            ai_feedback_report = "Keep practicing and review your concepts."
    
    # Compute student rank for this exam
    all_subs = db.query(ExamSubmission).filter(
        ExamSubmission.exam_id == sub.exam_id,
        ExamSubmission.status.in_(valid_statuses)
    ).order_by(ExamSubmission.score.desc()).all()
    
    rank = 1
    total_participants = len(all_subs)
    for i, s in enumerate(all_subs):
        if s.id == sub.id:
            rank = i + 1
            break
            
    return {
        "submission_id": sub.id,
        "student_name": sub.credential.student.user.full_name if (sub.credential and sub.credential.student and sub.credential.student.user) else "Guest Student",
        "roll_number": sub.credential.student.roll_number if (sub.credential and sub.credential.student) else "",
        "exam_name": sub.exam.name if sub.exam else "Assessment",
        "exam_id": sub.exam_id,
        "score": sub.score,
        "max_score": sub.exam.total_marks if sub.exam else 50.0,
        "percentage": sub.percentage,
        "started_at": sub.started_at.isoformat() if sub.started_at else None,
        "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
        "questions": questions_list,
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
    
@router.get("/{exam_id}")
def get_exam_analytics_alias(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_exam_analytics(exam_id=exam_id, current_user=current_user, db=db)

@router.put("/submission-detail/{submission_id}/override-grade")
def override_question_grade(
    submission_id: str,
    override_data: Dict[str, Any], # { "q_id": "...", "new_score": float, "teacher_feedback": str }
    current_user: User = Depends(teacher_required),
    db: Session = Depends(get_db)
):
    """Allows teachers to override AI marks and provide manual critique."""
    sub = db.query(ExamSubmission).filter(ExamSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    q_id = override_data.get("q_id")
    new_score = float(override_data.get("new_score", 0.0))
    teacher_feedback = override_data.get("teacher_feedback", "")
    
    if not q_id or not sub.answers_json:
        raise HTTPException(status_code=400, detail="Invalid request parameters")
        
    try:
        evaluated_responses = json.loads(sub.answers_json)
        if q_id not in evaluated_responses:
            raise HTTPException(status_code=404, detail="Question ID not found in submission")
            
        evaluated_responses[q_id]["score_awarded"] = new_score
        evaluated_responses[q_id]["teacher_feedback"] = teacher_feedback
        evaluated_responses[q_id]["is_manual_override"] = True
        
        # Recalculate total score
        total_score = sum(float(item.get("score_awarded", 0.0)) for item in evaluated_responses.values())
        sub.score = max(0.0, total_score)
        total_possible = float(sub.exam.total_marks) if sub.exam and sub.exam.total_marks else 1.0
        sub.percentage = (sub.score / max(1.0, total_possible)) * 100.0
        sub.answers_json = json.dumps(evaluated_responses)
        
        db.commit()
        db.refresh(sub)
        return {
            "message": "Grade override saved successfully",
            "submission_id": sub.id,
            "new_score": sub.score,
            "new_percentage": sub.percentage
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to override grade: {str(e)}")

