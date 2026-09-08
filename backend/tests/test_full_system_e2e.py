import io
import json
import uuid
from datetime import datetime, timedelta
import pytest
import httpx
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from app.models.institution import Institution, Department, Course, Subject
from app.models.user import User
from app.models.workspace import Workspace
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam

from tests.conftest import TestingSessionLocal


@pytest.mark.anyio
async def test_system_health_and_root():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/")
        assert res.status_code == 200
        assert res.json()["status"] == "online"

        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data


@pytest.mark.anyio
async def test_auth_and_tenant_isolation():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register Teacher A
        res = await client.post("/api/v1/auth/register", json={
            "email": "teacher.a@test.com",
            "password": "Password123!",
            "full_name": "Teacher Alpha",
            "role": "teacher"
        })
        assert res.status_code == 200, res.text
        teacher_token = res.json()["access_token"]
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

        # 2. Check /auth/me for Teacher
        res = await client.get("/api/v1/auth/me", headers=teacher_headers)
        assert res.status_code == 200
        assert res.json()["email"] == "teacher.a@test.com"
        assert res.json()["role"] == "teacher"

        # 3. Check Workspaces - Teacher should have personal workspace bootstrapped
        res = await client.get("/api/v1/workspaces/current", headers=teacher_headers)
        assert res.status_code == 200
        ws = res.json()
        assert ws["name"] == "Teacher Alpha's Workspace"

        res = await client.get("/api/v1/workspaces/active", headers=teacher_headers)
        assert res.status_code == 200

        # 4. Register Student S
        res = await client.post("/api/v1/auth/register", json={
            "email": "student.s@test.com",
            "password": "Password123!",
            "full_name": "Student Samantha",
            "role": "student"
        })
        assert res.status_code == 200
        student_token = res.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # 5. Clean Slate Check: Student submissions & progress are empty
        res = await client.get("/api/v1/reports/my-submissions", headers=student_headers)
        assert res.status_code == 200
        assert res.json() == []

        res = await client.get("/api/v1/reports/my-progress", headers=student_headers)
        assert res.status_code == 200
        assert res.json()["total_exams_attempted"] == 0


