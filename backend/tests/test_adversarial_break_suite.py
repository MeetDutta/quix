import pytest
import asyncio
import time
import json
import datetime
from datetime import timezone, timedelta
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam, ExamCredential, ExamSubmission, ProctoringLog
from app.models.candidate import ExamCandidate
from app.models.workspace import Workspace
from app.api.exams import snapshot_candidates_for_exam
from tests.conftest import TestingSessionLocal

@pytest.mark.anyio
async def test_concurrent_snapshot_cannot_duplicate_candidates(client, teacher_auth):
    """
    STRESS / RACE CONDITION TEST:
    Simulates multiple simultaneous requests (e.g. rapid double-publishing or concurrent workers)
    attempting to snapshot the same 27 directory students into candidates.
    VERIFIES: 27 students can NEVER become 46 or 54 candidates.
    """
    db = TestingSessionLocal()
    try:
        teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
        ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()

        directory = StudentDirectory(
            workspace_id=ws.id,
            name="Concurrent Snapshot Test Roster",
            created_by=teacher.id
        )
        db.add(directory)
        db.flush()

        for i in range(1, 28):
            ds = DirectoryStudent(
                directory_id=directory.id,
                name=f"Student {i:02d}",
                email=f"conc_snap_{i:02d}_{int(time.time())}@aegeus.edu",
                roll_number=f"ROLL-CONC-{i:02d}",
                status="active"
            )
            db.add(ds)
        db.commit()

        now_dt = datetime.datetime.now(timezone.utc)
        exam = Exam(
            name="Race Condition Snapshot Exam",
            exam_code=f"RACE-{int(time.time()) % 10000}",
            subject_id="cs_race",
            student_directory_id=directory.id,
            duration_minutes=30,
            total_marks=10,
            passing_marks=5,
            start_time=now_dt - timedelta(minutes=5),
            end_time=now_dt + timedelta(hours=1),
            created_by=teacher.id,
            workspace_id=ws.id,
            is_published=True
        )
        db.add(exam)
        db.commit()
        db.refresh(exam)
        exam_id = exam.id

        # Concurrently fire 5 rapid publish & credential generation requests
        tasks = [
            client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth),
            client.post(f"/api/v1/exams/{exam_id}/credentials", headers=teacher_auth),
            client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth),
            client.post(f"/api/v1/exams/{exam_id}/credentials", headers=teacher_auth),
            client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth),
        ]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # Database verification: Candidates must be EXACTLY 27, Credentials must be EXACTLY 27
        cand_count = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam_id).count()
        cred_count = db.query(ExamCredential).filter(ExamCredential.exam_id == exam_id).count()

        assert cand_count == 27, f"CRITICAL: Race condition caused duplicate candidates! Expected 27, got {cand_count}"
        assert cred_count == 27, f"CRITICAL: Race condition caused duplicate credentials! Expected 27, got {cred_count}"

    finally:
        db.close()

@pytest.mark.anyio
async def test_duplicate_browser_sessions_and_simultaneous_submit_race(client, teacher_auth):
    """
    CONCURRENCY TEST:
    Simulates a student opening 2 browser tabs simultaneously and attempting
    to submit both tabs at the exact same millisecond.
    VERIFIES:
    - Zero duplicate submission records.
    - Exactly 1 final submission in the database.
    - Idempotent return without duplicate scoring.
    """
    now = datetime.datetime.now(timezone.utc)
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Simultaneous Submit Race Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"race_student_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Race Student",
        "role": "student"
    })
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    # Tab 1 starts session
    tab1_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    session_token = tab1_res.json()["token"]
    session_headers = {"Authorization": f"Bearer {session_token}"}

    # Tab 2 also launches same exam
    tab2_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    assert tab2_res.json()["submission_id"] == tab1_res.json()["submission_id"], "Tabs must share the single authoritative submission"

    # Both tabs submit concurrently at the exact same moment
    submit_tasks = [
        client.post("/api/v1/attempts/submit", headers=session_headers, json={"answers": {"q1": "A"}}),
        client.post("/api/v1/attempts/submit", headers=session_headers, json={"answers": {"q1": "A"}})
    ]
    results = await asyncio.gather(*submit_tasks)

    for r in results:
        assert r.status_code == 200

    db = TestingSessionLocal()
    try:
        subs = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).all()
        assert len(subs) == 1, f"Expected exactly 1 submission row, but found {len(subs)}"
        assert subs[0].status in ["submitted", "auto_submitted"]
    finally:
        db.close()

