import pytest
import time
from datetime import datetime, timedelta
import httpx
from app.main import app
from app.models.user import User
from tests.conftest import TestingSessionLocal

@pytest.mark.anyio
async def test_privilege_escalation_prevented(client):
    """Ensure public self-registration cannot elevate role to inst_admin or super_admin."""
    res = await client.post("/api/v1/auth/register", json={
        "email": "hacker@test.com",
        "password": "Password123!",
        "full_name": "Privilege Escalation Attempt",
        "role": "inst_admin"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "teacher", f"Role should be demoted to teacher, got {data['role']}"

    # Also verify role saved in database
    db = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == "hacker@test.com").first()
        assert user is not None
        assert user.role == "teacher"
    finally:
        db.close()

@pytest.mark.anyio
async def test_weak_password_rejected(client):
    """Ensure passwords shorter than 8 characters are rejected."""
    res = await client.post("/api/v1/auth/register", json={
        "email": "shortpwd@test.com",
        "password": "short",
        "full_name": "Short Pwd",
        "role": "student"
    })
    assert res.status_code == 422, "Password < 8 characters should fail schema validation"

@pytest.mark.anyio
async def test_password_reset_token_expiration(client):
    """Ensure password reset tokens have expiration checks."""
    # 1. Request forgot password
    res = await client.post("/api/v1/auth/forgot-password", json={
        "email": "teacher@aegeus.edu"
    })
    assert res.status_code == 200

    db = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
        assert user.reset_token is not None
        valid_token = user.reset_token

        # Manually create an expired token
        expired_token = f"expired-uuid:{int(time.time()) - 100}"
        user.reset_token = expired_token
        db.commit()
    finally:
        db.close()

    # 2. Attempt reset with expired token
    res = await client.post("/api/v1/auth/reset-password", json={
        "token": expired_token,
        "new_password": "NewValidPassword123!"
    })
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()

@pytest.mark.anyio
async def test_kb_upload_path_traversal_and_extensions(client, teacher_auth):
    """Ensure file uploads reject dangerous extensions and sanitize filenames."""
    # Disallowed extension (.exe)
    res = await client.post(
        "/api/v1/kb/upload",
        headers=teacher_auth,
        data={"subject_id": "cs_101"},
        files={"file": ("malicious.exe", b"binary content", "application/octet-stream")}
    )
    assert res.status_code == 400
    assert "unsupported file format" in res.json()["detail"].lower()

    # Path traversal attempt in filename is sanitized to basename
    res = await client.post(
        "/api/v1/kb/upload",
        headers=teacher_auth,
        data={"subject_id": "cs_101"},
        files={"file": ("../../test_traversal.txt", b"Safe document content for testing", "text/plain")}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["filename"] == "test_traversal.txt"

@pytest.mark.anyio
async def test_kb_download_requires_auth_and_workspace(client):
    """Ensure unauthenticated callers cannot download documents."""
    res = await client.get("/api/v1/kb/documents/some-random-id/download")
    assert res.status_code in [401, 403], f"Expected auth failure, got {res.status_code}"

@pytest.mark.anyio
async def test_report_card_requires_auth(client):
    """Ensure unauthenticated callers cannot view student report cards."""
    res = await client.get("/api/v1/reports/submissions/some-fake-sub-id/report-card-html")
    assert res.status_code in [401, 403, 404]

@pytest.mark.anyio
async def test_kb_upload_spoofed_mime_magic_bytes_rejected(client, teacher_auth):
    """Ensure file uploads reject spoofed files where extension claims to be PDF but magic bytes are invalid."""
    res = await client.post(
        "/api/v1/kb/upload",
        headers=teacher_auth,
        data={"subject_id": "cs_101"},
        files={"file": ("fake.pdf", b"MZ\x90\x00\x03ThisIsActuallyAnExe", "application/pdf")}
    )
    assert res.status_code == 400
    assert "spoofed" in res.json()["detail"].lower() or "corrupt" in res.json()["detail"].lower()

@pytest.mark.anyio
async def test_auth_rate_limiting(client):
    """Ensure rapid repeated calls trigger rate limiting (HTTP 429)."""
    hit_429 = False
    for i in range(20):
        res = await client.post("/api/v1/auth/login", json={
            "email": f"ratelimit_probe_{i}@test.com",
            "password": "WrongPassword123!"
        })
        if res.status_code == 429:
            hit_429 = True
            assert "too many requests" in res.json()["detail"].lower()
            break
    assert hit_429, "Rate limiter should have triggered HTTP 429 on excessive attempts"

@pytest.mark.anyio
async def test_refresh_token_rotation_and_revocation(client):
    """Verify refresh token cookie issuance, rotation, and replay prevention."""
    # 1. Login
    res = await client.post("/api/v1/auth/login", json={
        "email": "teacher@aegeus.edu",
        "password": "securepassword"
    })
    assert res.status_code == 200
    data = res.json()
    token1 = data["refresh_token"]
    assert "set-cookie" in res.headers or "refresh_token" in res.cookies

    # 2. First refresh (valid)
    ref_res1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": token1})
    assert ref_res1.status_code == 200
    data1 = ref_res1.json()
    token2 = data1["refresh_token"]
    assert token1 != token2, "Refresh token should rotate on use"

    # 3. Replay attack: attempt to use the already rotated token1
    replay_res = await client.post("/api/v1/auth/refresh", json={"refresh_token": token1})
    assert replay_res.status_code == 401
    assert "revoked or replayed" in replay_res.json()["detail"].lower()

    # 4. Valid refresh with rotated token2
    ref_res2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": token2})
    assert ref_res2.status_code == 200

    # 5. Logout
    logout_res = await client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200

@pytest.mark.anyio
async def test_exam_concurrency_atomic_locking(client, teacher_auth):
    """Verify concurrent or duplicate submit requests only process once."""
    # 1. Create and publish exam as teacher
    now = datetime.utcnow()
    exam_res = await client.post("/api/v1/exams/", headers=teacher_auth, json={
        "name": "Concurrency Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 30,
        "total_marks": 10.0,
        "passing_marks": 5.0,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(days=1)).isoformat()
    })
    assert exam_res.status_code == 200, exam_res.text
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]

    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    # 2. Register student and start exam
    stu_res = await client.post("/api/v1/auth/register", json={
        "email": f"conc_student_{int(time.time())}@test.com",
        "password": "Password123!",
        "full_name": "Concurrency Student",
        "role": "student"
    })
    assert stu_res.status_code == 200
    stu_token = stu_res.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=stu_headers)
    assert start_res.status_code == 200
    session_token = start_res.json()["token"]
    session_headers = {"Authorization": f"Bearer {session_token}"}

    # 3. Submit 1: Should succeed
    res1 = await client.post("/api/v1/attempts/submit", headers=session_headers, json={
        "answers": {},
        "proctoring_violations": 0
    })
    assert res1.status_code == 200

    # 4. Submit 2 (Immediate duplicate / retry): Should be rejected by atomic state lock
    res2 = await client.post("/api/v1/attempts/submit", headers=session_headers, json={
        "answers": {},
        "proctoring_violations": 0
    })
    assert res2.status_code == 400
    assert "already submitted" in res2.json()["detail"].lower() or "in progress" in res2.json()["detail"].lower()

