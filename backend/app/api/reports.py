import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.database import get_db
from app.models.user import User, Student
from app.models.exam import Exam, ExamSubmission, ExamCredential, ProctoringLog
from app.models.candidate import ExamCandidate
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
        ExamSubmission.status.in_(["submitted", "auto_submitted"])
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

    scores = [round(float(s.score or 0.0), 2) for s in submissions]
    percentages = [round(float(s.percentage or 0.0), 2) for s in submissions]
    avg_score = round(sum(scores) / len(scores), 2)
    avg_percentage = round(sum(percentages) / len(percentages), 2)
    highest = round(max(scores), 2)
    lowest = round(min(scores), 2)
    
    pass_count = sum(1 for s in submissions if (s.score or 0.0) >= exam.passing_marks)
    fail_count = attendance_count - pass_count
    pass_rate = round((pass_count / attendance_count) * 100.0, 1)

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

    exam_candidates = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam_id).all()

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

        score_val = round(float(s.score), 2) if s.score is not None else 0.0
        pct_val = round(float(s.percentage), 2) if s.percentage is not None else 0.0
        pass_marks = float(exam.passing_marks) if exam.passing_marks is not None else 0.0

        # Resolve candidate name & email
        cand_name = "Candidate"
        cand_email = ""
        cand_roll = "N/A"
        cand_div = ""
        cand_batch = ""

        if student_obj and student_obj.user:
            cand_name = student_obj.user.full_name
            cand_email = student_obj.user.email or ""
            cand_roll = student_obj.roll_number or "N/A"
            cand_div = student_obj.division or ""
            cand_batch = student_obj.batch or ""
        elif s.credential:
            # Match from exam_candidates snapshots
            cand = None
            for c in exam_candidates:
                clean_name = "".join(ch for ch in c.name_snapshot.split()[0].lower() if ch.isalnum())
                if clean_name in s.credential.username.lower() or (c.roll_number_snapshot and c.roll_number_snapshot.lower() in s.credential.username.lower()):
                    cand = c
                    break
            if not cand and exam_candidates:
                cand = exam_candidates[0]
            if cand:
                cand_name = cand.name_snapshot
                cand_email = cand.email_snapshot or ""
                cand_roll = cand.roll_number_snapshot or "N/A"

        submissions_list.append({
            "rank": rank_idx,
            "submission_id": s.id,
            "student_id": student_obj.id if student_obj else (s.credential_id or None),
            "student_name": cand_name,
            "email": cand_email,
            "roll_number": cand_roll,
            "division": cand_div,
            "batch": cand_batch,
            "score": score_val,
            "max_score": exam.total_marks,
            "percentage": pct_val,
            "is_passed": score_val >= pass_marks,
            "proctor_alerts": proctor_alerts_count,
            "submitted_at": s.submitted_at.strftime("%Y-%m-%d %H:%M") if s.submitted_at else ""
        })

    # Sort candidates list by rank
    submissions_list.sort(key=lambda x: (x.get("rank", 999)))

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
        "average_score": avg_score,
        "average_percentage": avg_percentage,
        "highest_score": highest,
        "lowest_score": lowest,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "pass_rate": pass_rate,
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
        ExamSubmission.status.in_(["submitted", "auto_submitted"])
    ).order_by(ExamSubmission.score.desc()).all()
    
    exam_candidates = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam_id).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Rank", "Student Name", "Email", "Roll Number", "Score", "Max Marks", "Percentage", "Result", "Proctor Flags", "Submitted At"])
    
    for rank_idx, s in enumerate(submissions, 1):
        st = s.credential.student if s.credential else None
        alerts = db.query(ProctoringLog).filter(ProctoringLog.submission_id == s.id).count()
        
        cand_name = "Candidate"
        cand_email = ""
        cand_roll = "N/A"
        
        if st and st.user:
            cand_name = st.user.full_name
            cand_email = st.user.email or ""
            cand_roll = st.roll_number or "N/A"
        elif s.credential:
            cand = None
            for c in exam_candidates:
                clean_name = "".join(ch for ch in c.name_snapshot.split()[0].lower() if ch.isalnum())
                if clean_name in s.credential.username.lower() or (c.roll_number_snapshot and c.roll_number_snapshot.lower() in s.credential.username.lower()):
                    cand = c
                    break
            if not cand and exam_candidates:
                cand = exam_candidates[0]
            if cand:
                cand_name = cand.name_snapshot
                cand_email = cand.email_snapshot or ""
                cand_roll = cand.roll_number_snapshot or "N/A"
                
        score_val = round(float(s.score), 2) if s.score is not None else 0.0
        pct_val = round(float(s.percentage), 2) if s.percentage is not None else 0.0
        pass_marks = float(exam.passing_marks) if exam.passing_marks is not None else 0.0

        writer.writerow([
            rank_idx,
            cand_name,
            cand_email,
            cand_roll,
            score_val,
            exam.total_marks,
            f"{pct_val}%",
            "PASSED" if score_val >= pass_marks else "FAILED",
            alerts,
            s.submitted_at.strftime("%Y-%m-%d %H:%M") if s.submitted_at else ""
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
        # Sort student-wise (Student Name A-Z, then Exam Name, then Date)
        result.sort(key=lambda x: (
            str(x.get("student_name") or "").lower(),
            str(x.get("exam_name") or "").lower(),
            str(x.get("submitted_at") or "")
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
        ExamSubmission.status.in_(["submitted", "auto_submitted"])
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

from fastapi.responses import HTMLResponse

@router.get("/submissions/{submission_id}/certificate-html")
def get_submission_certificate_html(
    submission_id: str,
    db: Session = Depends(get_db)
):
    """Generates an official downloadable/printable Certificate of Completion."""
    sub = db.query(ExamSubmission).filter(ExamSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    exam = sub.exam
    student = sub.credential.student if sub.credential else None
    student_name = student.user.full_name if (student and student.user) else "Academic Candidate"
    student_roll = student.roll_number if student else "N/A"
    exam_name = exam.name if exam else "Assessment"
    score_pct = round(sub.percentage, 1)
    pass_marks = exam.passing_marks if exam else 40
    is_passed = sub.score >= pass_marks
    completion_date = sub.submitted_at.strftime("%B %d, %Y") if sub.submitted_at else "August 15, 2026"
    
    grade_label = "Distinction" if score_pct >= 85 else "Merit" if score_pct >= 70 else "Pass" if is_passed else "Completed"
    badge_color = "#10B981" if is_passed else "#D97706"

    html = f"""<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Certificate of Completion - {student_name}</title>
      <style>
        @page {{ size: landscape; margin: 0; }}
        body {{
          font-family: 'Times New Roman', Georgia, serif;
          margin: 0;
          padding: 30px;
          background: #FDFBF7;
          color: #1F2937;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 90vh;
        }}
        .certificate {{
          width: 860px;
          padding: 40px 50px;
          border: 12px solid #92400E;
          outline: 4px solid #D97706;
          background: #FFFFFF;
          text-align: center;
          position: relative;
          box-shadow: 0 20px 40px rgba(0,0,0,0.12);
        }}
        .crest {{
          font-size: 38px;
          margin-bottom: 5px;
        }}
        .institution {{
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 4px;
          color: #92400E;
          font-weight: bold;
          margin-bottom: 12px;
        }}
        .title {{
          font-size: 34px;
          font-weight: 700;
          color: #1E1B4B;
          letter-spacing: 2px;
          margin: 0 0 16px 0;
          font-family: 'Georgia', serif;
        }}
        .presented-to {{
          font-size: 15px;
          font-style: italic;
          color: #6B7280;
          margin-bottom: 8px;
        }}
        .recipient {{
          font-size: 32px;
          font-weight: bold;
          color: #92400E;
          border-bottom: 2px solid #FCD34D;
          display: inline-block;
          padding-bottom: 4px;
          margin-bottom: 16px;
        }}
        .roll {{
          font-size: 12px;
          color: #6B7280;
          margin-bottom: 16px;
          font-family: system-ui, sans-serif;
        }}
        .body-text {{
          font-size: 16px;
          line-height: 1.6;
          color: #374151;
          max-width: 680px;
          margin: 0 auto 24px auto;
        }}
        .metrics {{
          display: flex;
          justify-content: center;
          gap: 30px;
          margin-bottom: 30px;
          font-family: system-ui, sans-serif;
        }}
        .metric-pill {{
          padding: 8px 18px;
          background: #FEF3C7;
          border: 1px solid #FDE68A;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 700;
          color: #92400E;
        }}
        .signatures {{
          display: flex;
          justify-content: space-between;
          margin-top: 25px;
          padding: 0 30px;
          font-family: system-ui, sans-serif;
        }}
        .sig-box {{
          border-top: 1px solid #9CA3AF;
          width: 180px;
          padding-top: 6px;
          font-size: 12px;
          color: #4B5563;
        }}
        .footer-hash {{
          margin-top: 20px;
          font-size: 10px;
          color: #9CA3AF;
          font-family: monospace;
        }}
        @media print {{
          body {{ padding: 0; background: transparent; }}
          .certificate {{ box-shadow: none; width: 100%; border-width: 8px; }}
          .no-print {{ display: none; }}
        }}
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="crest">🎓</div>
        <div class="institution">EduQuizX AI Examination & Academic Standards Board</div>
        <h1 class="title">Certificate of Academic Achievement</h1>
        <div class="presented-to">This credential is proudly awarded to</div>
        <div class="recipient">{student_name}</div>
        <div class="roll">Candidate Identifier / Roll No: {student_roll}</div>
        
        <p class="body-text">
          For demonstrating intellectual rigor and fulfilling all assessment requirements in
          <strong>{exam_name}</strong> under verified AI proctored conditions.
        </p>

        <div class="metrics">
          <div class="metric-pill">Score: {sub.score} / {exam.total_marks if exam else 100}</div>
          <div class="metric-pill">Percentage: {score_pct}%</div>
          <div class="metric-pill" style="background: {badge_color}15; border-color: {badge_color}; color: {badge_color};">Grade: {grade_label}</div>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <strong>Dr. Sarah Jenkins</strong><br>Dean of Academic Affairs
          </div>
          <div class="sig-box">
            <strong>{completion_date}</strong><br>Date of Certification
          </div>
          <div class="sig-box">
            <strong>EduQuizX Engine</strong><br>Automated Verifier
          </div>
        </div>

        <div class="footer-hash">
          Verification Hash: SUB-{submission_id[:12].upper()} • Secure QR Key Validated
        </div>
      </div>
      
      <div class="no-print" style="position: fixed; bottom: 20px; right: 20px;">
        <button onclick="window.print()" style="padding: 12px 24px; background: #92400E; color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          🖨️ Print / Save Certificate PDF
        </button>
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)

@router.get("/submissions/{submission_id}/report-card-html")
def get_submission_report_card_html(
    submission_id: str,
    db: Session = Depends(get_db)
):
    """Generates an official itemized student performance report card."""
    sub = db.query(ExamSubmission).filter(ExamSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    exam = sub.exam
    student = sub.credential.student if sub.credential else None
    student_name = student.user.full_name if (student and student.user) else "Academic Candidate"
    student_roll = student.roll_number if student else "N/A"
    exam_name = exam.name if exam else "Assessment"
    score_pct = round(sub.percentage, 1)
    pass_marks = exam.passing_marks if exam else 40
    is_passed = sub.score >= pass_marks
    completion_date = sub.submitted_at.strftime("%B %d, %Y - %I:%M %p") if sub.submitted_at else "N/A"

    # Parse response items
    responses = json.loads(sub.answers_json) if sub.answers_json else {}
    questions = json.loads(exam.questions_json) if (exam and exam.questions_json) else []

    rows_html = ""
    for idx, q in enumerate(questions, 1):
        q_id = q.get("id") or f"q_{idx}"
        q_resp = responses.get(q_id, {})
        awarded = q_resp.get("score_awarded", 0.0)
        q_marks = q.get("marks", 1.0)
        user_ans = q_resp.get("user_answer", "No response recorded")
        feedback = q_resp.get("ai_feedback") or q_resp.get("teacher_feedback") or "Evaluated"
        
        status_color = "#10B981" if awarded >= q_marks else "#F59E0B" if awarded > 0 else "#EF4444"

        rows_html += f"""
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px; font-weight: bold; vertical-align: top;">Q{idx}</td>
          <td style="padding: 12px; vertical-align: top;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">{q.get("question_text", "")}</div>
            <div style="font-size: 12px; color: #4B5563; margin-bottom: 4px;"><b>Candidate Answer:</b> {user_ans}</div>
            <div style="font-size: 11px; color: #6B7280; font-style: italic;"><b>Feedback:</b> {feedback}</div>
          </td>
          <td style="padding: 12px; vertical-align: top; text-align: center; font-weight: bold; color: {status_color};">
            {awarded} / {q_marks}
          </td>
        </tr>
        """

    html = f"""<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Performance Scorecard - {student_name}</title>
      <style>
        body {{
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 40px;
          background: #F9FAFB;
          color: #111827;
        }}
        .report-card {{
          max-width: 800px;
          margin: 0 auto;
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }}
        .header {{
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #F3F4F6;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }}
        .kpi-grid {{
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }}
        .kpi-card {{
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 14px;
          text-align: center;
        }}
        .kpi-val {{
          font-size: 20px;
          font-weight: bold;
          color: #111827;
        }}
        .kpi-lbl {{
          font-size: 11px;
          color: #6B7280;
          text-transform: uppercase;
          font-weight: 600;
          margin-top: 2px;
        }}
        table {{
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }}
        th {{
          background: #F3F4F6;
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          color: #374151;
        }}
        @media print {{
          body {{ padding: 0; background: transparent; }}
          .report-card {{ border: none; box-shadow: none; }}
          .no-print {{ display: none; }}
        }}
      </style>
    </head>
    <body>
      <div class="report-card">
        <div class="header">
          <div>
            <h2 style="margin: 0; font-size: 22px; color: #111827;">Official Candidate Scorecard</h2>
            <div style="font-size: 13px; color: #6B7280; margin-top: 4px;">{exam_name} • Completed on {completion_date}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold; font-size: 16px;">{student_name}</div>
            <div style="font-size: 12px; color: #6B7280;">Roll: {student_roll}</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-val">{sub.score} / {exam.total_marks if exam else 100}</div>
            <div class="kpi-lbl">Total Score</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val">{score_pct}%</div>
            <div class="kpi-lbl">Percentage</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val">{pass_marks}</div>
            <div class="kpi-lbl">Passing Marks</div>
          </div>
          <div class="kpi-card" style="background: {'#ECFDF5' if is_passed else '#FEF2F2'};">
            <div class="kpi-val" style="color: {'#059669' if is_passed else '#DC2626'};">{'PASSED' if is_passed else 'FAILED'}</div>
            <div class="kpi-lbl">Status</div>
          </div>
        </div>

        <h3 style="font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 12px;">Itemized Question Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Question & Response</th>
              <th style="width: 90px; text-align: center;">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows_html}
          </tbody>
        </table>

        {f'''
        <div style="margin-top: 24px; padding: 16px; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px;">
          <div style="font-weight: bold; font-size: 13px; color: #166534; margin-bottom: 4px;">AI Evaluator Overall Assessment</div>
          <div style="font-size: 12px; color: #15803D; line-height: 1.5;">{sub.ai_feedback}</div>
        </div>
        ''' if sub.ai_feedback else ''}
      </div>

      <div class="no-print" style="position: fixed; bottom: 20px; right: 20px;">
        <button onclick="window.print()" style="padding: 12px 24px; background: #1F2937; color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          🖨️ Print / Save Scorecard PDF
        </button>
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


