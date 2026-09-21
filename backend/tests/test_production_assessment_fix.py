import os
import json
import pytest
from app.config import settings
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam, ExamCredential
from app.models.candidate import ExamCandidate
from app.models.document import Document, DocumentChunk
from app.models.workspace import Workspace
from app.models.user import User
from tests.conftest import TestingSessionLocal

@pytest.mark.anyio
async def test_reproduction_thermo_assessment_generation_and_publishing(client, teacher_auth):
    """
    Exact Reproduction Scenario from Bug Report:
    - Assessment title: Again
    - Knowledge Base source: thermo
    - Question count: 5 MCQs
    - Duration: 30 minutes
    - Total marks: 50
    - Passing marks: 20
    - Student directory: CB123
    - Number of candidates: 2
    - Marking scheme: Equal marks
    - Action: Generate & Publish Assessment
    - Environment: Production simulation
    """
    settings.ENVIRONMENT = "production"

    # 1. Setup Student Directory 'CB123' with 2 candidates in teacher's workspace
    db = TestingSessionLocal()
    try:
        teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
        ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()

        # Seed student directory CB123
        dir_cb123 = StudentDirectory(
            workspace_id=ws.id,
            name="CB123",
            description="Production reproduction directory",
            created_by=teacher.id,
            is_active=True
        )
        db.add(dir_cb123)
        db.flush()

        # Add 2 candidates to CB123
        cand1 = DirectoryStudent(
            directory_id=dir_cb123.id,
            name="Candidate One",
            email="candidate1@cb123.edu",
            roll_number="CB123-01",
            status="active"
        )
        cand2 = DirectoryStudent(
            directory_id=dir_cb123.id,
            name="Candidate Two",
            email="candidate2@cb123.edu",
            roll_number="CB123-02",
            status="active"
        )
        db.add_all([cand1, cand2])

        # Seed Knowledge Base document for 'thermo'
        doc_thermo = Document(
            title="thermo",
            subject_id="thermo",
            filename="thermo_handbook.txt",
            file_path="/tmp/thermo_handbook.txt",
            file_hash="hash_thermo_123",
            workspace_id=ws.id,
            uploader_id=teacher.id
        )
        db.add(doc_thermo)
        db.flush()

        chunk1 = DocumentChunk(
            document_id=doc_thermo.id,
            content="The first law of thermodynamics is the law of conservation of energy. It states energy cannot be created or destroyed.",
            chunk_index=0,
            page_number=1
        )
        chunk2 = DocumentChunk(
            document_id=doc_thermo.id,
            content="The second law of thermodynamics introduces entropy. In any spontaneous cyclic process, total entropy increases.",
            chunk_index=1,
            page_number=2
        )
        db.add_all([chunk1, chunk2])
        db.commit()

        dir_id = dir_cb123.id
    finally:
        db.close()

    # 2. Execute assessment creation with 'is_published=True' and directory name 'CB123'
    payload = {
        "name": "Again",
        "subject_id": "thermo",
        "topic": "Thermodynamics",
        "num_questions": 5,
        "question_type": "mcq",
        "difficulty": "medium",
        "duration_minutes": 30,
        "total_marks": 50.0,
        "passing_marks": 20.0,
        "student_directory_id": "CB123", # Test directory name resolution
        "is_published": True
    }

    res = await client.post("/api/v1/exams/generate-from-kb", headers=teacher_auth, json=payload)
    assert res.status_code == 200, f"Failed with status {res.status_code}: {res.text}"
    exam_data = res.json()

    # Assert response contains correlation ID header
    assert "X-Request-ID" in res.headers

    exam_id = exam_data["id"]
    assert exam_data["name"] == "Again"
    assert exam_data["is_published"] is True
    assert exam_data["total_marks"] == 50.0
    assert exam_data["passing_marks"] == 20.0

    questions = json.loads(exam_data["questions_json"])
    assert len(questions) == 5
    for q in questions:
        assert q["question_type"] in ["mcq", "true_false", "subjective"]

    # 3. Verify in database: exactly 1 exam created, 2 candidates assigned with credentials
    db = TestingSessionLocal()
    try:
        exam_in_db = db.query(Exam).filter(Exam.id == exam_id).first()
        assert exam_in_db is not None
        assert exam_in_db.is_published is True
        assert exam_in_db.student_directory_id == dir_id

        # Verify candidate snapshotting
        candidates = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam_id).all()
        assert len(candidates) == 2
        cand_names = {c.name_snapshot for c in candidates}
        assert "Candidate One" in cand_names
        assert "Candidate Two" in cand_names

        # Verify credentials generated for both candidates
        credentials = db.query(ExamCredential).filter(ExamCredential.exam_id == exam_id).all()
        assert len(credentials) == 2
        for cred in credentials:
            assert cred.username.startswith(exam_in_db.exam_code)
            assert len(cred.password) >= 6
    finally:
        db.close()