@pytest.mark.anyio
async def test_idor_workspace_isolation(client):
    """Ensure Teacher B cannot access or download Teacher A's documents."""
    # Register Teacher A
    res_a = await client.post("/api/v1/auth/register", json={
        "email": "teacher_a_idor@test.com",
        "password": "Password123!",
        "full_name": "Teacher A",
        "role": "teacher"
    })
    assert res_a.status_code == 200
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Upload doc as Teacher A
    up_res = await client.post(
        "/api/v1/kb/upload",
        headers=headers_a,
        data={"subject_id": "cs_sec"},
        files={"file": ("teacher_a_notes.txt", b"Confidential notes for Teacher A", "text/plain")}
    )
    assert up_res.status_code == 200
    doc_id = up_res.json()["id"]

    # Register Teacher B
    res_b = await client.post("/api/v1/auth/register", json={
        "email": "teacher_b_idor@test.com",
        "password": "Password123!",
        "full_name": "Teacher B",
        "role": "teacher"
    })
    assert res_b.status_code == 200
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Teacher B attempts to download Teacher A's document
    dl_res = await client.get(f"/api/v1/kb/documents/{doc_id}/download", headers=headers_b)
    assert dl_res.status_code == 404, "Teacher B must NOT be able to access Teacher A's document"
