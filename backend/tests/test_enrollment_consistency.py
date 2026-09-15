import pytest
import datetime
import uuid
import json
import csv
import io
from sqlalchemy.orm import Session
from sqlalchemy import event

from app.database import get_db
from app.models.user import User, Student
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam, ExamCredential, ExamSubmission, ProctoringLog
from app.models.candidate import ExamCandidate
from app.models.workspace import Workspace
from app.utils.timezone import now_utc

def create_test_exam_with_candidates(db: Session, num_candidates: int = 4, prefix: str = "EC"):
    teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
    ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()

    directory = StudentDirectory(
        workspace_id=ws.id,
        name=f"Enrollment Dir {prefix}",
        created_by=teacher.id
    )
    db.add(directory)
    db.flush()

    dir_students = []
    for i in range(1, num_candidates + 1):
        s = DirectoryStudent(
            directory_id=directory.id,
            name=f"Candidate {prefix} {i}",
            email=f"cand_{prefix.lower()}_{i}_{uuid.uuid4().hex[:4]}@aegeus.edu",
            roll_number=f"ROLL-{prefix}-{i:03d}",
            status="active"
        )
        db.add(s)
        dir_students.append(s)
    db.flush()

    now_dt = now_utc()
    exam = Exam(
        name=f"Assessment {prefix}",
        exam_code=f"EX-{prefix}-{uuid.uuid4().hex[:4].upper()}",
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

    candidates = []
    for s in dir_students:
        cand = ExamCandidate(
            exam_id=exam.id,
            directory_student_id=s.id,
            name_snapshot=s.name,
            email_snapshot=s.email,
            roll_number_snapshot=s.roll_number,
            status="PENDING"
        )
        db.add(cand)
        candidates.append(cand)
    db.flush()
    db.commit()

    return exam, candidates, dir_students


@pytest.mark.anyio
async def test_canonical_count_consistency_none_started(client, teacher_auth):
    """
    Test 1: All enrolled candidates are not started.
    Both POST /credentials and GET /live-monitor must report the exact same count (4).
    """
    db = next(app_get_db())
    exam, cands, _ = create_test_exam_with_candidates(db, num_candidates=4, prefix="T1")
    exam_id = exam.id

    # 1. Fetch credentials
    cred_res = await client.post(f"/api/v1/exams/{exam_id}/credentials", headers=teacher_auth)
    assert cred_res.status_code == 200
    cred_data = cred_res.json()
    assert len(cred_data) == 4, f"Expected 4 credentials, got {len(cred_data)}"

    # Check candidate names match
    cred_names = {c["student_name"] for c in cred_data}
    assert cred_names == {f"Candidate T1 {i}" for i in range(1, 5)}

    # 2. Fetch live-monitor
    mon_res = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=teacher_auth)
    assert mon_res.status_code == 200
    mon_data = mon_res.json()

    assert mon_data["summary"]["total_assigned"] == 4, f"Live monitor showed {mon_data['summary']['total_assigned']} instead of 4"
    assert mon_data["summary"]["not_started"] == 4
    assert mon_data["summary"]["active_in_room"] == 0
    assert mon_data["summary"]["submitted"] == 0
    assert len(mon_data["candidates"]) == 4

    mon_names = {c["name"] for c in mon_data["candidates"]}
    assert mon_names == cred_names, "Candidate names in live monitor must match credentials preview exactly"

    # 3. Fetch CSV export
    csv_res = await client.get(f"/api/v1/exams/{exam_id}/credentials/export", headers=teacher_auth)
    assert csv_res.status_code == 200
    csv_reader = csv.reader(io.StringIO(csv_res.text))
    rows = list(csv_reader)
    header, data_rows = rows[0], rows[1:]
    assert header == ["student_name", "email", "roll_number", "exam_username", "exam_password", "expires_at"]
    assert len(data_rows) == 4, f"Expected 4 CSV rows, got {len(data_rows)}"


@pytest.mark.anyio
async def test_state_progression_invariance(client, teacher_auth):
    """
    Test 2: Starting and submitting an attempt does not change the enrolled count.
    Enrolled total remains 4 across all stages.
    """
    db = next(app_get_db())
    exam, cands, _ = create_test_exam_with_candidates(db, num_candidates=4, prefix="T2")
    exam_id = exam.id

    # Generate credentials
    cred_res = await client.post(f"/api/v1/exams/{exam_id}/credentials", headers=teacher_auth)
    assert cred_res.status_code == 200

    # Candidate 1: In Progress
    now_dt = now_utc()
    db.expire_all()
    cred0 = db.query(ExamCredential).filter(ExamCredential.candidate_id == cands[0].id).first()
    cred1 = db.query(ExamCredential).filter(ExamCredential.candidate_id == cands[1].id).first()

    sub1 = ExamSubmission(
        exam_id=exam_id,
        candidate_id=cands[0].id,
        credential_id=cred0.id,
        attempt_number=1,
        status="in_progress",
        started_at=now_dt,
        last_seen_at=now_dt,
        answers_json=json.dumps({"q1": "4"}),
        is_counted_for_result=True
    )
    db.add(sub1)

    # Candidate 2: Submitted
    sub2 = ExamSubmission(
        exam_id=exam_id,
        candidate_id=cands[1].id,
        credential_id=cred1.id,
        attempt_number=1,
        status="submitted",
        started_at=now_dt - datetime.timedelta(minutes=30),
        submitted_at=now_dt - datetime.timedelta(minutes=5),
        last_seen_at=now_dt - datetime.timedelta(minutes=5),
        answers_json=json.dumps({"q1": "4", "q2": "6"}),
        score=20,
        is_counted_for_result=True
    )
    db.add(sub2)
    db.commit()

    # Verify credentials endpoint
    cred_res2 = await client.post(f"/api/v1/exams/{exam_id}/credentials", headers=teacher_auth)
    assert len(cred_res2.json()) == 4

    # Verify live-monitor telemetry
    mon_res = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=teacher_auth)
    mon_data = mon_res.json()

    assert mon_data["summary"]["total_assigned"] == 4, "Total assigned must remain 4"
    assert mon_data["summary"]["active_in_room"] == 1
    assert mon_data["summary"]["submitted"] == 1
    assert mon_data["summary"]["not_started"] == 2
    assert len(mon_data["candidates"]) == 4


