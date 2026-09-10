import pytest
import time
import datetime
from datetime import timedelta, timezone
from unittest.mock import patch
import json

from app.models.exam import Exam, ExamCredential, ExamSubmission, ProctoringLog
from app.models.candidate import ExamCandidate
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.user import User, Student
from app.models.workspace import Workspace
from tests.conftest import TestingSessionLocal

# ==============================================================================
# PHASE 1 & 14: ELIMINATE ALL HEURISTIC IDENTITY MATCHING REGRESSION TESTS
# ==============================================================================

@pytest.mark.anyio
async def test_identity_matching_exact_fk_no_heuristics(client, teacher_auth):
    """
    PHASE 1 REGRESSION:
    CASE A: John Doe & John Smith enrolled in the same exam.
    CASE B: Identical first names (John Doe, John Smith, Johnathan Doe).
    CASE C: Similar usernames.
    CASE D: Names that are substrings of other names.
    Proves:
    - Every credential maps via direct Foreign Key: ExamCandidate.id -> ExamCredential.candidate_id
    - Export displays exact student
    - No substring matching occurs
    """
    now = datetime.datetime.now(timezone.utc)
    
    # Create directory with substring/similar names
    dir_res = await client.post("/api/v1/student-directories/", headers=teacher_auth, json={
        "name": "Heuristic Elimination Roster"
    })
    dir_id = dir_res.json()["id"]

    students_data = [
        ("John Doe", "john.doe@aegeus.edu", "ROLL-JD-01"),
        ("John Smith", "john.smith@aegeus.edu", "ROLL-JS-02"),
        ("John", "john.solo@aegeus.edu", "ROLL-J-03"),
        ("Johnathan Doe", "johnathan.doe@aegeus.edu", "ROLL-JHD-04"),
        ("Doe", "doe.only@aegeus.edu", "ROLL-D-05")
    ]
    for name, email, roll in students_data:
        await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_auth, json={
            "name": name,
            "email": email,
            "roll_number": roll
        })

    # Create and publish exam
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Strict Identity Exam",
        "subject_id": "cs_ident",
        "student_directory_id": dir_id,
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_id = exam_res.json()["id"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)
    creds_res = await client.post(f"/api/v1/exams/{exam_id}/credentials", headers=teacher_auth)
    assert creds_res.status_code == 200
    creds = creds_res.json()
    assert len(creds) == 5

    # Check that each credential maps to the EXACT candidate
    db = TestingSessionLocal()
    try:
        for c in creds:
            cred_row = db.query(ExamCredential).filter(ExamCredential.username == c["username"]).first()
            assert cred_row is not None
            assert cred_row.candidate_id is not None
            assert cred_row.candidate.name_snapshot == c["student_name"]
            assert cred_row.candidate.email_snapshot == c["email"]
    finally:
        db.close()

    # CSV Export verification: no crossed rows
    csv_res = await client.get(f"/api/v1/exams/{exam_id}/export-credentials-csv", headers=teacher_auth)
    assert csv_res.status_code == 200
    csv_text = csv_res.text
    for name, email, _ in students_data:
        assert f"{name},{email}" in csv_text

# ==============================================================================
# PHASE 2: STRICT EXAM ENROLLMENT TESTS
# ==============================================================================

@pytest.mark.anyio
async def test_strict_enrollment_enrolled_only_blocks_zero_candidates(client, teacher_auth):
    """
    1. Published exam + zero candidates + ENROLLED_ONLY => student denied (HTTP 403)
    2. Student guessing exam_code => cannot bypass enrollment policy
    3. Direct-start cannot dynamically create an enrollment for an ENROLLED_ONLY exam
    """
    now = datetime.datetime.now(timezone.utc)
    
    # Create empty directory
    dir_res = await client.post("/api/v1/student-directories/", headers=teacher_auth, json={
        "name": "Empty Directory for Gate"
    })
    dir_id = dir_res.json()["id"]

    # Create exam in ENROLLED_ONLY mode
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Strict Enrolled Only Exam",
        "subject_id": "cs_gate",
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

    # Student registers
    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"intruder_{int(time.time())}@aegeus.edu",
        "password": "Password123!",
        "full_name": "Intruder Student",
        "role": "student"
    })
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    # Attempt direct-start on zero-candidate ENROLLED_ONLY exam
    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    assert start_res.status_code == 403, f"Expected 403 Forbidden, got {start_res.status_code}: {start_res.text}"
    assert "not enrolled" in start_res.json()["detail"].lower()

    # Attempt login bypass with user password
    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam_code}", json={
        "username": f"intruder_{int(time.time())}@aegeus.edu",
        "password": "Password123!"
    })
    assert login_res.status_code in [400, 403], f"Expected 403/400 for un-enrolled login, got {login_res.status_code}"

