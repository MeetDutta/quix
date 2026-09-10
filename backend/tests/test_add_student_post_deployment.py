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
from app.utils.timezone import now_utc, to_iso_utc, to_utc_instant

def setup_test_workspace_and_exam(db: Session, suffix: str = "P1"):
    teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
    ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()
    
    # Directory with 2 students: one initial, one added later
    directory = StudentDirectory(
        workspace_id=ws.id,
        name=f"Post Deploy Directory {suffix}",
        created_by=teacher.id
    )
    db.add(directory)
    db.flush()

    s1 = DirectoryStudent(
        directory_id=directory.id,
        name=f"Initial Student {suffix}",
        email=f"initial_{suffix}_{uuid.uuid4().hex[:6]}@aegeus.edu",
        roll_number=f"INIT-{suffix}",
        status="active"
    )
    s2 = DirectoryStudent(
        directory_id=directory.id,
        name=f"Late Student {suffix}",
        email=f"late_{suffix}_{uuid.uuid4().hex[:6]}@aegeus.edu",
        roll_number=f"LATE-{suffix}",
        status="active"
    )
    db.add_all([s1, s2])
    db.flush()

    now_dt = now_utc()
    exam = Exam(
        name=f"Post-Deploy Assessment {suffix}",
        exam_code=f"DEP-{suffix}-{uuid.uuid4().hex[:4].upper()}",
        subject_id="cs_101",
        student_directory_id=directory.id,
        duration_minutes=45,
        total_marks=50,
        passing_marks=20,
        start_time=now_dt - datetime.timedelta(minutes=10),
        end_time=now_dt + datetime.timedelta(hours=2),
        created_by=teacher.id,
        workspace_id=ws.id,
        is_published=True,
        questions_json='[{"id":"q1","type":"mcq","question_text":"2+2?","options":["3","4"],"correct_answer":"4","marks":10}]'
    )
    db.add(exam)
    db.flush()

    # Enroll s1 initially (simulate deployment)
    cand1 = ExamCandidate(
        exam_id=exam.id,
        directory_student_id=s1.id,
        name_snapshot=s1.name,
        email_snapshot=s1.email,
        roll_number_snapshot=s1.roll_number
    )
    db.add(cand1)
    db.flush()

    cred1 = ExamCredential(
        exam_id=exam.id,
        candidate_id=cand1.id,
        username=f"U_{cand1.id[:8]}",
        password="testpassword",
        expires_at=exam.end_time
    )
    db.add(cred1)
    db.commit()

    return teacher, ws, exam, s1, s2

@pytest.mark.anyio
async def test_available_students_endpoint(client, teacher_auth):
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    teacher, ws, exam, s1, s2 = setup_test_workspace_and_exam(db, "AV1")
    
    res = await client.get(f"/api/v1/exams/{exam.id}/available-students", headers=teacher_auth)
    assert res.status_code == 200
    data = res.json()
    assert "students" in data
    student_ids = [s["id"] for s in data["students"]]
    # s1 should be excluded because already enrolled
    assert s1.id not in student_ids
    # s2 should be included
    assert s2.id in student_ids

@pytest.mark.anyio
async def test_add_student_post_deployment_success(client, teacher_auth):
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    teacher, ws, exam, s1, s2 = setup_test_workspace_and_exam(db, "SUC1")
    
    payload = {
        "student_id": s2.id,
        "notify_student": False
    }
    res = await client.post(f"/api/v1/exams/{exam.id}/candidates", json=payload, headers=teacher_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["message"] == "Student successfully enrolled in assessment"
    assert "credential" in data
    assert "candidate_id" in data
    
    # Verify in database
    db.expire_all()
    cand = db.query(ExamCandidate).filter(
        ExamCandidate.exam_id == exam.id,
        ExamCandidate.directory_student_id == s2.id
    ).first()
    assert cand is not None
    assert cand.name_snapshot == s2.name
    assert cand.email_snapshot == s2.email

    cred = db.query(ExamCredential).filter(ExamCredential.candidate_id == cand.id).first()
    assert cred is not None
    assert cred.password is not None
    # Verify bounded by exam end time
    assert to_utc_instant(cred.expires_at) <= to_utc_instant(exam.end_time)

    # Verify AuditLog
    log = db.query(AuditLog).filter(
        AuditLog.action == "STUDENT_ADDED_AFTER_DEPLOYMENT",
        AuditLog.user_id == teacher.id
    ).order_by(AuditLog.timestamp.desc()).first()
    assert log is not None
    details = json.loads(log.details)
    assert details["exam_id"] == exam.id
    assert details["student_id"] == s2.id

@pytest.mark.anyio
async def test_add_student_duplicate_enrollment_rejected(client, teacher_auth):
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    teacher, ws, exam, s1, s2 = setup_test_workspace_and_exam(db, "DUP1")
    
    # s1 is already enrolled
    payload = {"student_id": s1.id, "notify_student": False}
    res = await client.post(f"/api/v1/exams/{exam.id}/candidates", json=payload, headers=teacher_auth)
    assert res.status_code == 409
    assert "already enrolled" in res.json()["detail"].lower()

@pytest.mark.anyio
async def test_add_student_ended_exam_rejected(client, teacher_auth):
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    teacher, ws, exam, s1, s2 = setup_test_workspace_and_exam(db, "END1")
    
    # Move exam end_time into the past
    exam.end_time = now_utc() - datetime.timedelta(minutes=10)
    db.commit()

    payload = {"student_id": s2.id, "notify_student": False}
    res = await client.post(f"/api/v1/exams/{exam.id}/candidates", json=payload, headers=teacher_auth)
    assert res.status_code == 400
    assert "concluded" in res.json()["detail"].lower()

@pytest.mark.anyio
async def test_live_monitor_reflects_post_deploy_student(client, teacher_auth):
    from app.database import get_db
    db = next(client._transport.app.dependency_overrides[get_db]())
    teacher, ws, exam, s1, s2 = setup_test_workspace_and_exam(db, "LM1")
    
    # Add s2
    res_add = await client.post(
        f"/api/v1/exams/{exam.id}/candidates",
        json={"student_id": s2.id, "notify_student": False},
        headers=teacher_auth
    )
    assert res_add.status_code == 200

    # Fetch live monitor
    res_lm = await client.get(f"/api/v1/exams/{exam.id}/live-monitor", headers=teacher_auth)
    assert res_lm.status_code == 200
    lm_data = res_lm.json()
    candidates = lm_data["candidates"]
    s2_cand = next((c for c in candidates if c["email"] == s2.email), None)
    assert s2_cand is not None
    assert s2_cand["status"] == "not_started"
    assert s2_cand["attempt_number"] == 1
    assert s2_cand["can_grant_reattempt"] is False