@pytest.mark.anyio
async def test_directory_resolution_by_uuid_and_name(client, teacher_auth):
    """Verifies that both UUID and directory name resolve correctly."""
    db = TestingSessionLocal()
    try:
        teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
        ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()

        d = StudentDirectory(
            workspace_id=ws.id,
            name="Batch-Alpha-2026",
            created_by=teacher.id,
            is_active=True
        )
        db.add(d)
        db.flush()

        s = DirectoryStudent(
            directory_id=d.id,
            name="Alpha Student",
            email="alpha@batch.edu",
            roll_number="ALPHA-01",
            status="active"
        )
        db.add(s)
        db.commit()
        dir_uuid = d.id
    finally:
        db.close()

    # Call with UUID
    res_uuid = await client.post("/api/v1/exams/generate-from-kb", headers=teacher_auth, json={
        "name": "UUID Test Exam",
        "subject_id": "general_101",
        "num_questions": 2,
        "student_directory_id": dir_uuid,
        "is_published": True
    })
    assert res_uuid.status_code == 200
    assert res_uuid.json()["student_directory_id"] == dir_uuid

    # Call with Name
    res_name = await client.post("/api/v1/exams/generate-from-kb", headers=teacher_auth, json={
        "name": "Name Test Exam",
        "subject_id": "general_101",
        "num_questions": 2,
        "student_directory_id": "Batch-Alpha-2026",
        "is_published": True
    })
    assert res_name.status_code == 200
    assert res_name.json()["student_directory_id"] == dir_uuid


@pytest.mark.anyio
async def test_fallback_when_kb_is_empty_or_sparse(client, teacher_auth):
    """Verifies that an unknown or empty KB source falls back gracefully without 500 error."""
    res = await client.post("/api/v1/exams/generate-from-kb", headers=teacher_auth, json={
        "name": "Sparse KB Exam",
        "subject_id": "nonexistent_subject_999",
        "topic": "Quantum Computing",
        "num_questions": 3,
        "is_published": False
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_published"] is False
    questions = json.loads(data["questions_json"])
    assert len(questions) == 3


@pytest.mark.anyio
async def test_atomic_transaction_rollback_on_failure(client, teacher_auth, monkeypatch):
    """
    Verifies that if candidate snapshotting raises an error, the database transaction
    is completely rolled back and NO orphaned exam is left behind.
    """
    db = TestingSessionLocal()
    try:
        teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
        ws = db.query(Workspace).filter(Workspace.owner_id == teacher.id).first()

        dir_fail = StudentDirectory(
            workspace_id=ws.id,
            name="FailDir",
            created_by=teacher.id,
            is_active=True
        )
        db.add(dir_fail)
        db.commit()
        dir_id = dir_fail.id
        initial_exam_count = db.query(Exam).count()
    finally:
        db.close()

    # Simulate an error during candidate snapshotting
    import app.api.exams as exams_module
    def broken_snapshot(*args, **kwargs):
        raise RuntimeError("Simulated snapshot database failure")

    monkeypatch.setattr(exams_module, "snapshot_candidates_for_exam", broken_snapshot)

    res = await client.post("/api/v1/exams/generate-from-kb", headers=teacher_auth, json={
        "name": "Doomed Assessment",
        "subject_id": "general_101",
        "student_directory_id": dir_id,
        "num_questions": 2
    })
    assert res.status_code == 500

    # Check that NO exam was left behind in the database
    db = TestingSessionLocal()
    try:
        post_exam_count = db.query(Exam).count()
        assert post_exam_count == initial_exam_count, "Orphaned exam record was NOT rolled back!"
        doomed_exam = db.query(Exam).filter(Exam.name == "Doomed Assessment").first()
        assert doomed_exam is None, "Partially created exam was found in DB after failure!"
    finally:
        db.close()