@pytest.mark.anyio
async def test_student_directory_and_excel_integration():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Setup teacher
        res = await client.post("/api/v1/auth/register", json={
            "email": "dir_teacher@test.com",
            "password": "Password123!",
            "full_name": "Directory Professor",
            "role": "teacher"
        })
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Reference templates
        res = await client.get("/api/v1/student-directories/template/csv")
        assert res.status_code == 200
        assert "Division" in res.text

        res = await client.get("/api/v1/student-directories/template/excel")
        assert res.status_code == 200
        assert len(res.content) > 1000

        # 2. Create Student Directory
        res = await client.post("/api/v1/student-directories/", headers=headers, json={
            "name": "B.Tech Fall 2026 Batch",
            "description": "Robotics and AI Major"
        })
        assert res.status_code == 200
        dir_id = res.json()["id"]

        # 3. Add single student with Division and Department
        res = await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=headers, json={
            "name": "David Miller",
            "email": "david.m@test.com",
            "roll_number": "ROBOTICS-001",
            "phone": "+1 555-0201",
            "division": "Section Alpha",
            "department": "Robotics Engineering"
        })
        assert res.status_code == 200
        student_data = res.json()
        assert student_data["division"] == "Section Alpha"
        assert student_data["department"] == "Robotics Engineering"

        # 4. Upload in-memory Excel spreadsheet with Division & Department
        excel_data = [
            {
                "Full Name": "Elena Rostova",
                "Email Address": "elena.r@test.com",
                "Roll Number": "ROBOTICS-002",
                "Phone Number": "+1 555-0202",
                "Division": "Section Beta",
                "Department": "Mechatronics"
            },
            {
                "Full Name": "Farhan Qureshi",
                "Email Address": "farhan.q@test.com",
                "Roll Number": "ROBOTICS-003",
                "Phone Number": "+1 555-0203",
                "Division": "Section Beta",
                "Department": "Mechatronics"
            }
        ]
        excel_buf = io.BytesIO()
        pd.DataFrame(excel_data).to_excel(excel_buf, index=False)
        excel_bytes = excel_buf.getvalue()

        res = await client.post(
            f"/api/v1/student-directories/{dir_id}/import",
            headers=headers,
            files={"file": ("roster.xlsx", excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
        assert res.status_code == 200
        import_result = res.json()
        assert import_result["imported_count"] == 2
        assert import_result["skipped_count"] == 0

        # 5. Search students by division
        res = await client.get(f"/api/v1/student-directories/{dir_id}/students?search=Beta", headers=headers)
        assert res.status_code == 200
        searched = res.json()
        assert len(searched) == 2
        assert all(s["division"] == "Section Beta" for s in searched)

        # 6. Export CSV with query param token (simulating window.open)
        res = await client.get(f"/api/v1/student-directories/{dir_id}/export-csv?token={token}")
        assert res.status_code == 200
        csv_text = res.text
        assert "Division" in csv_text
        assert "Department" in csv_text
        assert "Section Alpha" in csv_text
        assert "Mechatronics" in csv_text

        # 7. Export Excel with query param token
        res = await client.get(f"/api/v1/student-directories/{dir_id}/export-excel?token={token}")
        assert res.status_code == 200
        read_df = pd.read_excel(io.BytesIO(res.content))
        assert "Division" in read_df.columns
        assert "Department" in read_df.columns
        assert "Section Alpha" in read_df["Division"].values
        assert "Mechatronics" in read_df["Department"].values


@pytest.mark.anyio
async def test_full_exam_quiz_and_grading_lifecycle():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register Teacher
        res = await client.post("/api/v1/auth/register", json={
            "email": "exam_teacher@test.com",
            "password": "Password123!",
            "full_name": "Exam Instructor",
            "role": "teacher"
        })
        teacher_token = res.json()["access_token"]
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

        # 2. Create Candidate Directory & Student
        res = await client.post("/api/v1/student-directories/", headers=teacher_headers, json={
            "name": "Quiz Cohort 2026"
        })
        dir_id = res.json()["id"]

        student_email = "student_candidate@test.com"
        res = await client.post(f"/api/v1/student-directories/{dir_id}/students", headers=teacher_headers, json={
            "name": "Candidate Charlie",
            "email": student_email,
            "roll_number": "CAND-99",
            "division": "Cohort-1",
            "department": "CS"
        })
        assert res.status_code == 200

        # 3. Create Exam restricted to directory
        start_time = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
        end_time = (datetime.utcnow() + timedelta(days=7)).isoformat()
        res = await client.post("/api/v1/exams/", headers=teacher_headers, json={
            "name": "Data Structures Midterm",
            "subject_id": "cs_101",
            "duration_minutes": 30,
            "total_marks": 20,
            "passing_marks": 10,
            "start_time": start_time,
            "end_time": end_time,
            "student_directory_id": dir_id
        })
        assert res.status_code == 200, res.text
        exam_data = res.json()
        exam_id = exam_data["id"]
        exam_code = exam_data["exam_code"]

        # 4. Add Questions via PUT /exams/{id}/questions
        q1_id = "q-ds-01"
        q2_id = "q-ds-02"
        questions_payload = [
            {
                "id": q1_id,
                "question_text": "What is the worst-case time complexity of binary search on a sorted array?",
                "question_type": "mcq",
                "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
                "correct_answer": "O(log n)",
                "marks": 10.0
            },
            {
                "id": q2_id,
                "question_text": "Which data structure follows the FIFO (First-In, First-Out) principle?",
                "question_type": "mcq",
                "options": ["Stack", "Queue", "Binary Search Tree", "Heap"],
                "correct_answer": "Queue",
                "marks": 10.0
            }
        ]
        res = await client.put(f"/api/v1/exams/{exam_id}/questions", headers=teacher_headers, json={
            "questions": questions_payload
        })
        assert res.status_code == 200

        # 5. Publish Exam
        res = await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_headers)
        assert res.status_code == 200

        # 6. Register Candidate Student
        res = await client.post("/api/v1/auth/register", json={
            "email": student_email,
            "password": "Password123!",
            "full_name": "Candidate Charlie",
            "role": "student"
        })
        student_token = res.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # 7. Student checks assigned exams
        res = await client.get("/api/v1/students/assigned-exams", headers=student_headers)
        assert res.status_code == 200
        assigned = res.json()
        assert len(assigned) >= 1
        target_exam = next((e for e in assigned if e["id"] == exam_id), None)
        assert target_exam is not None
        assert target_exam["title"] == "Data Structures Midterm"

        # 8. Start Quiz Attempt via direct-start
        res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=student_headers)
        assert res.status_code == 200, res.text
        start_data = res.json()
        session_token = start_data["token"]
        session_headers = {"Authorization": f"Bearer {session_token}"}

        # 9. Get Exam Info & Questions
        res = await client.get("/api/v1/attempts/exam-info", headers=session_headers)
        assert res.status_code == 200
        info_data = res.json()
        assert len(info_data["questions"]) == 2

        # 10. Save progress / answers
        res = await client.post("/api/v1/attempts/save-progress", headers=session_headers, json={
            "answers": {
                q1_id: "O(log n)",
                q2_id: "Queue"
            }
        })
        assert res.status_code == 200

        # 11. Proctor Alert
        res = await client.post("/api/v1/attempts/proctor-alert", headers=session_headers, json={
            "alert_type": "tab_switched",
            "details": "User switched away from assessment window"
        })
        assert res.status_code == 200

        # 12. Submit Exam
        res = await client.post("/api/v1/attempts/submit", headers=session_headers, json={
            "answers": {
                q1_id: "O(log n)",
                q2_id: "Queue"
            }
        })
        assert res.status_code == 200
        submit_data = res.json()
        assert submit_data["status"] == "submitted"
        assert submit_data["score"] == 20.0
        assert submit_data["percentage"] == 100.0

        # 13. Teacher releases official exam results
        res = await client.post(f"/api/v1/exams/{exam_id}/publish-results", headers=teacher_headers)
        assert res.status_code == 200

        # 14. Student checks personal scorecard & progress
        res = await client.get("/api/v1/reports/my-submissions", headers=student_headers)
        assert res.status_code == 200
        my_subs = res.json()
        assert len(my_subs) == 1
        assert my_subs[0]["score"] == 20.0

        res = await client.get("/api/v1/reports/my-progress", headers=student_headers)
        assert res.status_code == 200
        prog = res.json()
        assert prog["total_exams_attempted"] == 1
        assert prog["average_score_percentage"] == 100.0

        # 14. Teacher views Exam Analytics & Leaderboard
        res = await client.get(f"/api/v1/reports/exams/{exam_id}/analytics", headers=teacher_headers)
        assert res.status_code == 200
        analytics = res.json()
        assert analytics["total_submissions"] == 1
        assert analytics["average_score"] == 20.0
        assert analytics["pass_rate"] == 100.0

        res = await client.get(f"/api/v1/reports/exams/{exam_id}/leaderboard", headers=teacher_headers)
        assert res.status_code == 200
        board = res.json()
        assert len(board) == 1
        assert board[0]["score"] == 20.0
        assert board[0]["student_name"] == "Candidate Charlie"

        # 15. Teacher exports Gradebook CSV
        res = await client.get(f"/api/v1/reports/exams/{exam_id}/export-csv?token={teacher_token}")
        assert res.status_code == 200
        assert "Candidate Charlie" in res.text
        assert "100" in res.text


@pytest.mark.anyio
async def test_knowledge_base_documents():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/register", json={
            "email": "kb_teacher@test.com",
            "password": "Password123!",
            "full_name": "KB Instructor",
            "role": "teacher"
        })
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Upload text document
        sample_content = b"Artificial Intelligence and Machine Learning syllabus document with course outcomes."
        res = await client.post(
            "/api/v1/kb/upload",
            headers=headers,
            data={"subject_id": "cs_101"},
            files={"file": ("syllabus.txt", sample_content, "text/plain")}
        )
        assert res.status_code == 200, res.text
        doc_data = res.json()
        doc_id = doc_data["id"]
        assert doc_data["filename"] == "syllabus.txt"

        # 2. List documents
        res = await client.get("/api/v1/kb/documents", headers=headers)
        assert res.status_code == 200
        docs = res.json()
        assert any(d["id"] == doc_id for d in docs)

        # 3. Delete document
        res = await client.delete(f"/api/v1/kb/documents/{doc_id}", headers=headers)
        assert res.status_code == 200

        # Verify deleted
        res = await client.get("/api/v1/kb/documents", headers=headers)
        docs_after = res.json()
        assert not any(d["id"] == doc_id for d in docs_after)