@pytest.mark.anyio
async def test_strict_enrollment_candidate_isolation_and_allowed_access(client, teacher_auth):
    """
    2. Published exam + candidate exists + different student => denied
    3. Published exam + enrolled student => allowed
    """
    now = datetime.datetime.now(timezone.utc)
    
    dir_res = await client.post("/api/v1/student-directories/", headers=teacher_auth, json={
        "name": "Alice Only Directory"
    })
    dir_id = dir_res.json()["id"]

    await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_auth, json={
        "name": "Alice Candidate",
        "email": "alice_gate@aegeus.edu",
        "roll_number": "ROLL-ALICE"
    })

    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Alice Exam",
        "subject_id": "cs_alice",
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

    # Bob (un-enrolled)
    bob_res = await client.post("/api/v1/auth/register", json={
        "email": f"bob_unenrolled_{int(time.time())}@aegeus.edu",
        "password": "Password123!",
        "full_name": "Bob Intruder",
        "role": "student"
    })
    bob_headers = {"Authorization": f"Bearer {bob_res.json()['access_token']}"}
    bob_start = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=bob_headers)
    assert bob_start.status_code == 403

    # Alice (enrolled)
    alice_res = await client.post("/api/v1/auth/register", json={
        "email": "alice_gate@aegeus.edu",
        "password": "Password123!",
        "full_name": "Alice Candidate",
        "role": "student"
    })
    alice_headers = {"Authorization": f"Bearer {alice_res.json()['access_token']}"}
    alice_start = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=alice_headers)
    assert alice_start.status_code == 200
    assert "token" in alice_start.json()

# ==============================================================================
# PHASE 4: AI FAILURE MUST NEVER BECOME ACADEMIC PENALTY
# ==============================================================================

@pytest.mark.anyio
async def test_ai_failure_429_preserves_marks_and_sets_pending_manual_review(client, teacher_auth):
    """
    PHASE 4:
    If Gemini returns 429, timeout, malformed JSON, or 500 during subjective grading:
    - Objective marks: FINAL
    - Subjective marks: provisional, held for instructor review (NOT permanently 0)
    - Submission status: submitted (ACCEPTED)
    - Grading status: PENDING_MANUAL_REVIEW
    - Teacher can manually grade the subjective answer and finalize it
    """
    now = datetime.datetime.now(timezone.utc)
    
    # Create exam with 1 MCQ (5 marks) and 1 Subjective question (5 marks)
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Hybrid AI Grading Exam",
        "subject_id": "cs_hybrid",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]

    db = TestingSessionLocal()
    try:
        exam_row = db.query(Exam).filter(Exam.id == exam_id).first()
        exam_row.questions_json = json.dumps([
            {
                "id": "q_mcq_1",
                "question_text": "What is 2 + 2?",
                "question_type": "mcq",
                "options": ["3", "4", "5"],
                "correct_answer": "4",
                "marks": 5.0
            },
            {
                "id": "q_sub_1",
                "question_text": "Explain the significance of Big O notation in algorithms.",
                "question_type": "subjective",
                "correct_answer": "Big O characterizes upper bound asymptotic time complexity.",
                "marks": 5.0
            }
        ])
        db.commit()
    finally:
        db.close()

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"ai_fail_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "AI Fail Student",
        "role": "student"
    })
    tok = stu_res.json()["access_token"]
    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers={"Authorization": f"Bearer {tok}"})
    sess_tok = start_res.json()["token"]
    session_headers = {"Authorization": f"Bearer {sess_tok}"}

    # Mock Gemini throwing HTTP 429 ResourceExhausted exception
    with patch("app.services.ai_service.AIService.evaluate_subjective_answer", side_effect=Exception("429 ResourceExhausted: Quota exceeded")):
        sub_res = await client.post("/api/v1/attempts/submit", headers=session_headers, json={
            "answers": {
                "q_mcq_1": "4", # Correct MCQ answer (worth 5 marks)
                "q_sub_1": "Big O notation measures the worst-case runtime growth of an algorithm as input size scales."
            }
        })
        assert sub_res.status_code == 200
        data = sub_res.json()

        # Invariant checks:
        # 1. Objective score is FINAL (5.0 marks)
        assert data["score"] == 5.0
        # 2. Status is submitted / accepted
        assert data["status"] == "submitted"
        # 3. Grading status is PENDING_MANUAL_REVIEW
        assert data["grading_status"] == "PENDING_MANUAL_REVIEW"
        assert data["has_pending_manual_review"] is True
        # 4. Question q_sub_1 has evaluation_status PENDING_MANUAL_REVIEW and is_correct None
        sub_q = data["evaluated_answers"]["q_sub_1"]
        assert sub_q["evaluation_status"] == "PENDING_MANUAL_REVIEW"
        assert sub_q["is_correct"] is None
        assert "pending instructor manual review" in sub_q["ai_feedback"].lower()

    # Verify teacher pending review queue includes this submission
    pending_res = await client.get(f"/api/v1/reports/exams/{exam_id}/pending-review", headers=teacher_auth)
    assert pending_res.status_code == 200
    pending_list = pending_res.json()
    assert len(pending_list) == 1
    assert pending_list[0]["submission_id"] == data["submission_id"]
    assert len(pending_list[0]["pending_questions"]) == 1

    # Teacher manually reviews and awards 4.5 marks for the subjective answer
    sub_id = data["submission_id"]
    override_res = await client.post(f"/api/v1/reports/submissions/{sub_id}/override-grade", headers=teacher_auth, json={
        "q_id": "q_sub_1",
        "new_score": 4.5,
        "teacher_feedback": "Excellent conceptual explanation of Big O growth."
    })
    assert override_res.status_code == 200
    assert override_res.json()["new_score"] == 9.5
    assert override_res.json()["grading_status"] == "COMPLETED"

    # Queue should now be empty
    pending_res2 = await client.get(f"/api/v1/reports/exams/{exam_id}/pending-review", headers=teacher_auth)
    assert len(pending_res2.json()) == 0

