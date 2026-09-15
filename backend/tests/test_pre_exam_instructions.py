import pytest
import datetime
import uuid
import json
import asyncio
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam, ExamCredential, ExamSubmission
from app.models.candidate import ExamCandidate
from app.models.workspace import Workspace
from app.utils.timezone import now_utc, to_iso_utc, to_utc_instant
from app.api.attempts import process_exam_submission

def setup_assessment_and_candidate(db: Session, suffix: str = "P1"):
    teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
    ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()

    directory = StudentDirectory(
        workspace_id=ws.id,
        name=f"Instructions Directory {suffix}",
        created_by=teacher.id
    )
    db.add(directory)
    db.flush()

    student = DirectoryStudent(
        directory_id=directory.id,
        name=f"Candidate {suffix}",
        email=f"cand_{suffix.lower()}_{uuid.uuid4().hex[:4]}@aegeus.edu",
        roll_number=f"ROLL-{suffix}",
        status="active"
    )
    db.add(student)
    db.flush()

    now_dt = now_utc()
    exam = Exam(
        name=f"CBT Assessment {suffix}",
        exam_code=f"EX-{suffix}-{uuid.uuid4().hex[:4].upper()}",
        subject_id="cs_101",
        student_directory_id=directory.id,
        duration_minutes=45,
        total_marks=50,
        passing_marks=20,
        start_time=now_dt - datetime.timedelta(minutes=10),
        end_time=now_dt + datetime.timedelta(hours=3),
        created_by=teacher.id,
        workspace_id=ws.id,
        is_published=True,
        questions_json=json.dumps([
            {"id": "q1", "type": "mcq", "question_text": "What is 2+2?", "options": ["3", "4", "5"], "correct_answer": "4", "marks": 25},
            {"id": "q2", "type": "mcq", "question_text": "What is 5*5?", "options": ["20", "25", "30"], "correct_answer": "25", "marks": 25}
        ])
    )
    db.add(exam)
    db.flush()

    cand = ExamCandidate(
        exam_id=exam.id,
        directory_student_id=student.id,
        name_snapshot=student.name,
        email_snapshot=student.email,
        roll_number_snapshot=student.roll_number,
        status="PENDING"
    )
    db.add(cand)
    db.flush()

    cred = ExamCredential(
        exam_id=exam.id,
        candidate_id=cand.id,
        username=f"cand_{suffix.lower()}",
        password="securepass123",
        expires_at=exam.end_time
    )
    db.add(cred)
    db.commit()

    return teacher, exam, cand, cred


@pytest.mark.anyio
async def test_login_creates_not_started_attempt(client):
    """
    Test 1: First login creates an attempt in 'not_started' state with started_at=None, deadline_at=None.
    Does NOT start the timer or proctoring.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "L1")

        res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })

        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "not_started"
        assert data["is_started"] is False
        assert data["is_completed"] is False
        assert "session_token" in data

        # Verify database record
        sub = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.candidate_id == cand.id
        ).first()

        assert sub is not None
        assert sub.status == "not_started"
        assert sub.started_at is None
        assert sub.deadline_at is None
        assert sub.last_seen_at is None
    finally:
        db.close()


@pytest.mark.anyio
async def test_timer_does_not_advance_during_instructions(client):
    """
    Test 2: Timer does NOT advance while candidate is on instructions.
    Remaining time equals the full examination duration.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "T1")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        info_res = await client.get(f"/api/v1/attempts/exam-info?token={token}")
        assert info_res.status_code == 200
        info = info_res.json()

        assert info["status"] == "not_started"
        assert info["is_started"] is False
        # Full duration preserved in seconds (45 min * 60 = 2700s)
        assert info["time_remaining_seconds"] == 45 * 60
        assert info["deadline_at"] is None
    finally:
        db.close()


