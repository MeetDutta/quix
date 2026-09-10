import pytest
import datetime
import uuid
import json
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam, ExamCredential, ExamSubmission, AuditLog
from app.models.candidate import ExamCandidate
from app.models.workspace import Workspace
from app.utils.security import create_access_token
from app.utils.timezone import now_utc
from app.api.attempts import process_exam_submission

def setup_candidate_and_submission(db: Session, suffix: str = "R1"):
    teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
    ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()

    directory = StudentDirectory(
        workspace_id=ws.id,
        name=f"Reattempt Directory {suffix}",
        created_by=teacher.id
    )
    db.add(directory)
    db.flush()

    s = DirectoryStudent(
        directory_id=directory.id,
        name=f"Candidate {suffix}",
        email=f"cand_{suffix}_{uuid.uuid4().hex[:6]}@aegeus.edu",
        roll_number=f"ROLL-{suffix}",
        status="active"
    )
    db.add(s)
    db.flush()

    now_dt = now_utc()
    exam = Exam(
        name=f"Reattempt Assessment {suffix}",
        exam_code=f"REA-{suffix}-{uuid.uuid4().hex[:4].upper()}",
        subject_id="cs_101",
        student_directory_id=directory.id,
        duration_minutes=60,
        total_marks=20,
        passing_marks=10,
        start_time=now_dt - datetime.timedelta(minutes=10),
        end_time=now_dt + datetime.timedelta(hours=2),
        created_by=teacher.id,
        workspace_id=ws.id,
        is_published=True,
        questions_json=json.dumps([
            {"id": "q1", "type": "mcq", "question_text": "2+2?", "options": ["3", "4"], "correct_answer": "4", "marks": 10},
            {"id": "q2", "type": "mcq", "question_text": "3+3?", "options": ["6", "7"], "correct_answer": "6", "marks": 10}
        ])
    )
    db.add(exam)
    db.flush()

    cand = ExamCandidate(
        exam_id=exam.id,
        directory_student_id=s.id,
        name_snapshot=s.name,
        email_snapshot=s.email,
        roll_number_snapshot=s.roll_number
    )
    db.add(cand)
    db.flush()

    cred = ExamCredential(
        exam_id=exam.id,
        candidate_id=cand.id,
        username=f"U_{cand.id[:8]}",
        password="testpassword",
        expires_at=exam.end_time
    )
    db.add(cred)
    db.flush()

    sub1 = ExamSubmission(
        exam_id=exam.id,
        candidate_id=cand.id,
        credential_id=cred.id,
        attempt_number=1,
        is_counted_for_result=True,
        status="started",
        started_at=now_dt - datetime.timedelta(minutes=15),
        deadline_at=now_dt + datetime.timedelta(minutes=45),
        tab_switch_count=0,
        answers_json=json.dumps({"q1": "4"}),
        questions_snapshot_json=exam.questions_json
    )
    db.add(sub1)
    db.commit()

    return teacher, exam, cand, cred, sub1

@pytest.mark.anyio
async def test_reattempt_strict_eligibility(client, teacher_auth):
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    teacher, exam, cand, cred, sub1 = setup_candidate_and_submission(db, "ELIG1")

    # Case 1: In progress -> Rejected
    res = await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth)
    assert res.status_code in [400, 409]
    assert "active attempt" in res.json()["detail"].lower()

    # Case 2: Normal submission -> Rejected
    sub1.status = "submitted"
    db.commit()
    res = await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth)
    assert res.status_code == 400
    assert "auto-submitted" in res.json()["detail"].lower()

    # Case 3: Auto-submitted for TIME_EXPIRED -> Rejected
    sub1.status = "auto_submitted"
    sub1.auto_submit_reason = "TIME_EXPIRED"
    sub1.tab_switch_count = 0
    db.commit()
    res = await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth)
    assert res.status_code == 400
    assert "tab switch" in res.json()["detail"].lower()

    # Case 4: Auto-submitted for TAB_SWITCH but strike count < 2 -> Rejected
    sub1.auto_submit_reason = "TAB_SWITCH"
    sub1.tab_switch_count = 1
    db.commit()
    res = await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth)
    assert res.status_code == 400
    assert "tab switch" in res.json()["detail"].lower()

    # Case 5: Fully eligible -> auto_submitted + TAB_SWITCH + strike count >= 2
    sub1.tab_switch_count = 2
    process_exam_submission(sub1, db, auto_submitted=True, auto_submit_reason="TAB_SWITCH")
    db.commit()

    res = await client.post(
        f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt",
        json={"reason": "Accidental switch"},
        headers=teacher_auth
    )
    assert res.status_code == 200
    data = res.json()
    assert data["attempt_number"] == 2
    assert "successfully authorized" in data["message"].lower()

