import os
import time
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import pytest
import httpx
from app.utils.timezone import (
    IST,
    UTC,
    now_utc,
    now_ist,
    to_utc_instant,
    to_ist,
    to_iso_utc,
    format_ist,
    format_ist_time,
    format_ist_date,
    format_ist_datetime,
)
from app.models.exam import Exam, ExamSubmission
from app.services.email_service import email_service


def test_golden_instant_conversion():
    """
    GOLDEN TEST:
    Input Instant: 2026-09-10T04:30:00Z
    Expected Stored Instant: 2026-09-10T04:30:00+00:00
    Expected IST Formatted Time: 10:00 AM IST
    Expected IST Formatted DateTime: 10 Sep 2026, 10:00 AM IST
    """
    utc_str = "2026-09-10T04:30:00.000Z"
    instant = to_utc_instant(utc_str)
    assert instant is not None
    assert instant.tzinfo == timezone.utc
    assert instant.year == 2026
    assert instant.month == 9
    assert instant.day == 10
    assert instant.hour == 4
    assert instant.minute == 30

    ist_dt = to_ist(instant)
    assert ist_dt.year == 2026
    assert ist_dt.month == 9
    assert ist_dt.day == 10
    assert ist_dt.hour == 10
    assert ist_dt.minute == 0

    assert format_ist_time(instant) == "10:00 AM IST"
    assert "10 Sep 2026" in format_ist_datetime(instant)
    assert "10:00 AM IST" in format_ist_datetime(instant)


def test_golden_end_time_conversion():
    """
    GOLDEN TEST 2:
    Input Instant: 2026-09-10T06:30:00Z
    Expected Stored Instant: 2026-09-10T06:30:00+00:00
    Expected IST Formatted Time: 12:00 PM IST
    """
    utc_str = "2026-09-10T06:30:00.000Z"
    instant = to_utc_instant(utc_str)
    assert instant.hour == 6
    assert instant.minute == 30
    assert format_ist_time(instant) == "12:00 PM IST"


def test_legacy_database_safety():
    """
    LEGACY DATABASE SAFETY:
    Existing quiz.db records were historically generated using datetime.utcnow().
    Therefore legacy naive timestamps represent UTC instants.
    They MUST be interpreted as UTC.
    DO NOT add +05:30 to those existing records.
    Example legacy value: 2026-09-10 04:30:00
    Must be interpreted as 2026-09-10 04:30 UTC
    and displayed as 10 Sep 2026, 10:00 AM IST (NOT 04:30 PM IST).
    """
    legacy_naive_dt = datetime(2026, 9, 10, 4, 30, 0)
    interpreted_instant = to_utc_instant(legacy_naive_dt)

    assert interpreted_instant.tzinfo == timezone.utc
    assert interpreted_instant.hour == 4
    assert interpreted_instant.minute == 30

    formatted = format_ist_datetime(legacy_naive_dt)
    assert "10:00 AM IST" in formatted
    assert "04:30 PM" not in formatted
    assert "10:00 PM" not in formatted


def test_no_double_conversion():
    """
    DO NOT DOUBLE-CONVERT:
    Passing a timestamp with +05:30 offset or Z must resolve to the identical UTC instant.
    """
    instant_z = to_utc_instant("2026-09-10T04:30:00.000Z")
    instant_ist_offset = to_utc_instant("2026-09-10T10:00:00+05:30")
    assert instant_z == instant_ist_offset

    # Ensure to_utc_instant on already UTC-aware datetime does not shift it
    re_converted = to_utc_instant(instant_z)
    assert re_converted == instant_z


def test_server_timezone_invariance(monkeypatch):
    """
    INVARIANCE ACROSS SERVER TIMEZONES:
    Whether server OS runs with TZ=UTC, TZ=America/New_York, or TZ=Asia/Tokyo,
    the rendered display for 2026-09-10T04:30:00Z MUST be 10:00 AM IST.
    """
    instant = to_utc_instant("2026-09-10T04:30:00Z")
    for tz_name in ["UTC", "America/New_York", "Asia/Tokyo", "Europe/London"]:
        monkeypatch.setenv("TZ", tz_name)
        if hasattr(time, "tzset"):
            time.tzset()

        formatted_time = format_ist_time(instant)
        formatted_dt = format_ist_datetime(instant)
        assert formatted_time == "10:00 AM IST", f"Failed under TZ={tz_name}"
        assert "10:00 AM IST" in formatted_dt, f"Failed under TZ={tz_name}"


