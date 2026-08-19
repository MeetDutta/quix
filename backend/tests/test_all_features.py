import pytest
import io
import uuid
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from app.models.user import User, Student
from app.models.institution import Institution, Department, Course, Subject
from app.utils.security import get_password_hash
from app.services.workspace_service import bootstrap_personal_workspace

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

    db = TestingSessionLocal()
    try:
        inst = Institution(name="EduQuizX Academy")
        db.add(inst)
        db.flush()

        dept = Department(name="Computer Science", institution_id=inst.id)
        db.add(dept)
        db.flush()

        course = Course(name="Undergraduate CS", department_id=dept.id)
        db.add(course)
        db.flush()

        subj = Subject(name="Thermodynamics & Physics", id="PHYS-101", course_id=course.id)
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

        student_user = User(
            email="student@aegeus.edu",
            hashed_password=get_password_hash("securepassword"),
            full_name="Alex Johnson",
            role="student",
            institution_id=inst.id,
            is_active=True
        )
        db.add(student_user)
        db.commit()
        db.refresh(student_user)

        student_profile = Student(
            user_id=student_user.id,
            institution_id=inst.id,
            roll_number="CS-2026-001",
            department_id=dept.id,
            division="A",
            batch="2026-2027",
            status="active"
        )
        db.add(student_profile)
        db.commit()
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as c:
        yield c

@pytest.fixture
async def teacher_auth(client):
    res = await client.post("/api/v1/auth/login", json={
        "email": "teacher@aegeus.edu",
        "password": "securepassword"
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def student_auth(client):
    res = await client.post("/api/v1/auth/login", json={
        "email": "student@aegeus.edu",
        "password": "securepassword"
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# =========================================================
# 1. AUTHENTICATION & SECURITY TESTS
# =========================================================

@pytest.mark.anyio
async def test_teacher_login(client, teacher_auth):
    assert "Authorization" in teacher_auth

@pytest.mark.anyio
async def test_student_login(client, student_auth):
    assert "Authorization" in student_auth

@pytest.mark.anyio
async def test_invalid_login(client):
    res = await client.post("/api/v1/auth/login", json={
        "email": "nonexistent@aegeus.edu",
        "password": "wrongpassword"
    })
    assert res.status_code in [400, 401]

@pytest.mark.anyio
async def test_forgot_password(client):
    res = await client.post("/api/v1/auth/forgot-password", json={
        "email": "teacher@aegeus.edu"
    })
    assert res.status_code == 200
    assert "reset link" in res.json()["message"].lower()

# =========================================================
# 2. STUDENT DIRECTORY & ROSTER MANAGEMENT TESTS
# =========================================================

@pytest.mark.anyio
async def test_list_students(client, teacher_auth):
    res = await client.get("/api/v1/students/", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

@pytest.mark.anyio
async def test_create_single_student(client, teacher_auth):
    unique_email = f"test.student.{uuid.uuid4().hex[:6]}@aegeus.edu"
    res = await client.post("/api/v1/students/", headers=teacher_auth, json={
        "email": unique_email,
        "full_name": "Automated Test Student",
        "roll_number": f"ROLL-{uuid.uuid4().hex[:4].upper()}"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == unique_email
    assert data["full_name"] == "Automated Test Student"

@pytest.mark.anyio
async def test_bulk_csv_student_import(client, teacher_auth):
    csv_content = f"full_name,email,roll_number,division,batch\nCSV Candidate 1,csv.cand1.{uuid.uuid4().hex[:4]}@aegeus.edu,CSV-001,A,2026\nCSV Candidate 2,csv.cand2.{uuid.uuid4().hex[:4]}@aegeus.edu,CSV-002,B,2026"
    files = {"file": ("roster.csv", csv_content.encode("utf-8"), "text/csv")}
    res = await client.post("/api/v1/students/import", headers=teacher_auth, files=files)
    assert res.status_code == 200
    assert "imported" in res.json()["message"].lower()

# =========================================================
# 3. KNOWLEDGE BASE & QUESTION BANK TESTS
# =========================================================

@pytest.mark.anyio
async def test_list_knowledge_documents(client, teacher_auth):
    res = await client.get("/api/v1/kb/documents", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

@pytest.mark.anyio
async def test_upload_knowledge_document(client, teacher_auth):
    unique_id = uuid.uuid4().hex[:6]
    txt_content = f"Thermodynamics notes section {unique_id}. Energy conservation principle."
    files = {"file": (f"thermo_{unique_id}.txt", txt_content.encode("utf-8"), "text/plain")}
    res = await client.post("/api/v1/kb/upload", headers=teacher_auth, data={"subject_id": "PHYS-101"}, files=files)
    assert res.status_code == 200
    assert "id" in res.json()

@pytest.mark.anyio
async def test_fetch_question_bank(client, teacher_auth):
    res = await client.get("/api/v1/kb/questions/bank", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

@pytest.mark.anyio
async def test_save_question_to_bank(client, teacher_auth):
    res = await client.post("/api/v1/kb/questions/bank", headers=teacher_auth, json={
        "subject_id": "PHYS-101",
        "question_text": "What is the First Law of Thermodynamics?",
        "question_type": "mcq",
        "marks": 5,
        "difficulty": "medium",
        "topic": "Thermodynamics",
        "options_json": "[\"Energy Conservation\", \"Entropy Increase\", \"Absolute Zero\", \"Mass Conservation\"]",
        "correct_answer": "Energy Conservation",
        "explanation": "Energy can neither be created nor destroyed."
    })
    assert res.status_code == 200
    assert "id" in res.json()

# =========================================================
# 4. INSTITUTION MANAGEMENT TESTS
# =========================================================

@pytest.mark.anyio
async def test_list_institutions(client, teacher_auth):
    res = await client.get("/api/v1/institutions/", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

# =========================================================
# 5. IN-APP NOTIFICATION CENTER TESTS
# =========================================================

@pytest.mark.anyio
async def test_list_notifications(client, teacher_auth):
    res = await client.get("/api/v1/notifications/", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

@pytest.mark.anyio
async def test_unread_notifications_count(client, teacher_auth):
    res = await client.get("/api/v1/notifications/unread-count", headers=teacher_auth)
    assert res.status_code == 200
    assert "count" in res.json()

# =========================================================
# 6. EXAM BUILDER & AI GENERATION TESTS
# =========================================================

@pytest.mark.anyio
async def test_list_exams(client, teacher_auth):
    res = await client.get("/api/v1/exams/", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

@pytest.mark.anyio
async def test_generate_ai_exam(client, teacher_auth):
    res = await client.post("/api/v1/exams/generate-from-kb", headers=teacher_auth, json={
        "name": "Physics Midterm Exam",
        "subject_id": "PHYS-101",
        "topic": "Thermodynamics",
        "num_mcq": 2,
        "num_subjective": 1,
        "difficulty": "medium",
        "duration_minutes": 30,
        "total_marks": 50,
        "passing_marks": 20
    })
    assert res.status_code == 200
    data = res.json()
    assert "exam_code" in data
    assert "id" in data

# =========================================================
# 7. STUDENT PROGRESS & MASTERY ANALYTICS TESTS
# =========================================================

@pytest.mark.anyio
async def test_student_my_progress_analytics(client, student_auth):
    res = await client.get("/api/v1/reports/my-progress", headers=student_auth)
    assert res.status_code == 200
    data = res.json()
    assert "average_percentage" in data
    assert "score_trend" in data