@pytest.mark.anyio
async def test_instructions_info_endpoint(client):
    """
    Test 3: instructions-info returns complete candidate & assessment metadata.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "INF1")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        res = await client.get(f"/api/v1/attempts/instructions-info?token={token}")
        assert res.status_code == 200
        data = res.json()

        assert data["candidate_name"] == cand.name_snapshot
        assert data["roll_number"] == cand.roll_number_snapshot
        assert data["email"] == cand.email_snapshot
        assert data["exam_name"] == exam.name
        assert data["exam_code"] == exam.exam_code
        assert data["duration_minutes"] == 45
        assert data["total_questions"] == 2
        assert data["total_marks"] == 50
        assert data["passing_marks"] == 20
        assert data["calculator_enabled"] is True
        assert data["status"] == "not_started"
        assert data["is_started"] is False
    finally:
        db.close()


@pytest.mark.anyio
async def test_instructions_info_does_not_leak_questions(client):
    """
    Test 4: instructions-info strictly does NOT leak question text, options, answers, or keys.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "LEAK1")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        res = await client.get(f"/api/v1/attempts/instructions-info?token={token}")
        assert res.status_code == 200
        raw_text = res.text

        # Questions and answers must NOT appear anywhere in the response body!
        assert "What is 2+2?" not in raw_text
        assert "What is 5*5?" not in raw_text
        assert "correct_answer" not in raw_text
        assert "questions_snapshot" not in raw_text
    finally:
        db.close()


@pytest.mark.anyio
async def test_instructions_info_isolation(client):
    """
    Test 5: Token determines identity strictly; arbitrary query parameters cannot cross-inspect.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam_a, cand_a, cred_a = setup_assessment_and_candidate(db, "ISO_A")
        _, exam_b, cand_b, cred_b = setup_assessment_and_candidate(db, "ISO_B")

        res_a = await client.post(f"/api/v1/attempts/login?exam_code={exam_a.exam_code}", json={
            "username": cred_a.username,
            "password": cred_a.password
        })
        token_a = res_a.json()["session_token"]

        # Attempt to inject candidate B's info into request
        info_res = await client.get(f"/api/v1/attempts/instructions-info?token={token_a}&candidate_id={cand_b.id}")
        assert info_res.status_code == 200
        data = info_res.json()

        # Must strictly return candidate A's info
        assert data["candidate_name"] == cand_a.name_snapshot
        assert data["exam_code"] == exam_a.exam_code
        assert data["candidate_name"] != cand_b.name_snapshot
    finally:
        db.close()


@pytest.mark.anyio
async def test_start_exam_endpoint_establishes_server_time(client):
    """
    Test 6: Calling start-exam establishes authoritative server started_at and deadline_at.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "START1")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        start_res = await client.post(f"/api/v1/attempts/start-exam?token={token}", json={
            "acknowledged": True
        })
        assert start_res.status_code == 200
        start_data = start_res.json()

        assert start_data["status"] == "started"
        assert start_data["started_at"] is not None
        assert start_data["deadline_at"] is not None
        assert start_data["time_remaining_seconds"] > 0

        # Verify DB state
        db.expire_all()
        sub = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.candidate_id == cand.id
        ).first()

        assert sub.status == "started"
        assert sub.started_at is not None
        assert sub.deadline_at is not None
    finally:
        db.close()


