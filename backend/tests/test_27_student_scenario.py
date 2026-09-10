import pytest
import datetime
from datetime import timezone
from sqlalchemy.orm import Session
from app.models.user import User, Student
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam, ExamCredential, ExamSubmission, ProctoringLog
from app.models.candidate import ExamCandidate
from app.models.institution import Institution, Department
from app.models.workspace import Workspace
from app.utils.security import create_access_token, get_password_hash
from app.api.exams import snapshot_candidates_for_exam

@pytest.mark.anyio
async def test_27_student_full_lifecycle(client, teacher_auth, setup_test_database):
    """
    Simulates the exact 27-student real-world examination scenario:
    1. Create 27 unique students in a StudentDirectory.
    2. Test idempotent credential generation (calling twice produces exactly 27 candidates and 27 credentials).
    3. Verify live monitor shows Enrolled = 27, Active = 0, Submitted = 0, Not Started = 27.
    4. 27 students login and access exam.
    5. Simulate 10 active students (sending heartbeats), 7 disconnected students (stale heartbeats > 30s), and 10 submitted students.
    6. Verify live monitor metrics: Enrolled = 27, Active = 10, Disconnected = 7, Submitted = 10.
    7. Submit the remaining 10 active students -> Submitted = 20, Active = 0.
    8. Simulate timer expiration on the remaining 7 disconnected students -> auto-submits.
    9. Verify final state: Enrolled = 27, Active = 0, Answering = 0, Submitted = 27, exactly 27 submissions, 0 duplicates.
    10. Verify idempotent submission (submitting again returns existing result, no duplicates).
    11. Verify autosave rejection after deadline / submission.
    """
    from app.database import get_db
    db_gen = client._transport.app.dependency_overrides[get_db]()
    db: Session = next(db_gen)

    try:
        # 1. Setup teacher and workspace
        teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
        assert teacher is not None
        ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()
        assert ws is not None

        # 2. Setup a StudentDirectory with 27 unique students
        directory = StudentDirectory(
            workspace_id=ws.id,
            name="Class 2026 Batch A",
            created_by=teacher.id
        )
        db.add(directory)
        db.flush()

        dir_students = []
        for i in range(1, 28):
            roll = f"CS-2026-{i:03d}"
            email = f"student{i:02d}@aegeus.edu"
            name = f"Student {i:02d} Name"
            ds = DirectoryStudent(
                directory_id=directory.id,
                name=name,
                email=email,
                roll_number=roll,
                status="active",
                division="A",
                department="Computer Science"
            )
            db.add(ds)
            dir_students.append(ds)
        db.commit()
        assert len(dir_students) == 27

        # 3. Create Exam linked to directory
        now_dt = datetime.datetime.now(timezone.utc)
        exam = Exam(
            name="Midterm Computer Science Assessment",
            exam_code="CS101-27",
            subject_id="cs_101",
            student_directory_id=directory.id,
            duration_minutes=60,
            total_marks=100,
            passing_marks=40,
            start_time=now_dt - datetime.timedelta(minutes=10),
            end_time=now_dt + datetime.timedelta(hours=3),
            created_by=teacher.id,
            workspace_id=ws.id,
            is_published=True,
            questions_json='[{"id":"q1","type":"mcq","question_text":"What is 2+2?","options":["3","4","5","6"],"correct_answer":"4","marks":10}]'
        )
        db.add(exam)
        db.commit()
        db.refresh(exam)

        # 4. Enroll the 27 students & test IDEMPOTENCY of snapshot and credentials
        # Call 1: Snapshot and generate credentials
        snapshot_candidates_for_exam(exam, directory.id, db)
        gen_resp_1 = await client.post(
            f"/api/v1/exams/{exam.id}/credentials",
            headers=teacher_auth
        )
        assert gen_resp_1.status_code == 200
        creds_1 = gen_resp_1.json()
        assert len(creds_1) == 27
        cand_count_1 = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam.id).count()
        cred_count_1 = db.query(ExamCredential).filter(ExamCredential.exam_id == exam.id).count()
        assert cand_count_1 == 27
        assert cred_count_1 == 27

        # Call 2: Call snapshot & credentials AGAIN (repeated publish / credential generation)
        snapshot_candidates_for_exam(exam, directory.id, db)
        gen_resp_2 = await client.post(
            f"/api/v1/exams/{exam.id}/credentials",
            headers=teacher_auth
        )
        assert gen_resp_2.status_code == 200
        cand_count_2 = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam.id).count()
        cred_count_2 = db.query(ExamCredential).filter(ExamCredential.exam_id == exam.id).count()
        # MUST STILL BE 27, NEVER 54!
        assert cand_count_2 == 27, f"Duplicate candidates created! Found {cand_count_2}"
        assert cred_count_2 == 27, f"Duplicate credentials created! Found {cred_count_2}"

        # 5. Check Live Monitor Initial State
        resp = await client.get(
            f"/api/v1/exams/{exam.id}/live-monitor",
            headers=teacher_auth
        )
        assert resp.status_code == 200
        data = resp.json()
        summary = data["summary"]
        assert summary["total_assigned"] == 27
        assert summary["active_in_room"] == 0
        assert summary["answering_now"] == 0
        assert summary["submitted"] == 0
        assert summary["not_started"] == 27

        # 6. All 27 students log in
        credentials = db.query(ExamCredential).filter(ExamCredential.exam_id == exam.id).all()
        student_sessions = []
        for cred in credentials:
            login_resp = await client.post(
                f"/api/v1/attempts/login?exam_code={exam.exam_code}",
                json={"username": cred.username, "password": cred.password}
            )
            assert login_resp.status_code == 200, f"Login failed for {cred.username}: {login_resp.text}"
            token = login_resp.json()["session_token"]
            student_sessions.append((cred, token))

        assert len(student_sessions) == 27

        # Verify all 27 have exactly 1 submission row
        sub_count = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam.id).count()
        assert sub_count == 27

        # 7. Simulate distribution:
        # - First 10 students submit
        # - Next 10 students active (send recent heartbeat)
        # - Next 7 students disconnected (last seen 60s ago)
        
        # 10 Students submit:
        for cred, token in student_sessions[:10]:
            sub_resp = await client.post(f"/api/v1/attempts/submit?token={token}")
            assert sub_resp.status_code == 200

        # 10 Students send heartbeat (Active):
        for cred, token in student_sessions[10:20]:
            hb_resp = await client.post(f"/api/v1/attempts/heartbeat?token={token}")
            assert hb_resp.status_code == 200

        # 7 Students disconnected (manually set last_seen_at = 60 seconds ago):
        past_60s = datetime.datetime.now(timezone.utc) - datetime.timedelta(seconds=60)
        for cred, token in student_sessions[20:]:
            sub = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred.id).first()
            sub.last_seen_at = past_60s
        db.commit()

        # 8. Verify Live Monitor matches: Enrolled=27, Active=10, Answering=10, Disconnected=7, Submitted=10
        resp = await client.get(
            f"/api/v1/exams/{exam.id}/live-monitor",
            headers=teacher_auth
        )
        assert resp.status_code == 200
        data = resp.json()
        summary = data["summary"]
        assert summary["total_assigned"] == 27
        assert summary["submitted"] == 10
        assert summary["active_in_room"] == 10
        assert summary["answering_now"] == 10
        assert summary["disconnected"] == 7
        assert summary["not_started"] == 0

        # Verify submitted students DO NOT appear as answering or active
        for cand in data["candidates"]:
            if cand["status"] == "submitted":
                assert cand["connection_status"] == "completed"

        # 9. Submit the 10 active students
        for cred, token in student_sessions[10:20]:
            sub_resp = await client.post(f"/api/v1/attempts/submit?token={token}")
            assert sub_resp.status_code == 200

        resp = await client.get(
            f"/api/v1/exams/{exam.id}/live-monitor",
            headers=teacher_auth
        )
        summary = resp.json()["summary"]
        assert summary["submitted"] == 20
        assert summary["active_in_room"] == 0
        assert summary["answering_now"] == 0
        assert summary["disconnected"] == 7

        # 10. Simulate deadline passing for remaining 7 disconnected students
        past_deadline = datetime.datetime.now(timezone.utc) - datetime.timedelta(minutes=5)
        for cred, token in student_sessions[20:]:
            sub = db.query(ExamSubmission).filter(ExamSubmission.credential_id == cred.id).first()
            sub.deadline_at = past_deadline
        db.commit()

        # Fetch live monitor -> Trigger server-authoritative auto-submit sweep!
        resp = await client.get(
            f"/api/v1/exams/{exam.id}/live-monitor",
            headers=teacher_auth
        )
        summary = resp.json()["summary"]
        assert summary["total_assigned"] == 27
        assert summary["submitted"] == 27
        assert summary["active_in_room"] == 0
        assert summary["answering_now"] == 0
        assert summary["disconnected"] == 0

        # 11. Verify Database Integrity: Exactly 27 candidates, 27 credentials, 27 submissions
        final_cand_count = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam.id).count()
        final_cred_count = db.query(ExamCredential).filter(ExamCredential.exam_id == exam.id).count()
        final_sub_count = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam.id).count()

        assert final_cand_count == 27
        assert final_cred_count == 27
        assert final_sub_count == 27

        # 12. Idempotency test: submit again on an already submitted session
        already_submitted_token = student_sessions[0][1]
        re_sub = await client.post(f"/api/v1/attempts/submit?token={already_submitted_token}")
        assert re_sub.status_code == 200  # Idempotent return!
        
        # Submissions count must still be 27!
        assert db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam.id).count() == 27

        # 13. Autosave after deadline / submission must be rejected
        save_resp = await client.post(
            f"/api/v1/attempts/save-progress?token={already_submitted_token}",
            json={"q1": "4"}
        )
        assert save_resp.status_code == 400
        assert "submitted" in save_resp.text.lower() or "expired" in save_resp.text.lower()

    finally:
        db.close()