@pytest.mark.anyio
async def test_attempt_1_immutability_and_attempt_2_freshness(client, teacher_auth):
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    teacher, exam, cand, cred, sub1 = setup_candidate_and_submission(db, "IMMUT1")

    # Simulate sub1 auto-submission with score
    sub1.tab_switch_count = 2
    sub1.answers_json = json.dumps({"q1": "4"})
    process_exam_submission(sub1, db, auto_submitted=True, auto_submit_reason="TAB_SWITCH")
    db.commit()
    
    sub1_id = sub1.id
    sub1_score = sub1.score
    sub1_submitted_at = sub1.submitted_at

    # Grant reattempt
    res = await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth)
    assert res.status_code == 200

    # Query both submissions
    db.expire_all()
    subs = db.query(ExamSubmission).filter(
        ExamSubmission.candidate_id == cand.id
    ).order_by(ExamSubmission.attempt_number.asc()).all()

    assert len(subs) == 2
    att1, att2 = subs[0], subs[1]

    # Verify Attempt 1 remains completely intact
    assert att1.id == sub1_id
    assert att1.attempt_number == 1
    assert att1.status == "auto_submitted"
    assert att1.auto_submit_reason == "TAB_SWITCH"
    assert att1.tab_switch_count == 2
    assert att1.score == sub1_score
    assert att1.submitted_at == sub1_submitted_at
    assert att1.is_counted_for_result is True  # Attempt 1 remains official result initially

    # Verify Attempt 2 is fresh
    assert att2.attempt_number == 2
    assert att2.status == "started"
    assert att2.tab_switch_count == 0
    assert att2.answers_json == "{}"
    assert att2.score in [None, 0.0]
    assert att2.submitted_at is None
    assert att2.is_counted_for_result is False
    assert att2.reopened_from_id == att1.id
    assert att2.reattempt_granted_by == teacher.id

    # Verify AuditLog
    log = db.query(AuditLog).filter(
        AuditLog.action == "REATTEMPT_GRANTED",
        AuditLog.user_id == teacher.id
    ).order_by(AuditLog.timestamp.desc()).first()
    assert log is not None
    details = json.loads(log.details)
    assert details["candidate_id"] == cand.id
    assert details["attempt_number"] == 2

@pytest.mark.anyio
async def test_max_reattempts_limit_enforced(client, teacher_auth):
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    teacher, exam, cand, cred, sub1 = setup_candidate_and_submission(db, "MAX1")

    # Auto-submit sub1
    sub1.tab_switch_count = 2
    process_exam_submission(sub1, db, auto_submitted=True, auto_submit_reason="TAB_SWITCH")
    db.commit()

    # Grant Attempt 2
    res2 = await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth)
    assert res2.status_code == 200

    # Auto-submit Attempt 2 as well
    db.expire_all()
    sub2 = db.query(ExamSubmission).filter(
        ExamSubmission.candidate_id == cand.id,
        ExamSubmission.attempt_number == 2
    ).first()
    sub2.tab_switch_count = 2
    process_exam_submission(sub2, db, auto_submitted=True, auto_submit_reason="TAB_SWITCH")
    db.commit()

    # Attempt to grant Attempt 3 without admin_override -> MUST FAIL
    res3 = await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth)
    assert res3.status_code == 400
    assert "maximum allowed reattempts" in res3.json()["detail"].lower()

    # Super admin with admin_override
    admin_teacher = db.query(User).filter(User.role == "super_admin").first()
    if not admin_teacher:
        admin_teacher = teacher
        admin_teacher.role = "super_admin"
        db.commit()
    admin_token = create_access_token(subject=admin_teacher.id)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    res3_admin = await client.post(
        f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt",
        json={"admin_override": True, "reason": "Authorized by director"},
        headers=admin_headers
    )
    assert res3_admin.status_code == 200
    assert res3_admin.json()["attempt_number"] == 3

@pytest.mark.anyio
async def test_select_result_attempt(client, teacher_auth):
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    teacher, exam, cand, cred, sub1 = setup_candidate_and_submission(db, "SEL1")

    # Setup Attempt 1 with score 10
    sub1.tab_switch_count = 2
    sub1.answers_json = json.dumps({"q1": "4"})
    process_exam_submission(sub1, db, auto_submitted=True, auto_submit_reason="TAB_SWITCH")
    db.commit()

    # Grant Attempt 2
    await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth)
    db.expire_all()
    sub2 = db.query(ExamSubmission).filter(
        ExamSubmission.candidate_id == cand.id,
        ExamSubmission.attempt_number == 2
    ).first()

    # Student completes Attempt 2 with perfect score 20
    sub2.answers_json = json.dumps({"q1": "4", "q2": "6"})
    process_exam_submission(sub2, db, auto_submitted=False)
    db.commit()

    assert sub1.is_counted_for_result is True
    assert sub2.is_counted_for_result is False

    # Teacher promotes Attempt 2 as the official result
    res = await client.post(
        f"/api/v1/exams/{exam.id}/candidates/{cand.id}/select-result-attempt",
        json={"attempt_number": 2, "notes": "Candidate completed legitimate Attempt 2"},
        headers=teacher_auth
    )
    assert res.status_code == 200
    assert "Attempt #2 is now the designated official result" in res.json()["message"]

    db.expire_all()
    sub1_refreshed = db.query(ExamSubmission).filter(ExamSubmission.id == sub1.id).first()
    sub2_refreshed = db.query(ExamSubmission).filter(ExamSubmission.id == sub2.id).first()
    assert sub1_refreshed.is_counted_for_result is False
    assert sub2_refreshed.is_counted_for_result is True

    # Check AuditLog
    log = db.query(AuditLog).filter(
        AuditLog.action == "FINAL_RESULT_ATTEMPT_SELECTED",
        AuditLog.user_id == teacher.id
    ).order_by(AuditLog.timestamp.desc()).first()
    assert log is not None
    details = json.loads(log.details)
    assert details["selected_attempt_number"] == 2
    assert details["candidate_id"] == cand.id
