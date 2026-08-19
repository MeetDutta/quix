import os
import pytest
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.models.workspace import Workspace
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam
from app.models.candidate import ExamCandidate

TEST_DB_URL = "sqlite:///./test_quiz.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    # Run seed on test db
    db = TestingSessionLocal()
    from app.models.institution import Institution, Department, Course, Subject
    from app.utils.security import get_password_hash
    from app.services.workspace_service import bootstrap_personal_workspace
    
    inst = Institution(name="EduQuizX Academy")
    db.add(inst)
    db.flush()
    
    dept = Department(name="Computer Science", institution_id=inst.id)
    db.add(dept)
    db.flush()
    
    course = Course(name="Undergraduate CS", department_id=dept.id)
    db.add(course)
    db.flush()
    
    subj = Subject(name="General Knowledge", id="general_101", course_id=course.id)
    db.add(subj)
    db.commit()
    
    teacher = User(
        email="teacher@aegeus.edu",
        hashed_password=get_password_hash("securepassword"),
        full_name="Dr. Sarah Jenkins",
        role="teacher",
        institution_id=inst.id,
        is_active=True
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    bootstrap_personal_workspace(teacher, db)
        
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.mark.anyio
async def test_workspace_auto_bootstrap_on_login():
    """Verify that logging in as a teacher automatically provisions a personal workspace."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as ac:
        res = await ac.post("/api/v1/auth/login", json={
            "email": "teacher@aegeus.edu",
            "password": "securepassword"
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["role"] == "teacher"
        assert data["workspace_id"] is not None
        assert "Workspace" in data["workspace_name"]

@pytest.mark.anyio
async def test_multi_tenant_workspace_isolation():
    """Verify Teacher A cannot see or access Teacher B's exams."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as ac:
        # 1. Login as Teacher A
        res_a = await ac.post("/api/v1/auth/login", json={
            "email": "teacher@aegeus.edu",
            "password": "securepassword"
        })
        token_a = res_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 2. Register Teacher B
        res_b = await ac.post("/api/v1/auth/register", json={
            "email": "teacher_b@aegeus.edu",
            "password": "password123",
            "full_name": "Prof. Alan Turing",
            "role": "teacher"
        })
        assert res_b.status_code == 200

        # Login Teacher B
        login_b = await ac.post("/api/v1/auth/login", json={
            "email": "teacher_b@aegeus.edu",
            "password": "password123"
        })
        token_b = login_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 3. Teacher A creates an exam
        create_res = await ac.post("/api/v1/exams/", headers=headers_a, json={
            "name": "Teacher A Private Quiz",
            "subject_id": "general_101",
            "duration_minutes": 30,
            "total_marks": 50,
            "passing_marks": 20,
            "start_time": "2026-09-01T10:00:00",
            "end_time": "2026-09-01T12:00:00"
        })
        assert create_res.status_code == 200
        exam_a_id = create_res.json()["id"]

        # 4. Teacher B lists exams -> Must NOT see Teacher A's exam
        list_b = await ac.get("/api/v1/exams/", headers=headers_b)
        assert list_b.status_code == 200
        b_exam_ids = [e["id"] for e in list_b.json()]
        assert exam_a_id not in b_exam_ids

        # 5. Teacher B attempts to mutate/publish Teacher A's exam -> Must be rejected with 404
        publish_b = await ac.post(f"/api/v1/exams/{exam_a_id}/publish", headers=headers_b)
        assert publish_b.status_code == 404

@pytest.mark.anyio
async def test_student_directory_crud_and_validation():
    """Verify StudentDirectory CRUD, duplicate prevention, and student roster."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as ac:
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "teacher@aegeus.edu",
            "password": "securepassword"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create directory
        dir_res = await ac.post("/api/v1/student-directories/", headers=headers, json={
            "name": "Math Olympiad Batch",
            "description": "Advanced training class",
            "initial_students": [
                {"name": "Alice Smith", "email": "alice@example.com", "roll_number": "MATH-01"}
            ]
        })
        assert dir_res.status_code == 200
        dir_data = dir_res.json()
        assert dir_data["name"] == "Math Olympiad Batch"
        assert dir_data["student_count"] == 1
        dir_id = dir_data["id"]

        # 2. Add second student
        add_s = await ac.post(f"/api/v1/student-directories/{dir_id}/students", headers=headers, json={
            "name": "Bob Jones",
            "email": "bob@example.com",
            "roll_number": "MATH-02"
        })
        assert add_s.status_code == 200

        # 3. Duplicate email rejection in same directory
        dup_res = await ac.post(f"/api/v1/student-directories/{dir_id}/students", headers=headers, json={
            "name": "Alice Impostor",
            "email": "alice@example.com"
        })
        assert dup_res.status_code == 400
        assert "already exists" in dup_res.json()["detail"]

        # 4. List students
        students_res = await ac.get(f"/api/v1/student-directories/{dir_id}/students", headers=headers)
        assert students_res.status_code == 200
        assert len(students_res.json()) == 2

@pytest.mark.anyio
async def test_candidate_snapshotting_on_exam_creation():
    """Verify that creating an exam with a student_directory_id creates immutable ExamCandidate snapshots."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as ac:
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "teacher@aegeus.edu",
            "password": "securepassword"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create directory with 2 students
        dir_res = await ac.post("/api/v1/student-directories/", headers=headers, json={
            "name": "Physics Batch 2026",
            "initial_students": [
                {"name": "Student One", "email": "one@test.com", "roll_number": "P-01"},
                {"name": "Student Two", "email": "two@test.com", "roll_number": "P-02"}
            ]
        })
        dir_id = dir_res.json()["id"]

        # Create exam targeting this directory
        exam_res = await ac.post("/api/v1/exams/", headers=headers, json={
            "name": "Physics Midterm",
            "subject_id": "general_101",
            "student_directory_id": dir_id,
            "duration_minutes": 45,
            "total_marks": 100,
            "passing_marks": 40,
            "start_time": "2026-09-05T10:00:00",
            "end_time": "2026-09-05T12:00:00"
        })
        assert exam_res.status_code == 200
        exam_id = exam_res.json()["id"]

        db = TestingSessionLocal()
        try:
            candidates = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam_id).all()
            assert len(candidates) == 2
            names = [c.name_snapshot for c in candidates]
            assert "Student One" in names
            assert "Student Two" in names
        finally:
            db.close()

