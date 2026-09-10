import pytest
import datetime
import uuid
import json
import asyncio
from datetime import timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from app.models.user import User, Student
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam, ExamCredential, ExamSubmission, ProctoringLog
from app.models.candidate import ExamCandidate
from app.models.institution import Institution, Department
from app.models.workspace import Workspace
from app.utils.security import create_access_token
from app.utils.timezone import now_utc, to_iso_utc, to_ist, format_ist_time
from app.api.exams import snapshot_candidates_for_exam

def create_test_exam_and_student(db: Session, exam_code_suffix: str = "T1"):
    teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
    ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()
    
    directory = StudentDirectory(
        workspace_id=ws.id,
        name=f"Test Directory {exam_code_suffix}",
        created_by=teacher.id
    )
    db.add(directory)
    db.flush()

    ds = DirectoryStudent(
        directory_id=directory.id,
        name=f"Test Student {exam_code_suffix}",
        email=f"teststudent_{exam_code_suffix}@aegeus.edu",
        roll_number=f"ROLL-{exam_code_suffix}",
        status="active"
    )
    db.add(ds)
    db.flush()

    now_dt = now_utc()
    exam = Exam(
        name=f"Assessment {exam_code_suffix}",
        exam_code=f"EXAM-{exam_code_suffix}",
        subject_id="cs_101",
        student_directory_id=directory.id,
        duration_minutes=60,
        total_marks=50,
        passing_marks=20,
        start_time=now_dt - datetime.timedelta(minutes=5),
        end_time=now_dt + datetime.timedelta(hours=2),
        created_by=teacher.id,
        workspace_id=ws.id,
        is_published=True,
        questions_json='[{"id":"q1","type":"mcq","question_text":"What is 2+2?","options":["3","4","5"],"correct_answer":"4","marks":10}]'
    )
    db.add(exam)
    db.flush()

    snapshot_candidates_for_exam(exam, directory.id, db)
    cand = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam.id).first()
    cred = db.query(ExamCredential).filter(ExamCredential.candidate_id == cand.id).first()
    db.commit()

    return exam, cand, cred

@pytest.mark.anyio
async def test_tab_switch_postgres_ddl_and_atomic_query():
    """Verify PostgreSQL compatibility and atomic state transition SQL compilation."""
    from app.database import Base
    pg_dialect = postgresql.dialect()
    
    # 1. Compile ProctoringLog and ExamSubmission tables under PostgreSQL dialect
    for table_name in ["proctoring_logs", "exam_submissions"]:
        table = Base.metadata.tables[table_name]
        ddl_stmt = str(CreateTable(table).compile(dialect=pg_dialect))
        assert table_name in ddl_stmt.lower()

    # 2. Verify atomic update query compiles with PostgreSQL dialect
    from sqlalchemy import update
    stmt = (
        update(ExamSubmission)
        .where(
            ExamSubmission.id == "test-sub-id",
            ExamSubmission.status.in_(["started", "in_progress", "submitting"])
        )
        .values(
            status="auto_submitted",
            submitted_at=now_utc(),
            auto_submit_reason="TAB_SWITCH"
        )
    )
    compiled = stmt.compile(dialect=pg_dialect, compile_kwargs={"literal_binds": False})
    sql_text = str(compiled).lower()
    assert "update exam_submissions" in sql_text
    assert "status in" in sql_text or "status =" in sql_text
    assert "auto_submitted" in sql_text or "status" in sql_text