@pytest.mark.anyio
async def test_start_exam_is_idempotent(client):
    """
    Test 7: start-exam is strictly idempotent. Repeated calls return the exact same timestamps.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "IDEM1")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        res1 = await client.post(f"/api/v1/attempts/start-exam?token={token}", json={"acknowledged": True})
        assert res1.status_code == 200
        d1 = res1.json()

        # Second call immediately
        res2 = await client.post(f"/api/v1/attempts/start-exam?token={token}", json={"acknowledged": True})
        assert res2.status_code == 200
        d2 = res2.json()

        assert d1["started_at"] == d2["started_at"]
        assert d1["deadline_at"] == d2["deadline_at"]

        # Ensure only 1 submission exists in DB
        db.expire_all()
        subs = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.candidate_id == cand.id
        ).all()
        assert len(subs) == 1
    finally:
        db.close()


@pytest.mark.anyio
async def test_start_exam_concurrent_requests(client):
    """
    Test 8: Concurrency stress test (2, 5, and 10 simultaneous start requests).
    Guarantees no race conditions, exactly 1 ExamSubmission, and all return matching timestamps.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        # 1. Test 2 concurrent requests
        _, exam2, cand2, cred2 = setup_assessment_and_candidate(db, "CONC2")
        login2 = await client.post(f"/api/v1/attempts/login?exam_code={exam2.exam_code}", json={
            "username": cred2.username, "password": cred2.password
        })
        tok2 = login2.json()["session_token"]
        res2 = await asyncio.gather(*[
            client.post(f"/api/v1/attempts/start-exam?token={tok2}", json={"acknowledged": True})
            for _ in range(2)
        ])
        assert all(r.status_code == 200 for r in res2)
        assert len({r.json()["started_at"] for r in res2}) == 1
        assert len({r.json()["deadline_at"] for r in res2}) == 1
        db.expire_all()
        assert len(db.query(ExamSubmission).filter(ExamSubmission.candidate_id == cand2.id).all()) == 1

        # 2. Test 5 concurrent requests
        _, exam5, cand5, cred5 = setup_assessment_and_candidate(db, "CONC5")
        login5 = await client.post(f"/api/v1/attempts/login?exam_code={exam5.exam_code}", json={
            "username": cred5.username, "password": cred5.password
        })
        tok5 = login5.json()["session_token"]
        res5 = await asyncio.gather(*[
            client.post(f"/api/v1/attempts/start-exam?token={tok5}", json={"acknowledged": True})
            for _ in range(5)
        ])
        assert all(r.status_code == 200 for r in res5)
        assert len({r.json()["started_at"] for r in res5}) == 1
        assert len({r.json()["deadline_at"] for r in res5}) == 1
        db.expire_all()
        assert len(db.query(ExamSubmission).filter(ExamSubmission.candidate_id == cand5.id).all()) == 1

        # 3. Test 10 concurrent requests
        _, exam10, cand10, cred10 = setup_assessment_and_candidate(db, "CONC10")
        login10 = await client.post(f"/api/v1/attempts/login?exam_code={exam10.exam_code}", json={
            "username": cred10.username, "password": cred10.password
        })
        tok10 = login10.json()["session_token"]
        res10 = await asyncio.gather(*[
            client.post(f"/api/v1/attempts/start-exam?token={tok10}", json={"acknowledged": True})
            for _ in range(10)
        ])
        assert all(r.status_code == 200 for r in res10)
        assert len({r.json()["started_at"] for r in res10}) == 1
        assert len({r.json()["deadline_at"] for r in res10}) == 1
        db.expire_all()
        assert len(db.query(ExamSubmission).filter(ExamSubmission.candidate_id == cand10.id).all()) == 1
    finally:
        db.close()


@pytest.mark.anyio
async def test_start_exam_does_not_extend_deadline(client):
    """
    Test 9: Calling start-exam again after some elapsed time does not extend the deadline.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "EXT1")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        res1 = await client.post(f"/api/v1/attempts/start-exam?token={token}", json={"acknowledged": True})
        orig_deadline = res1.json()["deadline_at"]

        # Advance attempt started_at manually into the past
        sub = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.candidate_id == cand.id
        ).first()
        sub.started_at = now_utc() - datetime.timedelta(minutes=10)
        sub.deadline_at = sub.started_at + datetime.timedelta(minutes=45)
        db.commit()

        # Retry start-exam
        res2 = await client.post(f"/api/v1/attempts/start-exam?token={token}", json={"acknowledged": True})
        new_deadline = res2.json()["deadline_at"]

        assert to_utc_instant(new_deadline) == to_utc_instant(sub.deadline_at)
        assert res2.json()["time_remaining_seconds"] < 45 * 60
    finally:
        db.close()


@pytest.mark.anyio
async def test_refresh_preserves_not_started_state(client):
    """
    Test 10: Refreshing / re-logging in before start preserves not_started state without starting timer.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "REF1")

        for _ in range(3):
            login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
                "username": cred.username,
                "password": cred.password
            })
            assert login_res.status_code == 200
            assert login_res.json()["status"] == "not_started"
            assert login_res.json()["is_started"] is False

        # In DB: still exactly 1 attempt, started_at is None
        db.expire_all()
        subs = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.candidate_id == cand.id
        ).all()
        assert len(subs) == 1
        assert subs[0].started_at is None
    finally:
        db.close()


@pytest.mark.anyio
async def test_direct_exam_url_guard(client):
    """
    Test 11: exam-info returns is_started=False for not_started attempt so frontend can guard.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "GUARD1")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        info_res = await client.get(f"/api/v1/attempts/exam-info?token={token}")
        data = info_res.json()
        assert data["is_started"] is False
        assert data["status"] == "not_started"
    finally:
        db.close()


@pytest.mark.anyio
async def test_started_candidate_can_resume(client):
    """
    Test 12: Once started, login returns is_started=True and exam-info returns running timer.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "RESUME1")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        # Start exam
        await client.post(f"/api/v1/attempts/start-exam?token={token}", json={"acknowledged": True})

        # Subsequent login attempt (reconnect/resume)
        res2 = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        data2 = res2.json()
        assert data2["is_started"] is True
        assert data2["status"] == "started"
    finally:
        db.close()


