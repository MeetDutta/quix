import pytest
import time
import json
from datetime import datetime, timedelta
from unittest.mock import patch

from app.main import app
from app.models.exam import Exam, ExamCredential, ExamSubmission, ProctoringLog
from app.models.candidate import ExamCandidate
from app.models.user import User, Student
from app.models.workspace import Workspace, WorkspaceMember
from tests.conftest import TestingSessionLocal

@pytest.mark.anyio
async def test_stale_autosave_overwriting_newer_answers(client, teacher_auth):
    """Ensure older, delayed autosave packets cannot overwrite newer client answers."""
    now = datetime.utcnow()
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Stale Autosave Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_data = exam_res.json()
    exam_code = exam_data["exam_code"]
    exam_id = exam_data["id"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    # Register student & start exam
    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"stale_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Autosave Tester",
        "role": "student"
    })
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    session_token = start_res.json()["token"]
    session_headers = {"Authorization": f"Bearer {session_token}"}

    # Step 1: Save newer response at t=2000
    res_newer = await client.post("/api/v1/attempts/save-progress", headers=session_headers, json={
        "q1": "New Valid Answer",
        "_client_timestamp": 2000
    })
    assert res_newer.status_code == 200
    assert not res_newer.json().get("discarded", False)

    # Step 2: Delayed older packet arrives with t=1000
    res_older = await client.post("/api/v1/attempts/save-progress", headers=session_headers, json={
        "q1": "Old Stale Overwrite Attempt",
        "_client_timestamp": 1000
    })
    assert res_older.status_code == 200
    assert res_older.json().get("discarded") is True

    # Step 3: Verify server retained "New Valid Answer"
    info_res = await client.get("/api/v1/attempts/exam-info", headers=session_headers)
    assert info_res.status_code == 200
    saved = info_res.json()["saved_answers"]
    assert saved.get("q1") == "New Valid Answer"

@pytest.mark.anyio
async def test_submitting_and_saving_after_deadline(client, teacher_auth):
    """Ensure answers cannot be submitted or saved after the exam deadline passes."""
    now = datetime.utcnow()
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Deadline Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 1,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=10)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_data = exam_res.json()
    exam_code = exam_data["exam_code"]
    exam_id = exam_data["id"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"deadline_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Deadline Tester",
        "role": "student"
    })
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    session_token = start_res.json()["token"]
    session_headers = {"Authorization": f"Bearer {session_token}"}

    # Save initial legitimate answer before deadline
    await client.post("/api/v1/attempts/save-progress", headers=session_headers, json={
        "q1": "On-Time Legitimate Answer",
        "_client_timestamp": 500
    })

    # Manually expire the deadline in DB to simulate deadline passing
    db = TestingSessionLocal()
    try:
        sub = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).first()
        sub.deadline_at = datetime.utcnow() - timedelta(minutes=2)
        db.commit()
    finally:
        db.close()

    # Attempt post-deadline /save-progress with injected answer
    save_late = await client.post("/api/v1/attempts/save-progress", headers=session_headers, json={
        "q1": "Injected Post-Deadline Answer",
        "_client_timestamp": 99999
    })
    # Late save triggers auto_submitted and rejects injection
    assert save_late.status_code == 200
    assert save_late.json()["status"] == "auto_submitted"

    # Verify that the evaluated answer was the legitimate on-time answer, NOT the injected one
    db = TestingSessionLocal()
    try:
        sub = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).first()
        assert sub.status == "auto_submitted"
        answers = json.loads(sub.answers_json) if sub.answers_json else {}
        # Legitimate on-time answer preserved
        assert "On-Time Legitimate Answer" in str(answers)
        assert "Injected Post-Deadline Answer" not in str(answers)
    finally:
        db.close()

@pytest.mark.anyio
async def test_modifying_answers_after_submission(client, teacher_auth):
    """Ensure students cannot modify answers once the exam is submitted."""
    now = datetime.utcnow()
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Locking Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_data = exam_res.json()
    exam_code = exam_data["exam_code"]
    exam_id = exam_data["id"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"locked_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Lock Tester",
        "role": "student"
    })
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    session_token = start_res.json()["token"]
    session_headers = {"Authorization": f"Bearer {session_token}"}

    # Submit exam
    sub_res = await client.post("/api/v1/attempts/submit", headers=session_headers, json={
        "answers": {"q1": "Final Answer"}
    })
    assert sub_res.status_code == 200

    # Attempt to save progress after submission -> Must fail with HTTP 400
    save_after = await client.post("/api/v1/attempts/save-progress", headers=session_headers, json={
        "q1": "Tampered Answer"
    })
    assert save_after.status_code == 400
    assert "cannot save progress on submitted exam" in save_after.json()["detail"].lower()