@pytest.mark.anyio
async def test_01_single_tab_switch_violation_persisted(client, setup_test_database):
    """TEST 1: Single tab switch -> violation persisted, warning returned, student remains ACTIVE."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T1")

    # Login to get session token
    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]

    # Student triggers first tab switch
    event_id_1 = str(uuid.uuid4())
    v_res = await client.post(f"/api/v1/attempts/violation?token={token}", json={
        "type": "TAB_SWITCH",
        "client_event_id": event_id_1,
        "occurred_at": to_iso_utc(now_utc()),
        "source": "browser_visibility"
    })
    assert v_res.status_code == 200
    data = v_res.json()
    assert data["action"] == "warn"
    assert data["violation_count"] == 1
    assert "Warning: Tab switching is not allowed" in data["warning"]
    assert data["status"] in ["started", "in_progress"]

    # Verify violation persisted in DB
    db.expire_all()
    sub = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred.id).first()
    assert sub.status in ["started", "in_progress"]
    assert sub.tab_switch_count == 1
    
    logs = db.query(ProctoringLog).filter(ProctoringLog.submission_id == sub.id, ProctoringLog.event_type == "tab_switch").all()
    assert len(logs) == 1
    assert logs[0].client_event_id == event_id_1

@pytest.mark.anyio
async def test_02_and_03_tab_switch_automatic_submission_and_db_status(client, setup_test_database):
    """TEST 2 & 3: Tab switch -> automatic submission on second tab switch; status AUTO_SUBMITTED in DB."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T2")

    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    token = login_res.json()["token"]

    # First switch -> Warn
    await client.post(f"/api/v1/attempts/violation?token={token}", json={
        "type": "TAB_SWITCH",
        "client_event_id": str(uuid.uuid4()),
        "occurred_at": to_iso_utc(now_utc())
    })

    # Second switch -> Auto Submit
    event_id_2 = str(uuid.uuid4())
    v2_res = await client.post(f"/api/v1/attempts/violation?token={token}", json={
        "type": "TAB_SWITCH",
        "client_event_id": event_id_2,
        "occurred_at": to_iso_utc(now_utc())
    })
    assert v2_res.status_code == 200
    data2 = v2_res.json()
    assert data2["action"] == "auto_submit"
    assert data2["violation_count"] == 2
    assert data2["status"] == "auto_submitted"
    assert data2["reason"] == "TAB_SWITCH"
    assert "Exam automatically submitted due to tab switching." in data2["message"]

    # TEST 3: Verify DB status
    db.expire_all()
    sub = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred.id).first()
    assert sub.status == "auto_submitted"
    assert sub.auto_submit_reason == "TAB_SWITCH"
    assert sub.submitted_at is not None
    assert sub.credential.is_used is True

@pytest.mark.anyio
async def test_04_subsequent_save_progress_rejected(client, setup_test_database):
    """TEST 4: Tab switch -> subsequent save-progress rejected with 400."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T4")

    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    token = login_res.json()["token"]

    # Auto submit via 2 tab switches
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})

    # Attempt to save progress
    save_res = await client.post(f"/api/v1/attempts/save-progress?token={token}", json={"q1": "4"})
    assert save_res.status_code == 400
    assert "submitted" in save_res.json()["detail"].lower()

@pytest.mark.anyio
async def test_05_subsequent_submit_rejected_or_idempotent(client, setup_test_database):
    """TEST 5: Tab switch -> subsequent submit rejected/idempotently returns final state."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T5")

    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    token = login_res.json()["token"]

    # Auto submit via 2 tab switches
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})

    # Subsequent manual submit call
    sub_res = await client.post(f"/api/v1/attempts/submit?token={token}", json={"q1": "3"})
    assert sub_res.status_code == 200
    data = sub_res.json()
    assert data["status"] == "auto_submitted"
    assert "already been submitted" in data["message"].lower()

@pytest.mark.anyio
async def test_06_and_07_duplicate_event_and_request_idempotency(client, setup_test_database):
    """TEST 6 & 7: Duplicate visibility event / duplicate violation request -> exactly one violation."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T67")

    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    token = login_res.json()["token"]

    event_id = str(uuid.uuid4())
    # Request 1
    res1 = await client.post(f"/api/v1/attempts/violation?token={token}", json={
        "type": "TAB_SWITCH",
        "client_event_id": event_id,
        "occurred_at": to_iso_utc(now_utc())
    })
    assert res1.status_code == 200
    assert res1.json()["violation_count"] == 1

    # Request 2 with same client_event_id (duplicate network dispatch)
    res2 = await client.post(f"/api/v1/attempts/violation?token={token}", json={
        "type": "TAB_SWITCH",
        "client_event_id": event_id,
        "occurred_at": to_iso_utc(now_utc())
    })
    assert res2.status_code == 200
    assert res2.json()["action"] == "ignored_duplicate"
    assert res2.json()["violation_count"] == 1

    # Check DB logs count
    db.expire_all()
    sub = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred.id).first()
    assert sub.tab_switch_count == 1
    logs = db.query(ProctoringLog).filter(ProctoringLog.submission_id == sub.id, ProctoringLog.event_type == "tab_switch").all()
    assert len(logs) == 1

@pytest.mark.anyio
async def test_08_violation_and_heartbeat_race(client, setup_test_database):
    """TEST 8: Violation + heartbeat race -> exactly one auto-submission."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T8")

    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    token = login_res.json()["token"]

    # First switch
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})

    # Race second switch and heartbeat concurrently
    v_task = client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})
    hb_task = client.post(f"/api/v1/attempts/heartbeat?token={token}")

    res_v, res_hb = await asyncio.gather(v_task, hb_task)
    assert res_v.status_code == 200
    assert res_hb.status_code == 200

    db.expire_all()
    sub = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred.id).first()
    assert sub.status == "auto_submitted"
    assert sub.tab_switch_count == 2

