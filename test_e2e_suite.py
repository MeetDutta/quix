import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"
FRONTEND_URL = "http://localhost:3000"

def run_tests():
    print("=" * 70)
    print("🚀 EDUQUIZX COMPLETE 25-POINT END-TO-END AUTOMATED TEST SUITE")
    print("=" * 70)

    results = []

    def record(name, success, details=""):
        status = "✅ PASS" if success else "❌ FAIL"
        results.append((name, success, details))
        print(f"{status} | {name}: {details}")

    # 1. Health & Server Connectivity
    try:
        r = requests.get("http://localhost:8000/health", timeout=5)
        record("01. Backend Health Check", r.status_code == 200, f"Status {r.status_code} - {r.json()}")
    except Exception as e:
        record("01. Backend Health Check", False, str(e))

    # 2. Teacher Authentication
    teacher_token = None
    try:
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": "teacher@aegeus.edu", "password": "securepassword"})
        if r.status_code == 200:
            data = r.json()
            teacher_token = data.get("access_token")
            record("02. Teacher Authentication", True, f"Role: {data.get('role')} | User: {data.get('full_name')}")
        else:
            record("02. Teacher Authentication", False, f"HTTP {r.status_code}")
    except Exception as e:
        record("02. Teacher Authentication", False, str(e))

    t_headers = {"Authorization": f"Bearer {teacher_token}"} if teacher_token else {}

    # 3. Student Authentication
    student_token = None
    try:
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": "student@aegeus.edu", "password": "securepassword"})
        if r.status_code == 200:
            data = r.json()
            student_token = data.get("access_token")
            record("03. Student Authentication", True, f"Role: {data.get('role')} | User: {data.get('full_name')}")
        else:
            record("03. Student Authentication", False, f"HTTP {r.status_code}")
    except Exception as e:
        record("03. Student Authentication", False, str(e))

    s_headers = {"Authorization": f"Bearer {student_token}"} if student_token else {}

    # 4. Knowledge Base Roster & Subjects
    try:
        r_docs = requests.get(f"{BASE_URL}/kb/documents", headers=t_headers)
        r_subjs = requests.get(f"{BASE_URL}/kb/subjects", headers=t_headers)
        doc_count = len(r_docs.json()) if r_docs.status_code == 200 and isinstance(r_docs.json(), list) else 0
        record("04. Knowledge Base Documents & Vector Store", r_docs.status_code == 200, f"{doc_count} indexed docs")
        record("05. Academic Subjects Hierarchy", r_subjs.status_code == 200, f"{len(r_subjs.json())} subjects mapped")
    except Exception as e:
        record("04. Knowledge Base Documents", False, str(e))
        record("05. Academic Subjects Hierarchy", False, str(e))

    # 5. Student Directory Operations (Add, Edit, Delete)
    test_student_id = None
    try:
        create_payload = {
            "full_name": "QA Student Candidate",
            "email": f"qa.candidate.{int(time.time())}@aegeus.edu",
            "roll_number": f"QA-{int(time.time())%10000}",
            "division": "A",
            "batch": "2024-2028"
        }
        r_add = requests.post(f"{BASE_URL}/students/", json=create_payload, headers=t_headers)
        if r_add.status_code == 200:
            st_data = r_add.json()
            test_student_id = st_data.get("id")
            record("06. Student Directory: Add Student", True, f"Created {st_data.get('full_name')} (ID: {test_student_id})")

            edit_payload = {
                "full_name": "QA Student Candidate (Updated)",
                "email": create_payload["email"],
                "roll_number": create_payload["roll_number"],
                "division": "B",
                "batch": "2025-2029"
            }
            r_edit = requests.put(f"{BASE_URL}/students/{test_student_id}", json=edit_payload, headers=t_headers)
            record("07. Student Directory: Edit Specifications", r_edit.status_code == 200, f"Updated Name: {r_edit.json().get('full_name')}, Division: {r_edit.json().get('division')}")

            r_del = requests.delete(f"{BASE_URL}/students/{test_student_id}", headers=t_headers)
            record("08. Student Directory: Delete Student", r_del.status_code == 200, "Successfully soft-deleted student")
        else:
            record("06. Student Directory: Add Student", False, f"HTTP {r_add.status_code}")
    except Exception as e:
        record("06. Student Directory Operations", False, str(e))

    # 6. AI Question Paper Synthesis & Publishing
    created_exam_id = None
    created_exam_code = None
    questions = []
    first_cred = None
    try:
        exam_payload = {
            "name": f"Comprehensive QA Assessment {int(time.time())%1000}",
            "subject_id": "thermo_101",
            "topic": "First Law & Thermodynamics",
            "duration_minutes": 20,
            "total_marks": 25,
            "passing_marks": 10,
            "negative_marking": 0.25,
            "num_mcq": 4,
            "num_subjective": 1,
            "question_type": "mixed",
            "difficulty": "medium"
        }
        r_gen = requests.post(f"{BASE_URL}/exams/generate-from-kb", json=exam_payload, headers=t_headers)
        if r_gen.status_code == 200:
            exam_data = r_gen.json()
            created_exam_id = exam_data.get("id")
            created_exam_code = exam_data.get("exam_code")
            questions = json.loads(exam_data.get("questions_json", "[]"))
            record("09. AI Exam Paper Synthesis (RAG Engine)", True, f"Synthesized '{exam_data.get('name')}' with {len(questions)} items")
            record("10. Generated Exam Paper Structure & Preview Data", len(questions) > 0, f"Code: {created_exam_code} | Total Marks: {exam_data.get('total_marks')}")

            # Publish
            r_pub = requests.post(f"{BASE_URL}/exams/{created_exam_id}/publish", headers=t_headers)
            record("11. Exam Publishing Engine", r_pub.status_code == 200, f"Assessment {created_exam_code} is now LIVE")

            # Credentials Generation
            r_creds = requests.post(f"{BASE_URL}/exams/{created_exam_id}/credentials", headers=t_headers)
            creds = r_creds.json() if r_creds.status_code == 200 else []
            if creds and len(creds) > 0:
                first_cred = creds[0]
            record("12. Student Passcodes Generation & Email Queue", r_creds.status_code == 200, f"Generated {len(creds)} timed candidate passcodes")

            # Credentials Export CSV
            r_csv = requests.get(f"{BASE_URL}/exams/{created_exam_id}/credentials/export", headers=t_headers)
            record("13. Candidate Credentials CSV Export", r_csv.status_code == 200 and "text/csv" in r_csv.headers.get("content-type", ""), f"Exported {len(r_csv.content)} bytes CSV")

            # Printable Question Paper
            r_qp = requests.get(f"{BASE_URL}/exams/{created_exam_id}/pdf/question-paper", headers=t_headers)
            record("14. Printable Question Paper Engine", r_qp.status_code == 200, f"Generated {len(r_qp.content)} bytes HTML paper")

            # Printable Answer Key
            r_ak = requests.get(f"{BASE_URL}/exams/{created_exam_id}/pdf/answer-key", headers=t_headers)
            record("15. Printable Answer Key Engine", r_ak.status_code == 200, f"Generated {len(r_ak.content)} bytes HTML solution key")
        else:
            record("09. AI Exam Paper Synthesis", False, f"HTTP {r_gen.status_code}: {r_gen.text}")
    except Exception as e:
        record("09. AI Exam Paper Synthesis", False, str(e))

    # 7. Candidate Exam Taking Flow & Submission
    if created_exam_code and first_cred:
        try:
            # Check Status
            r_stat = requests.get(f"{BASE_URL}/attempts/exam-status?exam_code={created_exam_code}")
            record("16. Candidate Exam Status Gateway", r_stat.status_code == 200 and r_stat.json().get("status") == "active", f"Status: {r_stat.json().get('status')}")

            # Candidate Login with Timed Passcode
            r_cand_auth = requests.post(
                f"{BASE_URL}/attempts/login?exam_code={created_exam_code}",
                json={"username": first_cred["username"], "password": first_cred["password"]}
            )
            cand_data = r_cand_auth.json() if r_cand_auth.status_code == 200 else {}
            session_token = cand_data.get("session_token")
            record("17. Candidate Login with Timed Passcode", r_cand_auth.status_code == 200 and bool(session_token), f"Authenticated candidate: {cand_data.get('student_name')}")

            if session_token:
                # Save answers
                sample_answers = {}
                for q in questions:
                    sample_answers[q["id"]] = q.get("correct_answer", "A")

                requests.post(f"{BASE_URL}/attempts/save-answer?token={session_token}", json={"answers": sample_answers})

                # Submit
                r_sub = requests.post(f"{BASE_URL}/attempts/submit?token={session_token}")
                if r_sub.status_code == 200:
                    sub_res = r_sub.json()
                    record("18. Exam Submission & Instant Auto-Grading", True, f"Score: {sub_res.get('score')} / {sub_res.get('total_marks')} (Passed: {sub_res.get('is_passed')})")
                else:
                    record("18. Exam Submission & Instant Auto-Grading", False, f"HTTP {r_sub.status_code}: {r_sub.text}")
            else:
                record("18. Exam Submission & Instant Auto-Grading", False, "No session token")
        except Exception as e:
            record("16. Candidate Exam Taking Flow", False, str(e))

    # 8. Reports & Performance Gradebooks
    if created_exam_id:
        try:
            r_sum = requests.get(f"{BASE_URL}/reports/exam-summary/{created_exam_id}", headers=t_headers)
            record("19. Teacher Performance Summary & Gradebook", r_sum.status_code == 200, "Calculated student metrics")

            r_my_sub = requests.get(f"{BASE_URL}/reports/my-submissions", headers=s_headers)
            record("20. Student Submission History & Analytics", r_my_sub.status_code == 200, f"{len(r_my_sub.json())} submissions recorded")

            r_lead = requests.get(f"{BASE_URL}/reports/leaderboard/{created_exam_id}", headers=t_headers)
            record("21. Assessment Leaderboard & Rank Tracking", r_lead.status_code == 200, "Leaderboard computed")
        except Exception as e:
            record("19. Reports & Gradebook", False, str(e))

    # 9. Frontend Route Health Checks
    routes = [
        ("22. Landing & Login Gateway", "/"),
        ("23. Teacher Dashboard & Quiz Creator", "/dashboard/teacher"),
        ("24. Student Analytics Portal", "/dashboard/student"),
        ("25. Candidate Exam Gateway", f"/exam/{created_exam_code}" if created_exam_code else "/exam/ex-the-8664")
    ]
    for label, route in routes:
        try:
            r_page = requests.get(f"{FRONTEND_URL}{route}", timeout=5)
            record(f"{label} ({route})", r_page.status_code == 200, f"HTTP {r_page.status_code}")
        except Exception as e:
            record(f"{label} ({route})", False, str(e))

    print("=" * 70)
    total = len(results)
    passed = sum(1 for _, s, _ in results if s)
    print(f"📊 FINAL SCORE: {passed}/{total} Tests Passed ({passed/total*100:.1f}%)")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