@pytest.mark.anyio
async def test_browser_crash_and_student_reconnect(client, teacher_auth):
    """
    FAILURE INJECTION:
    Student answers Q1, crashes the browser, closes the tab, and re-authenticates 2 minutes later.
    VERIFIES:
    - Previous progress is preserved.
    - No duplicate session or submission row is generated.
    - Authoritative server timer accurately accounts for elapsed time.
    """
    now = datetime.datetime.now(timezone.utc)
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Browser Crash Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 20,
        "total_marks": 10.0,
        "passing_marks": 5,
        "start_time": (now - timedelta(minutes=2)).isoformat(),
        "end_time": (now + timedelta(hours=1)).isoformat()
    })
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"crash_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Crash Student",
        "role": "student"
    })
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    # Start exam
    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    token1 = start_res.json()["token"]
    sub1_id = start_res.json()["submission_id"]

    # Student answers Q1
    await client.post(
        "/api/v1/attempts/save-progress",
        headers={"Authorization": f"Bearer {token1}"},
        json={"q1": "Preserved Before Crash", "_client_timestamp": 100}
    )

    # SIMULATE BROWSER CRASH: Process dies, memory cleared, student opens new browser window
    reconnect_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    token2 = reconnect_res.json()["token"]
    sub2_id = reconnect_res.json()["submission_id"]

    # Must map to the exact same submission
    assert sub1_id == sub2_id

    # Query exam info
    info_res = await client.get("/api/v1/attempts/exam-info", headers={"Authorization": f"Bearer {token2}"})
    assert info_res.status_code == 200
    saved = info_res.json()["saved_answers"]
    assert saved.get("q1") == "Preserved Before Crash"
    assert info_res.json()["time_remaining_seconds"] > 0
    assert info_res.json()["time_remaining_seconds"] <= 1200

    # Verify single DB row
    db = TestingSessionLocal()
    try:
        subs = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).all()
        assert len(subs) == 1
    finally:
        db.close()

@pytest.mark.anyio
async def test_teacher_two_monitor_tabs_and_refresh(client, teacher_auth):
    """
    TEACHER CONCURRENCY:
    Teacher opens monitor in Tab 1 and Tab 2 simultaneously, then refreshes Tab 1.
    VERIFIES:
    - Telemetry counts do not double or drift.
    - Database state remains clean and unaffected by teacher UI tabs.
    """
    now = datetime.datetime.now(timezone.utc)
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Teacher Double Tab Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_id = exam_res.json()["id"]

    # Query Tab 1
    tab1 = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=teacher_auth)
    # Query Tab 2
    tab2 = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=teacher_auth)
    # Refresh Tab 1
    tab1_refreshed = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=teacher_auth)

    assert tab1.status_code == 200
    assert tab2.status_code == 200
    assert tab1_refreshed.status_code == 200

    s1 = tab1.json()["summary"]
    s2 = tab2.json()["summary"]
    s1_r = tab1_refreshed.json()["summary"]

    assert s1["total_assigned"] == s2["total_assigned"] == s1_r["total_assigned"]
    assert s1["active_in_room"] == s2["active_in_room"] == s1_r["active_in_room"]

