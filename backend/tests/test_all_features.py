import pytest
import requests
import uuid
import io

BASE_URL = "http://localhost:8000/api/v1"

@pytest.fixture(scope="module")
def teacher_auth():
    """Logs in as teacher meetdutta001@gmail.com and returns auth headers."""
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "meetdutta001@gmail.com",
        "password": "meetdutta"
    })
    assert res.status_code == 200, f"Teacher login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="module")
def student_auth():
    """Logs in as student student@eduquizx.com and returns auth headers."""
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "student@eduquizx.com",
        "password": "securepassword"
    })
    assert res.status_code == 200, f"Student login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# =========================================================
# 1. AUTHENTICATION & SECURITY TESTS
# =========================================================

def test_teacher_login(teacher_auth):
    assert "Authorization" in teacher_auth

def test_student_login(student_auth):
    assert "Authorization" in student_auth

def test_invalid_login():
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "nonexistent@eduquizx.com",
        "password": "wrongpassword"
    })
    assert res.status_code in [400, 401]

def test_forgot_password():
    res = requests.post(f"{BASE_URL}/auth/forgot-password", json={
        "email": "meetdutta001@gmail.com"
    })
    assert res.status_code == 200
    assert "reset link" in res.json()["message"].lower()

# =========================================================
# 2. STUDENT DIRECTORY & ROSTER MANAGEMENT TESTS
# =========================================================

def test_list_students(teacher_auth):
    res = requests.get(f"{BASE_URL}/students/", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_create_single_student(teacher_auth):
    unique_email = f"test.student.{uuid.uuid4().hex[:6]}@eduquizx.com"
    res = requests.post(f"{BASE_URL}/students/", headers=teacher_auth, json={
        "email": unique_email,
        "full_name": "Automated Test Student",
        "roll_number": f"ROLL-{uuid.uuid4().hex[:4].upper()}"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == unique_email
    assert data["full_name"] == "Automated Test Student"

def test_bulk_csv_student_import(teacher_auth):
    csv_content = f"full_name,email,roll_number,division,batch\nCSV Candidate 1,csv.cand1.{uuid.uuid4().hex[:4]}@eduquizx.com,CSV-001,A,2026\nCSV Candidate 2,csv.cand2.{uuid.uuid4().hex[:4]}@eduquizx.com,CSV-002,B,2026"
    csv_file = ("roster.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")
    res = requests.post(f"{BASE_URL}/students/import", headers=teacher_auth, files={"file": csv_file})
    assert res.status_code == 200
    assert "imported" in res.json()["message"].lower()

# =========================================================
# 3. KNOWLEDGE BASE & QUESTION BANK TESTS
# =========================================================

def test_list_knowledge_documents(teacher_auth):
    res = requests.get(f"{BASE_URL}/kb/documents", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_upload_knowledge_document(teacher_auth):
    unique_id = uuid.uuid4().hex[:6]
    txt_content = f"Thermodynamics notes section {unique_id}. Energy conservation principle."
    txt_file = (f"thermo_{unique_id}.txt", io.BytesIO(txt_content.encode("utf-8")), "text/plain")
    res = requests.post(f"{BASE_URL}/kb/upload", headers=teacher_auth, data={"subject_id": "PHYS-101"}, files={"file": txt_file})
    assert res.status_code == 200
    assert "id" in res.json()

def test_fetch_question_bank(teacher_auth):
    res = requests.get(f"{BASE_URL}/kb/questions/bank", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_save_question_to_bank(teacher_auth):
    res = requests.post(f"{BASE_URL}/kb/questions/bank", headers=teacher_auth, json={
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

def test_list_institutions(teacher_auth):
    res = requests.get(f"{BASE_URL}/institutions/", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

# =========================================================
# 5. IN-APP NOTIFICATION CENTER TESTS
# =========================================================

def test_list_notifications(teacher_auth):
    res = requests.get(f"{BASE_URL}/notifications/", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_unread_notifications_count(teacher_auth):
    res = requests.get(f"{BASE_URL}/notifications/unread-count", headers=teacher_auth)
    assert res.status_code == 200
    assert "count" in res.json()

# =========================================================
# 6. EXAM BUILDER & AI GENERATION TESTS
# =========================================================

def test_list_exams(teacher_auth):
    res = requests.get(f"{BASE_URL}/exams/", headers=teacher_auth)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_generate_ai_exam(teacher_auth):
    res = requests.post(f"{BASE_URL}/exams/generate-from-kb", headers=teacher_auth, json={
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

def test_student_my_progress_analytics(student_auth):
    res = requests.get(f"{BASE_URL}/reports/my-progress", headers=student_auth)
    assert res.status_code == 200
    data = res.json()
    assert "average_percentage" in data
    assert "score_trend" in data