# ==============================================================================
# PHASE 5: SERVER-SIDE AUTOSAVE OPTIMISTIC CONCURRENCY TESTS
# ==============================================================================

@pytest.mark.anyio
async def test_server_side_autosave_optimistic_concurrency_control(client, teacher_auth):
    """
    PHASE 5:
    Initial version = 10
    Request A expects 10 -> succeeds, version becomes 11
    Request B expects 10 -> receives conflict (stale write rejected)
    Request C expects 11 -> succeeds, version becomes 12
    """
    now = datetime.datetime.now(timezone.utc)
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Optimistic Concurrency Autosave Exam",
        "subject_id": "cs_opt",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_code = exam_res.json()["exam_code"]
    exam_id = exam_res.json()["id"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"opt_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Optimistic Student",
        "role": "student"
    })
    tok = stu_res.json()["access_token"]
    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers={"Authorization": f"Bearer {tok}"})
    sess_tok = start_res.json()["token"]
    sub_id = start_res.json()["submission_id"]
    headers = {"Authorization": f"Bearer {sess_tok}"}

    # Set version directly in DB to 10
    db = TestingSessionLocal()
    try:
        sub = db.query(ExamSubmission).filter(ExamSubmission.id == sub_id).first()
        sub.answer_version = 10
        db.commit()
    finally:
        db.close()

    # Request A expects 10
    res_a = await client.post("/api/v1/attempts/save-progress", headers=headers, json={
        "q1": "Answer A from Tab 1",
        "expected_version": 10
    })
    assert res_a.status_code == 200
    assert res_a.json()["saved"] is True
    assert res_a.json()["conflict"] is False
    assert res_a.json()["server_version"] == 11

    # Request B also expects 10 (Stale concurrent save from Tab 2)
    res_b = await client.post("/api/v1/attempts/save-progress", headers=headers, json={
        "q1": "Stale Answer B from Tab 2",
        "expected_version": 10
    })
    assert res_b.status_code == 200
    assert res_b.json()["saved"] is False
    assert res_b.json()["conflict"] is True
    assert res_b.json()["server_version"] == 11
    assert "conflict" in res_b.json()["message"].lower()

    # Request C refreshes and expects 11
    res_c = await client.post("/api/v1/attempts/save-progress", headers=headers, json={
        "q1": "Authoritative Answer C",
        "expected_version": 11
    })
    assert res_c.status_code == 200
    assert res_c.json()["saved"] is True
    assert res_c.json()["conflict"] is False
    assert res_c.json()["server_version"] == 12

# ==============================================================================
# PHASE 20: EXAM VERSION IMMUTABILITY
# ==============================================================================

@pytest.mark.anyio
async def test_exam_version_immutability(client, teacher_auth):
    """
    PHASE 20:
    Once a student starts: questions, options, marks must be immutable for that submission.
    If teacher edits the exam later, existing submission continues using its snapshot version.
    """
    now = datetime.datetime.now(timezone.utc)
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Version Immutability Exam",
        "subject_id": "cs_v1",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]

    # Seed V1 questions
    db = TestingSessionLocal()
    try:
        e = db.query(Exam).filter(Exam.id == exam_id).first()
        e.questions_json = json.dumps([
            {"id": "q1", "question_text": "Version 1 Question: What is OOP?", "question_type": "mcq", "options": ["A", "B"], "correct_answer": "A", "marks": 5.0}
        ])
        db.commit()
    finally:
        db.close()

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    # Student starts Exam V1
    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"immut_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Immutable Student",
        "role": "student"
    })
    tok = stu_res.json()["access_token"]
    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers={"Authorization": f"Bearer {tok}"})
    sess_tok = start_res.json()["token"]

    # Teacher edits the exam question in the database to V2
    db = TestingSessionLocal()
    try:
        e = db.query(Exam).filter(Exam.id == exam_id).first()
        e.questions_json = json.dumps([
            {"id": "q1", "question_text": "MODIFIED V2 Question: What is Polymorphism?", "question_type": "mcq", "options": ["X", "Y"], "correct_answer": "X", "marks": 10.0}
        ])
        db.commit()
    finally:
        db.close()

    # Student refreshes exam-info
    info_res = await client.get("/api/v1/attempts/exam-info", headers={"Authorization": f"Bearer {sess_tok}"})
    assert info_res.status_code == 200
    q_data = info_res.json()["questions"]
    assert len(q_data) == 1
    # Must STILL see Version 1!
    assert q_data[0]["question_text"] == "Version 1 Question: What is OOP?"
    assert q_data[0]["marks"] == 5.0