@pytest.mark.anyio
async def test_live_monitor_states_login_vs_start(client, teacher_auth):
    """
    Test 13: Live Monitor accurately distinguishes login/instructions from active exam.
      After Login: total_assigned=1, not_started=1, active_in_room=0
      After Start: total_assigned=1, not_started=0, active_in_room=1
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "LM1")

        # 1. Candidate logs in (enters instructions)
        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        # Check Live Monitor: must report not_started=1, active=0
        mon1 = await client.get(f"/api/v1/exams/{exam.id}/live-monitor", headers=teacher_auth)
        d1 = mon1.json()
        assert d1["summary"]["total_assigned"] == 1
        assert d1["summary"]["not_started"] == 1
        assert d1["summary"]["active_in_room"] == 0

        # 2. Candidate starts exam
        await client.post(f"/api/v1/attempts/start-exam?token={token}", json={"acknowledged": True})

        # Check Live Monitor: must report not_started=0, active=1
        mon2 = await client.get(f"/api/v1/exams/{exam.id}/live-monitor", headers=teacher_auth)
        d2 = mon2.json()
        assert d2["summary"]["total_assigned"] == 1
        assert d2["summary"]["not_started"] == 0
        assert d2["summary"]["active_in_room"] == 1
    finally:
        db.close()


@pytest.mark.anyio
async def test_reattempt_requires_instructions_and_start(client, teacher_auth):
    """
    Test 14: Newly granted reattempt begins with status='not_started' and started_at=None.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "REAT1")

        # First attempt completed
        sub1 = ExamSubmission(
            exam_id=exam.id,
            candidate_id=cand.id,
            credential_id=cred.id,
            attempt_number=1,
            is_counted_for_result=True,
            status="auto_submitted",
            auto_submit_reason="TAB_SWITCH",
            tab_switch_count=2,
            started_at=now_utc() - datetime.timedelta(minutes=30),
            submitted_at=now_utc() - datetime.timedelta(minutes=10),
            answers_json="{}",
            score=0
        )
        db.add(sub1)
        db.commit()

        # Teacher grants reattempt
        grant_res = await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth, json={
            "reason": "Permitted",
            "time_policy": "standard"
        })
        assert grant_res.status_code == 200

        # Candidate logs in
        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        login_data = login_res.json()
        assert login_data["is_started"] is False
        assert login_data["status"] == "not_started"
        assert login_data["attempt_number"] == 2

        # In DB: Attempt #2 must have started_at=None
        db.expire_all()
        sub2 = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.candidate_id == cand.id,
            ExamSubmission.attempt_number == 2
        ).first()

        assert sub2 is not None
        assert sub2.status == "not_started"
        assert sub2.started_at is None
    finally:
        db.close()


@pytest.mark.anyio
async def test_reattempt_does_not_inherit_previous_timer(client, teacher_auth):
    """
    Test 15: Reattempt timer starts only when start-exam is called for attempt #2.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "TIM2")

        sub1 = ExamSubmission(
            exam_id=exam.id,
            candidate_id=cand.id,
            credential_id=cred.id,
            attempt_number=1,
            is_counted_for_result=True,
            status="auto_submitted",
            auto_submit_reason="TAB_SWITCH",
            tab_switch_count=2,
            started_at=now_utc() - datetime.timedelta(minutes=30),
            submitted_at=now_utc() - datetime.timedelta(minutes=10),
            answers_json="{}",
            score=0
        )
        db.add(sub1)
        db.commit()

        await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth, json={
            "reason": "Standard reattempt",
            "time_policy": "standard"
        })

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        # Start attempt #2
        start_res = await client.post(f"/api/v1/attempts/start-exam?token={token}", json={"acknowledged": True})
        assert start_res.status_code == 200
        start_data = start_res.json()

        assert start_data["attempt_number"] == 2
        assert start_data["started_at"] is not None
        # Must NOT equal attempt 1's start time
        assert to_utc_instant(start_data["started_at"]) != to_utc_instant(sub1.started_at)
    finally:
        db.close()


@pytest.mark.anyio
async def test_unauthenticated_start_is_rejected(client):
    """
    Test 16: Calling start-exam without authentication is rejected with 401.
    """
    res = await client.post("/api/v1/attempts/start-exam", json={"acknowledged": True})
    assert res.status_code == 401


@pytest.mark.anyio
async def test_start_submitted_attempt_is_rejected(client):
    """
    Test 17: Attempting to start an already submitted attempt is rejected with 400.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "SUB_REJ")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        # Start exam
        await client.post(f"/api/v1/attempts/start-exam?token={token}", json={"acknowledged": True})

        # Submit exam
        await client.post(f"/api/v1/attempts/submit?token={token}", json={"answers": {"q1": "4"}})

        # Try to start again
        res = await client.post(f"/api/v1/attempts/start-exam?token={token}", json={"acknowledged": True})
        assert res.status_code == 400
        assert "already been submitted" in res.json()["detail"].lower()
    finally:
        db.close()