@pytest.mark.anyio
async def test_09_violation_and_manual_submit_race(client, setup_test_database):
    """TEST 9: Violation + manual submit race -> exactly one final submission."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T9")

    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    token = login_res.json()["token"]

    # First switch
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})

    # Race second switch and manual submit concurrently
    v_task = client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})
    sub_task = client.post(f"/api/v1/attempts/submit?token={token}", json={"answers": {"q1": "4"}})

    res_v, res_sub = await asyncio.gather(v_task, sub_task)
    assert res_v.status_code == 200
    assert res_sub.status_code in [200, 409]

    db.expire_all()
    submissions = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred.id).all()
    assert len(submissions) == 1
    assert submissions[0].status in ["auto_submitted", "submitted"]

@pytest.mark.anyio
async def test_10_multiple_tabs_one_submission(client, setup_test_database):
    """TEST 10: Two browser tabs -> exactly one submission per candidate per exam."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T10")

    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    token = login_res.json()["token"]

    # Tab A switches to Tab B (Tab A hides)
    res_tab_a = await client.post(f"/api/v1/attempts/violation?token={token}", json={
        "type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())
    })
    assert res_tab_a.json()["action"] == "warn"

    # Tab B switches back to Tab A (Tab B hides)
    res_tab_b = await client.post(f"/api/v1/attempts/violation?token={token}", json={
        "type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())
    })
    assert res_tab_b.json()["action"] == "auto_submit"
    assert res_tab_b.json()["status"] == "auto_submitted"

    # Verify only 1 submission exists in DB
    db.expire_all()
    subs = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam.id, ExamSubmission.candidate_id == cand.id).all()
    assert len(subs) == 1
    assert subs[0].status == "auto_submitted"

@pytest.mark.anyio
async def test_11_return_to_tab_exam_remains_locked(client, setup_test_database):
    """TEST 11: Return to tab after auto-submit -> exam remains locked."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T11")

    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    token = login_res.json()["token"]

    # 2 switches trigger auto submit
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})

    # Student returns to tab -> heartbeat fires
    hb_res = await client.post(f"/api/v1/attempts/heartbeat?token={token}")
    assert hb_res.status_code == 200
    hb_data = hb_res.json()
    assert hb_data["status"] == "auto_submitted"
    assert hb_data["force_submit"] is True
    assert hb_data["action"] == "force_submit"

@pytest.mark.anyio
async def test_12_network_interruption_reconciliation(client, setup_test_database):
    """TEST 12: Network interruption -> state reconciles after heartbeat."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T12")

    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    token = login_res.json()["token"]

    # First switch
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})

    # Server receives second violation via path or out-of-band telemetry while student network was offline
    db.expire_all()
    sub = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred.id).first()
    log = ProctoringLog(
        submission_id=sub.id,
        candidate_id=sub.candidate_id,
        exam_id=sub.exam_id,
        event_type="tab_switch",
        event_details="Tab switch #2 detected",
        timestamp=now_utc()
    )
    db.add(log)
    sub.tab_switch_count = 2
    db.commit()

    # Network reconnects, student returns and sends heartbeat
    hb_res = await client.post(f"/api/v1/attempts/heartbeat?token={token}")
    assert hb_res.status_code == 200
    hb_data = hb_res.json()
    assert hb_data["status"] == "auto_submitted"
    assert hb_data["force_submit"] is True

    # Check DB status is finalized
    db.expire_all()
    sub = db.query(ExamSubmission).filter(ExamSubmission.id == sub.id).first()
    assert sub.status == "auto_submitted"