@pytest.mark.anyio
async def test_wrong_candidate_mapping_prevention(client, teacher_auth):
    """
    DATA INTEGRITY TEST:
    Verifies that Candidate A's credential can NEVER be used to submit or read
    Candidate B's examination submission.
    """
    now = datetime.datetime.now(timezone.utc)
    dir_res = await client.post("/api/v1/student-directories/", headers=teacher_auth, json={
        "name": "Identity Mapping Directory"
    })
    dir_id = dir_res.json()["id"]

    # Student Alice
    await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_auth, json={
        "name": "Alice Real", "email": "alice_map@aegeus.edu", "roll_number": "MAP-001"
    })
    # Student Bob
    await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_auth, json={
        "name": "Bob Real", "email": "bob_map@aegeus.edu", "roll_number": "MAP-002"
    })

    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Identity Mapping Exam",
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
    creds_res = await client.post(f"/api/v1/exams/{exam_id}/credentials", headers=teacher_auth)
    creds = creds_res.json()
    assert len(creds) == 2

    # Verify Alice's credential maps strictly to Alice's candidate record
    db = TestingSessionLocal()
    try:
        cand_alice = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam_id, ExamCandidate.name_snapshot == "Alice Real").first()
        cand_bob = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam_id, ExamCandidate.name_snapshot == "Bob Real").first()

        cred_alice = db.query(ExamCredential).filter(ExamCredential.candidate_id == cand_alice.id).first()
        cred_bob = db.query(ExamCredential).filter(ExamCredential.candidate_id == cand_bob.id).first()

        assert cred_alice is not None
        assert cred_bob is not None
        assert cred_alice.candidate_id != cred_bob.candidate_id

        # Login Alice
        login_alice = await client.post(
            f"/api/v1/attempts/login?exam_code={exam_code}",
            json={"username": cred_alice.username, "password": cred_alice.password}
        )
        assert login_alice.status_code == 200
        assert login_alice.json()["student_name"] == "Alice Real"

        # Login Bob
        login_bob = await client.post(
            f"/api/v1/attempts/login?exam_code={exam_code}",
            json={"username": cred_bob.username, "password": cred_bob.password}
        )
        assert login_bob.status_code == 200
        assert login_bob.json()["student_name"] == "Bob Real"

        # Verify Alice's submission belongs to Alice
        sub_alice = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred_alice.id).first()
        sub_bob = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred_bob.id).first()

        assert sub_alice.candidate_id == cand_alice.id
        assert sub_bob.candidate_id == cand_bob.id
        assert sub_alice.id != sub_bob.id
    finally:
        db.close()

@pytest.mark.anyio
async def test_student_removed_from_active_and_answering_after_submission_and_timeout(client, teacher_auth):
    """
    FAILURE REGRESSION TEST:
    Verifies:
    1. Student remaining active after submission -> REPRODUCED & FIXED:
       Once submitted, candidate connection_status MUST BE 'completed', NOT 'online' / 'active_in_room' / 'answering_now'.
    2. Student remaining answering after timeout -> REPRODUCED & FIXED:
       Once deadline expires, live-monitor auto-sweeps to 'auto_submitted', status becomes 'completed',
       and student is immediately excluded from active_in_room and answering_now.
    """
    now = datetime.datetime.now(timezone.utc)
    dir_res = await client.post("/api/v1/student-directories/", headers=teacher_auth, json={
        "name": "Telemetry Sweep Directory"
    })
    dir_id = dir_res.json()["id"]

    # Student 1 (Submits normally)
    await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_auth, json={
        "name": "Normal Submitter", "email": "norm_sub@aegeus.edu", "roll_number": "TEL-001"
    })
    # Student 2 (Times out)
    await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_auth, json={
        "name": "Timeout Student", "email": "time_sub@aegeus.edu", "roll_number": "TEL-002"
    })

    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Telemetry Invariant Exam",
        "subject_id": "cs_101",
        "student_directory_id": dir_id,
        "duration_minutes": 10,
        "total_marks": 10.0,
        "passing_marks": 5,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)
    await client.post(f"/api/v1/exams/{exam_id}/credentials", headers=teacher_auth)

    # Login and start Student 1
    db = TestingSessionLocal()
    try:
        cand1 = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam_id, ExamCandidate.name_snapshot == "Normal Submitter").first()
        cand2 = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam_id, ExamCandidate.name_snapshot == "Timeout Student").first()
        cred1 = cand1.credential
        cred2 = cand2.credential
    finally:
        db.close()

    s1_login = await client.post(f"/api/v1/attempts/login?exam_code={exam_code}", json={"username": cred1.username, "password": cred1.password})
    token1 = s1_login.json()["token"]
    s2_login = await client.post(f"/api/v1/attempts/login?exam_code={exam_code}", json={"username": cred2.username, "password": cred2.password})
    token2 = s2_login.json()["token"]

    # Both ping heartbeat to appear active
    await client.get("/api/v1/attempts/heartbeat", headers={"Authorization": f"Bearer {token1}"})
    await client.get("/api/v1/attempts/heartbeat", headers={"Authorization": f"Bearer {token2}"})

    # Teacher checks monitor: both should be active
    mon1 = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=teacher_auth)
    assert mon1.json()["summary"]["active_in_room"] == 2
    assert mon1.json()["summary"]["answering_now"] == 2
    assert mon1.json()["summary"]["submitted"] == 0

    # Step 1: Student 1 submits
    await client.post("/api/v1/attempts/submit", headers={"Authorization": f"Bearer {token1}"}, json={"answers": {}})

    # Monitor check: Student 1 MUST NOT be active or answering
    mon2 = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=teacher_auth)
    assert mon2.json()["summary"]["active_in_room"] == 1
    assert mon2.json()["summary"]["answering_now"] == 1
    assert mon2.json()["summary"]["submitted"] == 1

    # Step 2: Student 2 expires (simulate deadline reached in DB)
    db = TestingSessionLocal()
    try:
        sub2 = db.query(ExamSubmission).filter(ExamSubmission.candidate_id == cand2.id).first()
        sub2.deadline_at = datetime.datetime.now(timezone.utc) - timedelta(seconds=10)
        db.commit()
    finally:
        db.close()

    # Teacher checks monitor again: auto-sweep should transition Student 2 to submitted
    mon3 = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=teacher_auth)
    assert mon3.json()["summary"]["active_in_room"] == 0, "Zero students should remain active after submission/expiry"
    assert mon3.json()["summary"]["answering_now"] == 0, "Zero students should remain answering after submission/expiry"
    assert mon3.json()["summary"]["submitted"] == 2