@pytest.mark.anyio
async def test_acknowledgement_bypass_is_rejected(client):
    """
    Test 18: Calling start-exam with acknowledged=False is rejected server-side with 400.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "ACK_BYP")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        res = await client.post(f"/api/v1/attempts/start-exam?token={token}", json={"acknowledged": False})
        assert res.status_code == 400
        assert "acknowledge" in res.json()["detail"].lower()
    finally:
        db.close()


@pytest.mark.anyio
async def test_unauthenticated_instructions_info_is_rejected(client):
    """
    Test 19: Calling instructions-info without token is rejected with 401.
    """
    res = await client.get("/api/v1/attempts/instructions-info")
    assert res.status_code == 401


@pytest.mark.anyio
async def test_cannot_extend_deadline_via_client_injection(client):
    """
    Test 20: Client attempts to send arbitrary custom deadline or started_at in payload.
    The server ignores arbitrary fields and enforces strictly calculated UTC timestamps.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _, exam, cand, cred = setup_assessment_and_candidate(db, "INJECT")

        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        token = login_res.json()["session_token"]

        malicious_future = "2099-01-01T00:00:00Z"
        res = await client.post(f"/api/v1/attempts/start-exam?token={token}", json={
            "acknowledged": True,
            "deadline_at": malicious_future,
            "started_at": malicious_future,
            "duration_minutes": 99999
        })
        assert res.status_code == 200
        data = res.json()
        assert data["deadline_at"] != malicious_future
        assert data["started_at"] != malicious_future
        # Must be close to actual now
        now_val = now_utc()
        actual_start = to_utc_instant(data["started_at"])
        assert abs((actual_start - now_val).total_seconds()) < 10
    finally:
        db.close()


@pytest.mark.anyio
async def test_duplicate_reattempt_is_idempotent(client, teacher_auth):
    """
    Test 21: Calling grant_reattempt multiple times for an unstarted attempt
    does NOT spawn redundant duplicate attempt records.
    """
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        teacher, exam, cand, cred = setup_assessment_and_candidate(db, "REIDEMP")

        # Attempt 1 submitted
        sub1 = ExamSubmission(
            exam_id=exam.id,
            candidate_id=cand.id,
            credential_id=cred.id,
            attempt_number=1,
            is_counted_for_result=True,
            status="auto_submitted",
            auto_submit_reason="TAB_SWITCH",
            tab_switch_count=2,
            started_at=now_utc() - datetime.timedelta(minutes=30),
            submitted_at=now_utc() - datetime.timedelta(minutes=10),
            answers_json="{}",
            score=0
        )
        db.add(sub1)
        db.commit()

        # First reattempt grant
        r1 = await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth, json={
            "reason": "First grant", "time_policy": "standard"
        })
        assert r1.status_code == 200

        # Second reattempt grant before candidate started
        r2 = await client.post(f"/api/v1/exams/{exam.id}/candidates/{cand.id}/reattempt", headers=teacher_auth, json={
            "reason": "Duplicate click grant", "time_policy": "standard"
        })
        assert r2.status_code == 200

        # Verify only 2 total submissions exist (Attempt 1 + Attempt 2)
        db.expire_all()
        subs = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.candidate_id == cand.id
        ).all()
        assert len(subs) == 2
        assert subs[-1].attempt_number == 2
        assert subs[-1].status == "not_started"
    finally:
        db.close()