@pytest.mark.anyio
async def test_unauthorized_cross_workspace_access(client):
    """Ensure Teacher B cannot monitor, extend, export, or override grades for Teacher A's exams."""
    # Teacher A creates exam
    res_a = await client.post("/api/v1/auth/register", json={
        "email": f"teacher_a_{int(time.time())}@aegeus.edu",
        "password": "Password123!",
        "full_name": "Teacher A",
        "role": "teacher"
    })
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    now = datetime.utcnow()
    exam_res = await client.post("/api/v1/exams/", headers=headers_a, json={
        "name": "Teacher A Private Exam",
        "subject_id": "cs_101",
        "duration_minutes": 45,
        "total_marks": 50.0,
        "passing_marks": 25.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    assert exam_res.status_code == 200
    exam_id = exam_res.json()["id"]

    # Teacher B registers in a different workspace
    res_b = await client.post("/api/v1/auth/register", json={
        "email": f"teacher_b_{int(time.time())}@aegeus.edu",
        "password": "Password123!",
        "full_name": "Teacher B",
        "role": "teacher"
    })
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. Teacher B tries to access live monitor of Teacher A's exam
    mon_res = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=headers_b)
    assert mon_res.status_code == 403

    # 2. Teacher B tries to extend time on Teacher A's exam
    ext_res = await client.post(f"/api/v1/exams/{exam_id}/extend-time", headers=headers_b, json={"extra_minutes": 15})
    assert ext_res.status_code == 403

    # 3. Teacher B tries to view answer key for Teacher A's exam
    ans_key_res = await client.get(f"/api/v1/exams/{exam_id}/pdf/answer-key", headers=headers_b)
    assert ans_key_res.status_code == 403

    # 4. Teacher B tries to view question paper for Teacher A's exam
    qp_res = await client.get(f"/api/v1/exams/{exam_id}/pdf/question-paper", headers=headers_b)
    assert qp_res.status_code == 403

@pytest.mark.anyio
async def test_score_manipulation_prevented(client, teacher_auth):
    """Ensure manual grade overrides cannot set negative marks or marks exceeding the question limit."""
    # Create and start exam
    now = datetime.utcnow()
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Score Bounds Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_data = exam_res.json()
    exam_id = exam_data["id"]
    exam_code = exam_data["exam_code"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"score_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Score Tester",
        "role": "student"
    })
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    sub_id = start_res.json()["submission_id"]
    session_token = start_res.json()["token"]
    session_headers = {"Authorization": f"Bearer {session_token}"}

    # Submit exam
    await client.post("/api/v1/attempts/submit", headers=session_headers, json={"answers": {}})

    # Attempt override with negative score -> HTTP 400
    neg_res = await client.put(f"/api/v1/reports/submission-detail/{sub_id}/override-grade", headers=teacher_auth, json={
        "q_id": "0",
        "new_score": -10.0,
        "teacher_feedback": "Penalty"
    })
    assert neg_res.status_code == 400

    # Attempt override with exorbitant score (99999.0) -> HTTP 400
    exorb_res = await client.put(f"/api/v1/reports/submission-detail/{sub_id}/override-grade", headers=teacher_auth, json={
        "q_id": "0",
        "new_score": 99999.0,
        "teacher_feedback": "Hacked points"
    })
    assert exorb_res.status_code == 400