def test_duration_and_deadline_calculation():
    """
    Exam deadline is server-authoritative UTC instant:
    start = 2026-09-10T04:30:00Z, duration = 60 minutes
    deadline = 2026-09-10T05:30:00Z
    deadline in IST = 11:00 AM IST
    """
    start_instant = to_utc_instant("2026-09-10T04:30:00Z")
    duration_min = 60
    deadline_instant = start_instant + timedelta(minutes=duration_min)
    assert deadline_instant.hour == 5
    assert deadline_instant.minute == 30
    assert format_ist_time(deadline_instant) == "11:00 AM IST"


def test_email_service_renders_ist():
    """
    Verify email_service.send_exam_credentials_email renders explicit IST start and end times.
    """
    import unittest.mock as mock
    start_dt = to_utc_instant("2026-09-10T04:30:00Z")
    end_dt = to_utc_instant("2026-09-10T06:30:00Z")

    captured_html = {}
    def mock_send(to_email, subject, html_content):
        captured_html["html"] = html_content
        return True

    with mock.patch.object(email_service, "_send_smtp_email", side_effect=mock_send):
        email_service.send_exam_credentials_email(
            student_name="Rahul Sharma",
            email="student@aegeus.edu",
            exam_name="Advanced Operating Systems",
            exam_code="OS-2026",
            username="candidate_123",
            password="testpass123",
            start_time=start_dt,
            end_time=end_dt
        )
        html = captured_html.get("html", "")
        assert "10:00 AM IST" in html
        assert "12:00 PM IST" in html
        assert "10 Sep 2026" in html


@pytest.mark.anyio
async def test_api_exam_scheduling_and_live_monitor(client: httpx.AsyncClient, teacher_auth: dict):
    """
    End-to-End API test:
    1. Teacher authenticated via fixture.
    2. Create exam specifying UTC instant '2026-09-10T04:30:00.000Z' and '2026-09-10T06:30:00.000Z'.
    3. Retrieve exam: start_time and end_time must be UTC ISO-8601.
    4. Call live-monitor: must return server_time and valid structure with IST strings.
    """
    # Login to get workspace
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "teacher@aegeus.edu",
        "password": "securepassword"
    })
    assert login_res.status_code == 200
    ws_id = login_res.json()["workspace_id"]

    # Create exam
    payload = {
        "name": "IST Timezone Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 60,
        "total_marks": 100.0,
        "passing_marks": 40.0,
        "start_time": "2026-09-10T04:30:00.000Z",
        "end_time": "2026-09-10T06:30:00.000Z"
    }
    create_res = await client.post("/api/v1/exams/", json=payload, headers=teacher_auth)
    assert create_res.status_code == 200, create_res.text
    exam_data = create_res.json()
    exam_id = exam_data["id"]

    # Assert UTC ISO-8601 returned in response
    assert "2026-09-10T04:30:00" in exam_data["start_time"]
    assert "2026-09-10T06:30:00" in exam_data["end_time"]

    # Live monitor check
    monitor_res = await client.get(f"/api/v1/exams/{exam_id}/live-monitor", headers=teacher_auth)
    assert monitor_res.status_code == 200, monitor_res.text
    mon_data = monitor_res.json()
    assert "server_time" in mon_data
    assert "server_time_ist" in mon_data
    assert "start_time_ist" in mon_data["exam"]
    assert "end_time_ist" in mon_data["exam"]
    assert "10:00 AM IST" in mon_data["exam"]["start_time_ist"]
    assert "12:00 PM IST" in mon_data["exam"]["end_time_ist"]

    # CSV Export check
    csv_res = await client.get(f"/api/v1/reports/exams/{exam_id}/export-csv", headers=teacher_auth)
    assert csv_res.status_code == 200, csv_res.text
    csv_text = csv_res.text
    assert "Submitted At (IST)" in csv_text


def test_postgresql_ddl_compilation():
    """
    POSTGRESQL PRODUCTION DDL COMPILATION AUDIT:
    Verifies that all DateTime columns in exams, exam_credentials, and exam_submissions
    compile to TIMESTAMP WITH TIME ZONE in PostgreSQL dialect.
    """
    import sqlalchemy as sa
    from sqlalchemy.dialects import postgresql
    from app.database import Base

    pg_dialect = postgresql.dialect()
    audited_tables = ["exams", "exam_submissions", "exam_credentials", "proctoring_logs", "audit_logs"]

    verified_columns = 0
    for table_name in audited_tables:
        if table_name in Base.metadata.tables:
            table = Base.metadata.tables[table_name]
            for col in table.columns:
                if isinstance(col.type, sa.DateTime):
                    compiled_type = col.type.compile(dialect=pg_dialect)
                    assert compiled_type == "TIMESTAMP WITH TIME ZONE", (
                        f"Table {table_name}, Column {col.name} compiled to {compiled_type}, expected TIMESTAMP WITH TIME ZONE"
                    )
                    verified_columns += 1

    assert verified_columns >= 10, f"Expected at least 10 timezone-aware columns, verified {verified_columns}"