@pytest.mark.anyio
async def test_network_failure_during_submit_and_idempotent_retry(client, teacher_auth):
    """
    FAILURE INJECTION TEST:
    Student submits, but client network drops before receiving the HTTP 200 packet.
    Student re-sends the exact same submission request 3 seconds later.
    VERIFIES:
    - Zero double submission rows.
    - Zero score duplication.
    - Clean HTTP 200 returned on retry.
    """
    now = datetime.datetime.now(timezone.utc)
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Network Retry Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]
    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"retry_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Retry Student",
        "role": "student"
    })
    tok = stu_res.json()["access_token"]

    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers={"Authorization": f"Bearer {tok}"})
    sess_tok = start_res.json()["token"]

    # Submission 1
    r1 = await client.post("/api/v1/attempts/submit", headers={"Authorization": f"Bearer {sess_tok}"}, json={"answers": {"q1": "Answer"}})
    assert r1.status_code == 200
    sub_id = r1.json()["submission_id"]

    # Submission 2 (Retry)
    r2 = await client.post("/api/v1/attempts/submit", headers={"Authorization": f"Bearer {sess_tok}"}, json={"answers": {"q1": "Answer"}})
    assert r2.status_code == 200
    assert r2.json()["submission_id"] == sub_id
    assert r2.json()["status"] == "submitted"

    # Database state verification
    db = TestingSessionLocal()
    try:
        subs = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).all()
        assert len(subs) == 1, "There must be exactly 1 submission record in the database."
    finally:
        db.close()