@pytest.mark.anyio
async def test_extending_duration_bounds(client, teacher_auth):
    """Verify that extra_minutes outside [1, 180] are rejected."""
    now = datetime.utcnow()
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Duration Limit Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    assert exam_res.status_code == 200
    exam_id = exam_res.json()["id"]

    # 0 minutes -> 400 or 422 rejected
    res_zero = await client.post(f"/api/v1/exams/{exam_id}/extend-time", headers=teacher_auth, json={"extra_minutes": 0})
    assert res_zero.status_code in [400, 422]

    # 300 minutes -> 400 or 422 rejected
    res_excessive = await client.post(f"/api/v1/exams/{exam_id}/extend-time", headers=teacher_auth, json={"extra_minutes": 300})
    assert res_excessive.status_code in [400, 422]

    # Valid 15 minutes -> 200
    res_valid = await client.post(f"/api/v1/exams/{exam_id}/extend-time", headers=teacher_auth, json={"extra_minutes": 15})
    assert res_valid.status_code == 200
    assert res_valid.json()["duration_minutes"] == 45

@pytest.mark.anyio
async def test_duplicate_document_ingestion(client, teacher_auth):
    """Verify that uploading the exact same document twice in the same workspace is rejected."""
    content = b"Unique Document Content For Duplicate Ingestion Test " + str(time.time()).encode()
    
    # Upload 1 -> 200
    up1 = await client.post(
        "/api/v1/kb/upload",
        headers=teacher_auth,
        data={"subject_id": "cs_101"},
        files={"file": ("test_doc.txt", content, "text/plain")}
    )
    assert up1.status_code == 200

    # Upload 2 -> 400 (duplicate hash in workspace)
    up2 = await client.post(
        "/api/v1/kb/upload",
        headers=teacher_auth,
        data={"subject_id": "cs_101"},
        files={"file": ("test_doc.txt", content, "text/plain")}
    )
    assert up2.status_code == 400
    assert "already been uploaded" in up2.json()["detail"].lower()

@pytest.mark.anyio
async def test_network_loss_at_exact_deadline_auto_sweep(client, teacher_auth):
    """Verify that when a student's network fails at the deadline, the server cleanly sweeps to auto_submitted."""
    now = datetime.utcnow()
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Network Loss At Deadline Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_data = exam_res.json()
    exam_id = exam_data["id"]
    exam_code = exam_data["exam_code"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"netloss_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Netloss Student",
        "role": "student"
    })
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    session_token = start_res.json()["token"]
    session_headers = {"Authorization": f"Bearer {session_token}"}

    # Student answered question 0, then connection abruptly dropped
    await client.post("/api/v1/attempts/save-progress", headers=session_headers, json={
        "0": "A",
        "_client_timestamp": 100
    })

    # Deadline passes while student is disconnected
    db = TestingSessionLocal()
    try:
        sub = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).first()
        sub.deadline_at = datetime.utcnow() - timedelta(seconds=10)
        db.commit()
    finally:
        db.close()

    # Teacher accesses the class exam report
    rep_res = await client.get(f"/api/v1/reports/exam/{exam_id}", headers=teacher_auth)
    assert rep_res.status_code == 200
    rep_data = rep_res.json()

    # Verify student is counted in attendance (not marked absent) and marked auto_submitted
    assert rep_data["attended_count"] == 1
    assert rep_data["absent_count"] == 0

    # Also verify in database
    db = TestingSessionLocal()
    try:
        sub = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).first()
        assert sub.status == "auto_submitted"
        assert sub.submitted_at is not None
    finally:
        db.close()

@pytest.mark.anyio
async def test_ai_failure_gemini_429_graceful_handling(client, teacher_auth):
    """Ensure Gemini 429 / timeouts do not crash submission or award fake points."""
    now = datetime.utcnow()
    # Create exam with a subjective question
    q_subjective = [{
        "id": "q_sub_1",
        "question_text": "Explain CAP theorem and its trade-offs.",
        "question_type": "subjective",
        "marks": 5.0,
        "correct_answer": "Consistency, Availability, Partition tolerance trade-offs."
    }]
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "AI Resilience Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 5.0,
        "passing_marks": 2,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    assert exam_res.status_code == 200, exam_res.text
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]

    db = TestingSessionLocal()
    try:
        ex = db.query(Exam).filter(Exam.id == exam_id).first()
        ex.questions_json = json.dumps(q_subjective)
        db.commit()
    finally:
        db.close()

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"ai_fail_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "AI Fail Tester",
        "role": "student"
    })
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    session_token = start_res.json()["token"]
    session_headers = {"Authorization": f"Bearer {session_token}"}

    # Simulate Gemini 429 / rate limit / timeout exception
    with patch("app.services.ai_service.AIService.evaluate_subjective_answer", side_effect=RuntimeError("ResourceExhausted: 429 Quota Exceeded")):
        sub_res = await client.post("/api/v1/attempts/submit", headers=session_headers, json={
            "answers": {"q_sub_1": "In distributed systems you can only pick two of three."}
        })
        # Should not crash (HTTP 200)
        assert sub_res.status_code == 200
        sub_data = sub_res.json()
        assert sub_data["status"] == "submitted"
        # Must NOT award fake marks
        assert sub_data["score"] == 0.0
        assert sub_data["evaluated_answers"]["q_sub_1"]["score_awarded"] == 0.0
        assert "pending instructor manual review" in sub_data["evaluated_answers"]["q_sub_1"]["ai_feedback"].lower()