@pytest.mark.anyio
async def test_api_timezone_offset_input_normalization(client: httpx.AsyncClient, teacher_auth: dict):
    """
    NEW API VALIDATION & NO DOUBLE CONVERSION:
    If client supplies an offset-aware timestamp e.g. +05:30:
    start_time = "2026-09-10T10:00:00+05:30"
    end_time = "2026-09-10T12:00:00+05:30"
    Backend must normalize to exact UTC:
    start_time -> 2026-09-10T04:30:00Z
    end_time -> 2026-09-10T06:30:00Z
    And NEVER add another +05:30 (double-conversion).
    """
    payload = {
        "name": "Offset Aware Normalization Exam",
        "subject_id": "cs_101",
        "duration_minutes": 120,
        "total_marks": 100.0,
        "passing_marks": 40.0,
        "start_time": "2026-09-10T10:00:00+05:30",
        "end_time": "2026-09-10T12:00:00+05:30"
    }
    create_res = await client.post("/api/v1/exams/", json=payload, headers=teacher_auth)
    assert create_res.status_code == 200, create_res.text
    exam_data = create_res.json()

    # Verify stored UTC instant matches 04:30:00Z, not shifted to 15:30:00Z
    assert "2026-09-10T04:30:00" in exam_data["start_time"]
    assert "2026-09-10T06:30:00" in exam_data["end_time"]


@pytest.mark.anyio
async def test_timer_server_authority_clock_tampering_immunity(client: httpx.AsyncClient, teacher_auth: dict, student_auth: dict):
    """
    TIMER IMMUNITY:
    The server UTC deadline is authoritative.
    If exam duration or deadline has expired on server, student heartbeat triggers auto_submitted
    and save_progress rejects incoming answers regardless of student's local clock.
    """
    # Create an exam with active window but short duration (1 minute)
    now = now_utc()
    active_start = (now - timedelta(minutes=10)).isoformat()
    active_end = (now + timedelta(hours=2)).isoformat()

    exam_res = await client.post("/api/v1/exams/", json={
        "name": "Timer Authority Test Exam",
        "subject_id": "cs_101",
        "duration_minutes": 1,
        "total_marks": 50.0,
        "passing_marks": 20.0,
        "start_time": active_start,
        "end_time": active_end
    }, headers=teacher_auth)
    assert exam_res.status_code == 200
    exam_id = exam_res.json()["id"]
    exam_code = exam_res.json()["exam_code"]

    # Publish exam
    await client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_auth)

    # Student direct-start (student starts exam)
    start_res = await client.post(f"/api/v1/attempts/direct-start?exam_code={exam_code}", headers=student_auth)
    assert start_res.status_code == 200
    session_token = start_res.json()["session_token"]
    sub_id = start_res.json()["submission_id"]

    # Manually backdate submission's started_at and deadline_at to simulate time passing past deadline
    from tests.conftest import TestingSessionLocal
    from app.models.exam import ExamSubmission
    db = TestingSessionLocal()
    try:
        sub = db.query(ExamSubmission).filter(ExamSubmission.id == sub_id).first()
        sub.started_at = now - timedelta(minutes=15)
        sub.deadline_at = now - timedelta(minutes=14)
        db.commit()
    finally:
        db.close()

    # Student heartbeat must report time expired / auto_submitted because server deadline is passed
    hb_res = await client.post(f"/api/v1/attempts/heartbeat?token={session_token}")
    assert hb_res.status_code == 200
    hb_data = hb_res.json()
    assert hb_data["status"] in ["auto_submitted", "submitted"] or hb_data["action"] in ["force_submit", "redirect_completed"]

    # Student attempting save-progress after deadline must be rejected / auto-submitted
    save_res = await client.post(
        f"/api/v1/attempts/save-progress?token={session_token}",
        json={"answers": {"q1": "Late Answer"}, "_client_timestamp": "2026-09-10T10:00:00Z"}
    )
    assert save_res.status_code in [200, 400]
    if save_res.status_code == 200:
        assert save_res.json().get("status") in ["auto_submitted", "submitted"]


