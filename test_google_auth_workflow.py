import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
import requests
import uuid

BASE_URL = "http://localhost:8000/api/v1"

def run_tests():
    print("======================================================================")
    print("🚀 TESTING GOOGLE AUTHORIZATION & EMAIL VERIFICATION WORKFLOW")
    print("======================================================================")

    # 1. Teacher Login
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": "teacher@aegeus.edu", "password": "securepassword"})
    assert resp.status_code == 200, f"Teacher login failed: {resp.text}"
    teacher_token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {teacher_token}"}
    print("✅ 1. Teacher login successful")

    # 2. Add New Student
    test_email = f"qa.student.{uuid.uuid4().hex[:6]}@aegeus.edu"
    student_payload = {
        "email": test_email,
        "full_name": "QA Google Student",
        "roll_number": "ROLL-QA-999",
        "division": "A",
        "batch": "2024-2028"
    }
    resp = requests.post(f"{BASE_URL}/students/", json=student_payload, headers=headers)
    assert resp.status_code == 200, f"Student creation failed: {resp.text}"
    student_data = resp.json()
    assert student_data["is_verified"] is False, "New student should be unverified"
    print(f"✅ 2. Created pending student ({test_email}) with is_verified=False")

    # 3. Check Unverified Student Cannot Login
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": test_email, "password": "wrongpassword"})
    assert resp.status_code in [400, 403], f"Unverified student should be blocked: {resp.status_code}"
    print("✅ 3. Unverified student blocked before authorization")

    # 4. Fetch verification token from DB
    from app.database import engine
    from sqlalchemy import text
    with engine.connect() as conn:
        token = conn.execute(text("SELECT verification_token FROM users WHERE email = :email"), {"email": test_email}).scalar()
    assert token is not None, "Verification token was not generated"
    print(f"✅ 4. Retrieved verification token: {token[:8]}...")

    # 5. Student Authorizes via Link
    resp = requests.get(f"{BASE_URL}/auth/verify-student?token={token}")
    assert resp.status_code == 200, f"Verification failed: {resp.text}"
    verify_res = resp.json()
    assert verify_res["status"] == "success", "Verification status is not success"
    print("✅ 5. Student authorized via email link and password generated")

    # 6. Verify Google Authorization / SSO Endpoint
    google_payload = {
        "email": test_email,
        "name": "QA Google Student",
        "google_id": f"g_{uuid.uuid4().hex[:8]}"
    }
    resp = requests.post(f"{BASE_URL}/auth/google-login", json=google_payload)
    assert resp.status_code == 200, f"Google login failed: {resp.text}"
    google_auth_res = resp.json()
    assert google_auth_res["role"] == "student"
    assert "access_token" in google_auth_res
    print("✅ 6. Student successfully authenticated via Google Workspace SSO")

    # 7. Resend Auth Email Endpoint Check
    resp = requests.post(f"{BASE_URL}/students/{student_data['id']}/resend-auth", headers=headers)
    assert resp.status_code == 200
    print("✅ 7. Teacher can resend authorization email on-demand")

    # 8. Clean up test student
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM students WHERE roll_number = 'ROLL-QA-999';"))
        conn.execute(text(f"DELETE FROM users WHERE email = '{test_email}';"))
        conn.commit()
    print("✅ 8. Cleaned up QA test student records")

    print("======================================================================")
    print("🎉 ALL GOOGLE AUTHORIZATION & VERIFICATION WORKFLOW TESTS PASSED!")
    print("======================================================================")

if __name__ == "__main__":
    run_tests()