@pytest.mark.anyio
async def test_orphan_and_duplicate_credential_production_bug(client, teacher_auth):
    """
    Test 3: The exact production bug reproduction.
    Assessment has 2 real candidates and 2 unlinked orphaned credentials with candidate_id=None.
    Verify:
      1. Both Credentials Preview and Live Monitor display 2 candidates.
      2. No phantom rows named "Candidate" appear.
      3. Orphan credentials remain in DB without being destructively wiped.
    """
    db = next(app_get_db())
    exam, cands, _ = create_test_exam_with_candidates(db, num_candidates=2, prefix="T3")
    exam_id = exam.id

    # 1. Real credentials linked to candidate_id
    real_cred1 = ExamCredential(
        exam_id=exam_id,
        candidate_id=cands[0].id,
        username=f"{exam.exam_code.lower()}-roll001",
        password="password1",
        expires_at=now_utc() + datetime.timedelta(days=1)
    )
    real_cred2 = ExamCredential(
        exam_id=exam_id,
        candidate_id=cands[1].id,
        username=f"{exam.exam_code.lower()}-roll002",
        password="password2",
        expires_at=now_utc() + datetime.timedelta(days=1)
    )
    db.add_all([real_cred1, real_cred2])

    # 2. Add 2 orphaned credentials (e.g. uppercase username with candidate_id=None)
    orphan1 = ExamCredential(
        exam_id=exam_id,
        candidate_id=None,
        student_id=None,
        username=f"{exam.exam_code}-AM123",
        password="password3",
        expires_at=now_utc() + datetime.timedelta(days=1)
    )
    orphan2 = ExamCredential(
        exam_id=exam_id,
        candidate_id=None,
        student_id=None,
        username=f"{exam.exam_code}-CS441",
        password="password4",
        expires_at=now_utc() + datetime.timedelta(days=1)
    )
    db.add_all([orphan1, orphan2])
    db.commit()

    # Verify raw DB has 4 credentials
    all_creds_in_db = db.query(ExamCredential).filter(ExamCredential.exam_id == exam_id).all()
    assert len(all_creds_in_db) == 4, "Raw DB must have 4 credentials including orphans"

    # Call POST /credentials (Preview)
    cred_res = await client.post(f"/api/v1/exams/{exam_id}/credentials", headers=teacher_auth)
    assert cred_res.status_code == 200
    cred_data = cred_res.json()

    # Must return EXACTLY 2 candidates, NOT 4!
    assert len(cred_data) == 2, f"Credentials Preview displayed {len(cred_data)} instead of 2 canonical candidates"
    
    # Must NOT have any phantom 'Candidate' names
    for c in cred_data:
        assert c["student_name"] != "Candidate"
        assert c["student_name"] in [cands[0].name_snapshot, cands[1].name_snapshot]
        assert c["roll_number"] in [cands[0].roll_number_snapshot, cands[1].roll_number_snapshot]

    # Call GET /live-monitor
    mon_res = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=teacher_auth)
    assert mon_res.status_code == 200
    mon_data = mon_res.json()

    assert mon_data["summary"]["total_assigned"] == 2, f"Live Monitor showed {mon_data['summary']['total_assigned']} instead of 2"
    assert len(mon_data["candidates"]) == 2

    for cand_row in mon_data["candidates"]:
        assert cand_row["name"] != "Candidate"
        assert cand_row["name"] in [cands[0].name_snapshot, cands[1].name_snapshot]

    # Safety Rule Verification: Verify orphan credentials still exist in DB (no destructive deletion)
    db.expire_all()
    orphans_still_in_db = db.query(ExamCredential).filter(
        ExamCredential.exam_id == exam_id,
        ExamCredential.id.in_([orphan1.id, orphan2.id])
    ).all()
    assert len(orphans_still_in_db) == 2, "Safety violation: Orphan credentials must not be deleted from DB"

    # Verify CSV export also exports exactly 2 candidates
    csv_res = await client.get(f"/api/v1/exams/{exam_id}/credentials/export", headers=teacher_auth)
    csv_rows = list(csv.reader(io.StringIO(csv_res.text)))[1:]
    assert len(csv_rows) == 2, f"CSV export contained {len(csv_rows)} rows instead of 2"


