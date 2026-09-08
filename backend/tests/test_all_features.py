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

from tests.conftest import TestingSessionLocal, test_engine

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