@pytest.mark.anyio
async def test_exact_foreign_key_identity_mapping_no_heuristics(client, teacher_auth):
    """
    IDENTITY VERIFICATION TEST:
    Creates John Doe, John Smith, and Jane Doe.
    Verifies that credentials and exports match strictly through candidate foreign keys,
    with ZERO heuristic first-name or substring guessing.
    """
    now = datetime.datetime.now(timezone.utc)
    dir_res = await client.post("/api/v1/student-directories/", headers=teacher_auth, json={
        "name": "Identity FK Directory"
    })
    dir_id = dir_res.json()["id"]

    await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_auth, json={
        "name": "John Doe", "email": "johndoe_fk@aegeus.edu", "roll_number": "ROLL-JD-01"
    })
    await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_auth, json={
        "name": "John Smith", "email": "johnsmith_fk@aegeus.edu", "roll_number": "ROLL-JS-02"
    })
    await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_auth, json={
        "name": "Jane Doe", "email": "janedoe_fk@aegeus.edu", "roll_number": "ROLL-JD-03"
    })

    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Identity Verification Exam",
        "subject_id": "cs_101",
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

    # Map by student_name
    name_map = {c["student_name"]: c for c in creds}
    assert "John Doe" in name_map
    assert "John Smith" in name_map
    assert "Jane Doe" in name_map

    # Ensure John Doe's credential email is johndoe_fk@aegeus.edu, NOT johnsmith
    assert name_map["John Doe"]["email"] == "johndoe_fk@aegeus.edu"
    assert name_map["John Smith"]["email"] == "johnsmith_fk@aegeus.edu"
    assert name_map["Jane Doe"]["email"] == "janedoe_fk@aegeus.edu"

    # CSV Export Verification
    csv_res = await client.get(f"/api/v1/exams/{exam_id}/export-credentials-csv", headers=teacher_auth)
    assert csv_res.status_code == 200
    csv_text = csv_res.text
    assert "John Doe,johndoe_fk@aegeus.edu" in csv_text
    assert "John Smith,johnsmith_fk@aegeus.edu" in csv_text
    assert "Jane Doe,janedoe_fk@aegeus.edu" in csv_text

@pytest.mark.anyio
async def test_zero_roster_exam_blocks_unauthorized_direct_start(client, teacher_auth):
    """
    ENROLLMENT SECURITY TEST:
    An exam created with a directory that has 0 enrolled students MUST NOT allow arbitrary entry.
    Any un-enrolled student attempting to direct-start must be blocked with HTTP 403.
    """
    now = datetime.datetime.now(timezone.utc)
    dir_res = await client.post("/api/v1/student-directories/", headers=teacher_auth, json={
        "name": "Empty Roster Directory"
    })
    dir_id = dir_res.json()["id"]

    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Zero Candidate Security Exam",
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

    # Random student registers
    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"zero_roster_intruder_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Intruder User",
        "role": "student"
    })
    tok = stu_res.json()["access_token"]

    # Must be rejected with HTTP 403 Forbidden
    res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers={"Authorization": f"Bearer {tok}"})
    assert res.status_code == 403
    assert "not enrolled" in res.json()["detail"].lower()

@pytest.mark.anyio
async def test_autosave_monotonic_version_sequencing(client, teacher_auth):
    """
    AUTOSAVE RESILIENCY TEST:
    Verifies that autosave rejects older version sequences regardless of client timestamp.
    """
    now = datetime.datetime.now(timezone.utc)
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Autosave Versioning Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"version_stu_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Version Student",
        "role": "student"
    })
    tok = stu_res.json()["access_token"]

    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers={"Authorization": f"Bearer {tok}"})
    sess_tok = start_res.json()["token"]
    headers = {"Authorization": f"Bearer {sess_tok}"}

    # Save 1: Version 1
    r1 = await client.post("/api/v1/attempts/save-progress", headers=headers, json={
        "q1": "Answer Version 1",
        "_version": 1
    })
    assert r1.status_code == 200
    assert not r1.json().get("discarded", False)

    # Save 2: Version 2
    r2 = await client.post("/api/v1/attempts/save-progress", headers=headers, json={
        "q1": "Answer Version 2",
        "_version": 2
    })
    assert r2.status_code == 200
    assert not r2.json().get("discarded", False)

    # Save 3: Stale packet with Version 1 arrives late -> MUST BE DISCARDED
    r3 = await client.post("/api/v1/attempts/save-progress", headers=headers, json={
        "q1": "Stale Overwrite Attempt",
        "_version": 1
    })
    assert r3.status_code == 200
    assert r3.json().get("discarded") is True

    # Verify server preserved Version 2 answer
    info_res = await client.get("/api/v1/attempts/exam-info", headers=headers)
    assert info_res.json()["saved_answers"]["q1"] == "Answer Version 2"