@pytest.mark.anyio
async def test_accessing_another_students_submission_and_certificate(client, teacher_auth):
    """Ensure Student B cannot view or download Student A's submission details, report cards, or certificates."""
    now = datetime.utcnow()
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Student Privacy Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_data = exam_res.json()
    exam_id = exam_data["id"]
    exam_code = exam_data["exam_code"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    # Student A starts and submits
    stu_a = await client.post("/api/v1/auth/register", json={
        "email": f"stu_a_priv_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Alice Privacy",
        "role": "student"
    })
    tok_a = stu_a.json()["access_token"]
    head_a = {"Authorization": f"Bearer {tok_a}"}

    start_a = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=head_a)
    sub_a_id = start_a.json()["submission_id"]
    sess_a_tok = start_a.json()["token"]
    await client.post("/api/v1/attempts/submit", headers={"Authorization": f"Bearer {sess_a_tok}"}, json={"answers": {}})

    # Student B registers
    stu_b = await client.post("/api/v1/auth/register", json={
        "email": f"stu_b_priv_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Bob Snoop",
        "role": "student"
    })
    tok_b = stu_b.json()["access_token"]
    head_b = {"Authorization": f"Bearer {tok_b}"}

    # Student B attempts to access Alice's submission detail
    res_detail = await client.get(f"/api/v1/reports/submission-detail/{sub_a_id}", headers=head_b)
    assert res_detail.status_code == 403

    # Student B attempts to access Alice's printable report
    res_print = await client.get(f"/api/v1/reports/submission-detail/{sub_a_id}/printable", headers=head_b)
    assert res_print.status_code == 403

    # Student B attempts to access Alice's certificate
    res_cert = await client.get(f"/api/v1/reports/submissions/{sub_a_id}/certificate-html", headers=head_b)
    assert res_cert.status_code == 403

    # Student B attempts to access Alice's report card
    res_rc = await client.get(f"/api/v1/reports/submissions/{sub_a_id}/report-card-html", headers=head_b)
    assert res_rc.status_code == 403

@pytest.mark.anyio
async def test_direct_start_non_enrolled_student_blocked_with_403(client, teacher_auth):
    """Verify that an authenticated student who is NOT enrolled in an exam cannot enter via direct-start."""
    now = datetime.utcnow()
    # 1. Create directory with only Alice
    dir_res = await client.post("/api/v1/student-directories/", headers=teacher_auth, json={
        "name": "Single Student Roster"
    })
    dir_id = dir_res.json()["id"]

    await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_auth, json={
        "name": "Enrolled Alice",
        "email": "alice_enrolled@aegeus.edu",
        "roll_number": "ENROLLED-001"
    })

    # 2. Create exam linked to this directory
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Strict Enrolled Exam",
        "subject_id": "cs_101",
        "student_directory_id": dir_id,
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)
    await client.post(f"/api/v1/exams/{exam_id}/credentials", headers=teacher_auth)

    # 3. Non-enrolled student registers
    non_enrolled = await client.post("/api/v1/auth/register", json={
        "email": f"intruder_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Unenrolled Intruder",
        "role": "student"
    })
    tok = non_enrolled.json()["access_token"]

    # 4. Attempt direct-start knowing only the exam_code -> Must be blocked with 403
    ds_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers={"Authorization": f"Bearer {tok}"})
    assert ds_res.status_code == 403
    assert "not enrolled" in ds_res.json()["detail"].lower()
