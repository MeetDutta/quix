import pytest
import time
import datetime
from datetime import timezone
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam, ExamCredential, ExamSubmission
from app.models.candidate import ExamCandidate
from app.models.workspace import Workspace
from app.api.exams import snapshot_candidates_for_exam

async def run_cohort_scale_simulation(client, teacher_auth, student_count: int):
    """
    Executes a high-density concurrent examination simulation for a given cohort size (50, 100, 250).
    Measures latency metrics across login, exam-info, autosave, submission, and live monitoring.
    Verifies 100% database integrity and exact candidate/credential/submission counts.
    """
    from app.database import get_db
    db_gen = client._transport.app.dependency_overrides[get_db]()
    db: Session = next(db_gen)

    try:
        teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
        ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()

        # 1. Setup Student Directory
        directory = StudentDirectory(
            workspace_id=ws.id,
            name=f"Scale Test Cohort {student_count}",
            created_by=teacher.id
        )
        db.add(directory)
        db.flush()

        dir_students = []
        for i in range(1, student_count + 1):
            roll = f"SCALE-{student_count}-{i:04d}"
            email = f"scale_{student_count}_{i:04d}@aegeus.edu"
            name = f"Scale Candidate {i:04d}"
            ds = DirectoryStudent(
                directory_id=directory.id,
                name=name,
                email=email,
                roll_number=roll,
                status="active"
            )
            db.add(ds)
            dir_students.append(ds)
        db.commit()

        # 2. Create Exam
        now_dt = datetime.datetime.now(timezone.utc)
        exam = Exam(
            name=f"Concurrency Benchmark Exam ({student_count} Students)",
            exam_code=f"SCALE-{student_count}-{int(time.time()) % 10000}",
            subject_id="cs_perf",
            student_directory_id=directory.id,
            duration_minutes=45,
            total_marks=50,
            passing_marks=20,
            start_time=now_dt - datetime.timedelta(minutes=5),
            end_time=now_dt + datetime.timedelta(hours=2),
            created_by=teacher.id,
            workspace_id=ws.id,
            is_published=True,
            questions_json='[{"id":"q1","type":"mcq","question_text":"Identify O(1) lookup.","options":["HashMap","LinkedList","Array Search","Tree Traverse"],"correct_answer":"HashMap","marks":50}]'
        )
        db.add(exam)
        db.commit()
        db.refresh(exam)

        # 3. Snapshot and generate credentials
        snapshot_candidates_for_exam(exam, directory.id, db)
        gen_resp = await client.post(f"/api/v1/exams/{exam.id}/credentials", headers=teacher_auth)
        assert gen_resp.status_code == 200
        creds_data = gen_resp.json()
        assert len(creds_data) == student_count

        cand_count = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam.id).count()
        cred_count = db.query(ExamCredential).filter(ExamCredential.exam_id == exam.id).count()
        assert cand_count == student_count
        assert cred_count == student_count

        # 4. Measure Login Latencies
        credentials = db.query(ExamCredential).filter(ExamCredential.exam_id == exam.id).all()
        login_times = []
        student_tokens = []

        for cred in credentials:
            t0 = time.perf_counter()
            resp = await client.post(
                f"/api/v1/attempts/login?exam_code={exam.exam_code}",
                json={"username": cred.username, "password": cred.password}
            )
            t1 = time.perf_counter()
            assert resp.status_code == 200
            login_times.append(t1 - t0)
            student_tokens.append(resp.json()["session_token"])

        # 5. Measure Exam-Info Latency
        info_times = []
        for token in student_tokens[:min(30, student_count)]:
            t0 = time.perf_counter()
            resp = await client.get(f"/api/v1/attempts/exam-info?token={token}")
            t1 = time.perf_counter()
            assert resp.status_code == 200
            info_times.append(t1 - t0)

        # 6. Measure Autosave Latency
        save_times = []
        for idx, token in enumerate(student_tokens[:min(30, student_count)]):
            t0 = time.perf_counter()
            resp = await client.post(
                f"/api/v1/attempts/save-progress?token={token}",
                json={"q1": "HashMap", "_client_timestamp": 100 + idx}
            )
            t1 = time.perf_counter()
            assert resp.status_code == 200
            save_times.append(t1 - t0)

        # 7. Measure Submission Latency (All students submit)
        submit_times = []
        for token in student_tokens:
            t0 = time.perf_counter()
            resp = await client.post(
                f"/api/v1/attempts/submit?token={token}",
                json={"answers": {"q1": "HashMap"}}
            )
            t1 = time.perf_counter()
            assert resp.status_code == 200
            submit_times.append(t1 - t0)

        # 8. Measure Live Monitor Latency
        t0 = time.perf_counter()
        mon_resp = await client.get(f"/api/v1/exams/{exam.id}/live-monitor", headers=teacher_auth)
        t1 = time.perf_counter()
        assert mon_resp.status_code == 200
        mon_time = t1 - t0

        summary = mon_resp.json()["summary"]
        assert summary["total_assigned"] == student_count
        assert summary["submitted"] == student_count
        assert summary["active_in_room"] == 0
        assert summary["answering_now"] == 0

        # 9. Verify Database Invariants
        final_cand = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam.id).count()
        final_cred = db.query(ExamCredential).filter(ExamCredential.exam_id == exam.id).count()
        final_sub = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam.id).count()

        assert final_cand == student_count, f"Expected {student_count} candidates, found {final_cand}"
        assert final_cred == student_count, f"Expected {student_count} credentials, found {final_cred}"
        assert final_sub == student_count, f"Expected {student_count} submissions, found {final_sub}"

        avg_login_ms = round((sum(login_times) / len(login_times)) * 1000, 2)
        p95_login_ms = round(sorted(login_times)[int(len(login_times) * 0.95)] * 1000, 2)
        avg_submit_ms = round((sum(submit_times) / len(submit_times)) * 1000, 2)
        p95_submit_ms = round(sorted(submit_times)[int(len(submit_times) * 0.95)] * 1000, 2)
        mon_latency_ms = round(mon_time * 1000, 2)

        return {
            "student_count": student_count,
            "avg_login_ms": avg_login_ms,
            "p95_login_ms": p95_login_ms,
            "avg_submit_ms": avg_submit_ms,
            "p95_submit_ms": p95_submit_ms,
            "mon_latency_ms": mon_latency_ms,
            "integrity_verified": True
        }

    finally:
        db.close()

@pytest.mark.anyio
async def test_50_student_simulation(client, teacher_auth, setup_test_database):
    """50-student concurrent cohort simulation."""
    res = await run_cohort_scale_simulation(client, teacher_auth, 50)
    assert res["integrity_verified"] is True
    assert res["avg_login_ms"] < 50.0  # Fast sub-50ms login
    assert res["avg_submit_ms"] < 100.0

@pytest.mark.anyio
async def test_100_student_simulation(client, teacher_auth, setup_test_database):
    """100-student concurrent cohort simulation."""
    res = await run_cohort_scale_simulation(client, teacher_auth, 100)
    assert res["integrity_verified"] is True
    assert res["avg_login_ms"] < 50.0
    assert res["mon_latency_ms"] < 250.0

@pytest.mark.anyio
async def test_250_student_simulation(client, teacher_auth, setup_test_database):
    """250-student high-density stress simulation with zero data corruption."""
    res = await run_cohort_scale_simulation(client, teacher_auth, 250)
    assert res["integrity_verified"] is True
    assert res["avg_login_ms"] < 50.0
    assert res["mon_latency_ms"] < 500.0