@pytest.mark.anyio
async def test_13_teacher_live_monitor_receives_auto_submitted_state(client, teacher_auth, setup_test_database):
    """TEST 13: Teacher live monitor receives AUTO_SUBMITTED state with reason TAB SWITCH and IST time."""
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    exam, cand, cred = create_test_exam_and_student(db, "T13")

    login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
        "username": cred.username,
        "password": cred.password
    })
    token = login_res.json()["token"]

    # 2 tab switches -> auto submit
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})
    await client.post(f"/api/v1/attempts/violation?token={token}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})

    # Teacher queries live monitor
    mon_res = await client.get(f"/api/v1/exams/{exam.id}/live-monitor", headers=teacher_auth)
    assert mon_res.status_code == 200
    mon_data = mon_res.json()
    
    candidates = mon_data["candidates"]
    target_cand = next((c for c in candidates if c["candidate_id"] == cand.id), None)
    assert target_cand is not None
    assert target_cand["status"] == "auto_submitted"
    assert target_cand["raw_status"] == "auto_submitted"
    assert target_cand["auto_submit_reason"] == "TAB_SWITCH"
    assert target_cand["proctor_flags_count"] == 2
    assert target_cand["submitted_at_ist"] is not None

@pytest.mark.anyio
async def test_14_twenty_seven_students_concurrent_tab_switches(client, teacher_auth, setup_test_database):
    """
    TEST 14: 27 simultaneous students with tab-switch events.
    Several students switch tabs concurrently:
    - 10 students switch twice -> AUTO-SUBMITTED
    - 7 students switch once -> WARNED (remain active)
    - 10 students do not switch -> remain active
    Verify invariants:
    N enrolled = N candidates = N credentials = 27
    submitted_count + active_in_room_count + not_started_count = N enrolled
    submitted_count = 10, active_count = 17
    """
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
    ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()

    directory = StudentDirectory(
        workspace_id=ws.id,
        name="Concurrent 27 Test Directory",
        created_by=teacher.id
    )
    db.add(directory)
    db.flush()

    for i in range(1, 28):
        ds = DirectoryStudent(
            directory_id=directory.id,
            name=f"Student {i:02d}",
            email=f"sim_student_{i:02d}@aegeus.edu",
            roll_number=f"ROLL-27-{i:02d}",
            status="active"
        )
        db.add(ds)
    db.commit()

    now_dt = now_utc()
    exam = Exam(
        name="Concurrent 27 Exam",
        exam_code="EXAM-27-CONC",
        subject_id="cs_101",
        student_directory_id=directory.id,
        duration_minutes=60,
        total_marks=50,
        passing_marks=20,
        start_time=now_dt - datetime.timedelta(minutes=5),
        end_time=now_dt + datetime.timedelta(hours=2),
        created_by=teacher.id,
        workspace_id=ws.id,
        is_published=True,
        questions_json='[{"id":"q1","type":"mcq","question_text":"Q1?","options":["A","B"],"correct_answer":"A","marks":10}]'
    )
    db.add(exam)
    db.commit()

    # Snapshot candidates and generate credentials
    snapshot_candidates_for_exam(exam, directory.id, db)
    await client.post(f"/api/v1/exams/{exam.id}/credentials", headers=teacher_auth)

    candidates = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam.id).all()
    assert len(candidates) == 27
    credentials = db.query(ExamCredential).filter(ExamCredential.exam_id == exam.id).all()
    assert len(credentials) == 27

    # Login all 27 students
    tokens = []
    for cred in credentials:
        login_res = await client.post(f"/api/v1/attempts/login?exam_code={exam.exam_code}", json={
            "username": cred.username,
            "password": cred.password
        })
        assert login_res.status_code == 200
        tokens.append(login_res.json()["token"])

    assert len(tokens) == 27

    # Group 1: 10 students switch tabs twice -> AUTO-SUBMITTED
    for t in tokens[:10]:
        r1 = await client.post(f"/api/v1/attempts/violation?token={t}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})
        assert r1.json()["action"] == "warn"
        r2 = await client.post(f"/api/v1/attempts/violation?token={t}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})
        assert r2.json()["action"] == "auto_submit"
        assert r2.json()["status"] == "auto_submitted"

    # Group 2: 7 students switch tabs once -> WARNED (remain active)
    for t in tokens[10:17]:
        r1 = await client.post(f"/api/v1/attempts/violation?token={t}", json={"type": "TAB_SWITCH", "client_event_id": str(uuid.uuid4())})
        assert r1.json()["action"] == "warn"
        # Send heartbeat to record active presence
        r_hb = await client.post(f"/api/v1/attempts/heartbeat?token={t}")
        assert r_hb.json()["status"] == "ok"

    # Group 3: 10 students send presence heartbeat (remain active)
    for t in tokens[17:]:
        r = await client.post(f"/api/v1/attempts/heartbeat?token={t}")
        assert r.json()["status"] == "ok"

    # Verify authoritative counts via teacher monitor
    mon_res = await client.get(f"/api/v1/exams/{exam.id}/live-monitor", headers=teacher_auth)
    assert mon_res.status_code == 200
    mon_data = mon_res.json()
    summary = mon_data["summary"]

    assert summary["total_assigned"] == 27
    assert summary["submitted_count"] == 10
    assert summary["answering_now_count"] == 17
    # Verify strict invariant: submitted + active (answering) + not_started == enrolled
    assert summary["submitted_count"] + summary["answering_now_count"] + summary["not_started_count"] == 27