@pytest.mark.anyio
async def test_legacy_student_credential_auto_synchronization(client, teacher_auth):
    """
    Test 4: Legacy students with Student profiles and unlinked credentials
    get auto-snapshotted into ExamCandidate so they appear properly in both interfaces.
    """
    db = next(app_get_db())
    teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
    student_user = db.query(User).filter(User.email == "student@aegeus.edu").first()
    student_profile = db.query(Student).filter(Student.user_id == student_user.id).first()
    ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()

    now_dt = now_utc()
    exam = Exam(
        name="Legacy Assessment",
        exam_code=f"EX-LEGACY-{uuid.uuid4().hex[:4].upper()}",
        subject_id="cs_101",
        duration_minutes=60,
        total_marks=20,
        passing_marks=10,
        start_time=now_dt - datetime.timedelta(minutes=10),
        end_time=now_dt + datetime.timedelta(hours=2),
        created_by=teacher.id,
        workspace_id=ws.id,
        is_published=True,
        questions_json=json.dumps([{"id": "q1", "type": "mcq", "question_text": "2+2?", "options": ["3", "4"], "correct_answer": "4", "marks": 10}])
    )
    db.add(exam)
    db.flush()

    # Legacy credential with student_id set, but candidate_id is None
    leg_cred = ExamCredential(
        exam_id=exam.id,
        student_id=student_profile.id,
        candidate_id=None,
        username=f"std_{student_user.id[:6]}",
        password="legacypassword",
        expires_at=now_dt + datetime.timedelta(days=1)
    )
    db.add(leg_cred)
    db.commit()

    # Call GET /live-monitor - should auto-create ExamCandidate snapshot and link it
    mon_res = await client.get(f"/api/v1/exams/{exam.id}/live-monitor", headers=teacher_auth)
    assert mon_res.status_code == 200
    mon_data = mon_res.json()
    assert mon_data["summary"]["total_assigned"] == 1
    assert mon_data["candidates"][0]["name"] == student_user.full_name

    # Call POST /credentials - should match exactly 1
    cred_res = await client.post(f"/api/v1/exams/{exam.id}/credentials", headers=teacher_auth)
    assert cred_res.status_code == 200
    cred_data = cred_res.json()
    assert len(cred_data) == 1
    assert cred_data[0]["student_name"] == student_user.full_name


@pytest.mark.anyio
async def test_cross_assessment_isolation(client, teacher_auth):
    """
    Test 5: Cross-assessment isolation. Exam A has 3 candidates, Exam B has 2 candidates.
    Counts and candidates must never leak across assessments.
    """
    db = next(app_get_db())
    exam_a, cands_a, _ = create_test_exam_with_candidates(db, num_candidates=3, prefix="EXA")
    exam_b, cands_b, _ = create_test_exam_with_candidates(db, num_candidates=2, prefix="EXB")

    # Exam A
    res_a_creds = await client.post(f"/api/v1/exams/{exam_a.id}/credentials", headers=teacher_auth)
    res_a_mon = await client.get(f"/api/v1/exams/{exam_a.id}/live-monitor", headers=teacher_auth)
    assert len(res_a_creds.json()) == 3
    assert res_a_mon.json()["summary"]["total_assigned"] == 3

    # Exam B
    res_b_creds = await client.post(f"/api/v1/exams/{exam_b.id}/credentials", headers=teacher_auth)
    res_b_mon = await client.get(f"/api/v1/exams/{exam_b.id}/live-monitor", headers=teacher_auth)
    assert len(res_b_creds.json()) == 2
    assert res_b_mon.json()["summary"]["total_assigned"] == 2


@pytest.mark.anyio
async def test_query_count_eager_loading_live_monitor(client, teacher_auth):
    """
    Test 6: Verify N+1 query elimination.
    Live monitor query count must stay low and flat regardless of candidate count.
    """
    from tests.conftest import test_engine

    db = next(app_get_db())
    # Create 10 candidates
    exam, _, _ = create_test_exam_with_candidates(db, num_candidates=10, prefix="PERF")

    # Generate credentials first so data is settled
    await client.post(f"/api/v1/exams/{exam.id}/credentials", headers=teacher_auth)

    query_count = 0
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        nonlocal query_count
        query_count += 1

    event.listen(test_engine, "before_cursor_execute", before_cursor_execute)
    try:
        mon_res = await client.get(f"/api/v1/exams/{exam.id}/live-monitor", headers=teacher_auth)
        assert mon_res.status_code == 200
        # If N+1 was present for 10 candidates, query count would be > 25 (2*10 + initial queries)
        # With joinedload and selectinload, it should be well under 10 queries.
        assert query_count < 10, f"Query count was {query_count} - N+1 query problem detected!"
    finally:
        event.remove(test_engine, "before_cursor_execute", before_cursor_execute)


def app_get_db():
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