@pytest.mark.anyio
async def test_google_auth_new_user_teacher_default_and_workspace_provisioning():
    """Verify that any new user signing in with Google is created as a Teacher by default and allocated a personal workspace."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as ac:
        # Mock Google ID Token payload
        res = await ac.post("/api/v1/auth/google", json={
            "email": "dr.einstein@university.edu",
            "name": "Dr. Albert Einstein",
            "google_id": "google_sub_123456789"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["role"] == "teacher"  # Must be Teacher by default!
        assert data["full_name"] == "Dr. Albert Einstein"
        assert data["workspace_id"] is not None
        assert "Albert Einstein" in data["workspace_name"]

        # Verify record in database
        db = TestingSessionLocal()
        try:
            user = db.query(User).filter(User.email == "dr.einstein@university.edu").first()
            assert user is not None
            assert user.role == "teacher"
            assert user.is_verified is True
            assert user.google_subject == "google_sub_123456789"

            # Check workspace
            ws = db.query(Workspace).filter(Workspace.id == data["workspace_id"]).first()
            assert ws is not None
            assert ws.owner_id == user.id
        finally:
            db.close()

        # Test subsequent login with same Google account
        res2 = await ac.post("/api/v1/auth/google", json={
            "email": "dr.einstein@university.edu",
            "google_id": "google_sub_123456789"
        })
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["role"] == "teacher"
        assert data2["workspace_id"] == data["workspace_id"]
