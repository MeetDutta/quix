import asyncio
import json
import sys
import time
import httpx
from playwright.async_api import async_playwright
from app.database import SessionLocal
from app.models import Exam, ExamSubmission, ProctoringLog, ExamCandidate, ExamCredential, User, AuditLog
from app.utils.security import create_access_token

async def run_verification():
    print("=== STARTING REAL CHROMIUM POST-DEPLOYMENT & REATTEMPT E2E ===")
    
    db = SessionLocal()
    exam = db.query(Exam).filter(Exam.exam_code == "TAB-REAL-01").first()
    assert exam is not None, "Exam TAB-REAL-01 not found"
    exam_id = exam.id

    teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
    assert teacher is not None, "Teacher user not found"
    teacher_token = create_access_token(subject=teacher.id)

    cand = db.query(ExamCandidate).filter(ExamCandidate.exam_id == exam_id).first()
    assert cand is not None, "Candidate not found"
    cand_id = cand.id

    cred = db.query(ExamCredential).filter(ExamCredential.candidate_id == cand_id).first()
    assert cred is not None, "Credential not found"
    cred_username = cred.username
    cred_password = cred.password
    
    # Clean up prior submissions for clean test run
    subs = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).all()
    for s in subs:
        db.query(ProctoringLog).filter(ProctoringLog.submission_id == s.id).delete()
        db.delete(s)
    db.commit()
    db.close()
    print(f"Cleaned up existing test submissions. Credential: {cred_username}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        # Step 1: Login for Attempt #1
        print("Navigating to http://localhost:3000/exam/TAB-REAL-01...")
        await page.goto("http://localhost:3000/exam/TAB-REAL-01", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)

        print("Logging in for Attempt #1...")
        await page.wait_for_selector('input[type="text"]', timeout=20000)
        await page.locator('input[type="text"]').fill(cred_username)
        await page.locator('input[type="password"]').fill(cred_password)
        await page.locator('button[type="submit"]').click()

        # Wait for exam interface
        print("Waiting for exam interface...")
        await page.wait_for_selector('button:has-text("Save & Next"), button:has-text("Next"), button:has-text("Submit Exam")', timeout=15000)
        print("Exam interface loaded!")

        # Answer Question 1
        print("Answering Question 1 on Attempt #1...")
        await page.locator('button:has-text("Nitrogen")').first.click()
        await page.wait_for_timeout(1000)

        # Tab Switch 1 (Strike 1)
        print("Triggering Tab Switch #1 (document hidden)...")
        await page.evaluate("""() => {
            Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        }""")
        await page.wait_for_timeout(2000)

        # Return to exam
        print("Returning to exam tab (document visible)...")
        await page.evaluate("""() => {
            Object.defineProperty(document, "visibilityState", { value: "visible", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        }""")
        await page.wait_for_timeout(2000)

        # Tab Switch 2 (Strike 2 -> Auto-submit)
        print("Triggering Tab Switch #2 (document hidden -> Auto-submit)...")
        await page.evaluate("""() => {
            Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        }""")
        await page.wait_for_timeout(3000)

        # Return to exam
        print("Returning to exam tab to verify auto-submit...")
        await page.evaluate("""() => {
            Object.defineProperty(document, "visibilityState", { value: "visible", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        }""")
        await page.wait_for_timeout(2500)

        # Verify DB for Attempt #1
        db = SessionLocal()
        att1 = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam_id,
            ExamSubmission.candidate_id == cand_id,
            ExamSubmission.attempt_number == 1
        ).first()

        assert att1 is not None, "Attempt #1 must exist"
        print(f"Attempt #1 in DB: status={att1.status}, reason={att1.auto_submit_reason}, strikes={att1.tab_switch_count}, is_counted={att1.is_counted_for_result}")
        assert att1.status == "auto_submitted", f"Expected auto_submitted, got {att1.status}"
        assert att1.auto_submit_reason == "TAB_SWITCH", f"Expected TAB_SWITCH, got {att1.auto_submit_reason}"
        assert att1.tab_switch_count >= 2, f"Expected strikes >= 2, got {att1.tab_switch_count}"
        assert att1.is_counted_for_result is True, "Attempt #1 must remain is_counted_for_result=True"
        att1_id = att1.id
        db.close()

        # Step 2: Teacher authorizes controlled reattempt
        print("Teacher granting controlled reattempt via API...")
        async with httpx.AsyncClient(base_url="http://localhost:8000") as api_client:
            res_reattempt = await api_client.post(
                f"/api/v1/exams/{exam_id}/candidates/{cand_id}/reattempt",
                headers={"Authorization": f"Bearer {teacher_token}"},
                json={"reason": "Teacher authorized controlled reattempt in E2E", "time_policy": "remaining"}
            )
            assert res_reattempt.status_code == 200, f"Reattempt grant failed: {res_reattempt.text}"
            reattempt_data = res_reattempt.json()
            print("Reattempt API Response:", reattempt_data["message"])
            assert reattempt_data["attempt_number"] == 2

        # Verify DB state after reattempt granted
        db = SessionLocal()
        subs = db.query(ExamSubmission).filter(
            ExamSubmission.exam_id == exam_id,
            ExamSubmission.candidate_id == cand_id
        ).order_by(ExamSubmission.attempt_number.asc()).all()
        assert len(subs) == 2, f"Expected exactly 2 submissions, found {len(subs)}"
        
        att1_check = subs[0]
        att2_check = subs[1]
        print(f"Verified DB after grant: Att #1 (id={att1_check.id}, status={att1_check.status}, is_counted={att1_check.is_counted_for_result})")
        print(f"Verified DB after grant: Att #2 (id={att2_check.id}, status={att2_check.status}, is_counted={att2_check.is_counted_for_result})")
        
        assert att1_check.id == att1_id
        assert att1_check.status == "auto_submitted"
        assert att1_check.is_counted_for_result is True
        
        assert att2_check.attempt_number == 2
        assert att2_check.status == "started"
        assert att2_check.tab_switch_count == 0
        assert att2_check.is_counted_for_result is False
        assert att2_check.reopened_from_id == att1_id
        att2_id = att2_check.id
        db.close()

        # Step 3: Student launches Attempt #2
        print("Student logging in for Attempt #2...")
        page_att2 = await context.new_page()
        await page_att2.goto("http://localhost:3000/exam/TAB-REAL-01", wait_until="domcontentloaded")
        await page_att2.wait_for_timeout(1500)

        await page_att2.wait_for_selector('input[type="text"]', timeout=20000)
        await page_att2.locator('input[type="text"]').fill(cred_username)
        await page_att2.locator('input[type="password"]').fill(cred_password)
        await page_att2.locator('button[type="submit"]').click()

        # Wait for exam interface for Attempt #2
        print("Waiting for Attempt #2 exam interface...")
        await page_att2.wait_for_selector('button:has-text("Save & Next"), button:has-text("Next"), button:has-text("Submit Exam")', timeout=15000)
        print("Attempt #2 loaded fresh in Chromium!")

        # Answer questions in Attempt #2
        print("Answering questions on Attempt #2...")
        await page_att2.locator('button:has-text("Nitrogen")').first.click()
        await page_att2.wait_for_timeout(800)

        next_btn = page_att2.locator('button:has-text("Save & Next"), button:has-text("Next")').first
        if await next_btn.is_visible():
            await next_btn.click()
            await page_att2.wait_for_timeout(800)

        await page_att2.locator('button:has-text("Stack")').first.click()
        await page_att2.wait_for_timeout(800)

        # Submit Attempt #2
        print("Submitting Attempt #2...")
        submit_btn = page_att2.locator('button:has-text("Submit Exam")').first
        if await submit_btn.is_visible():
            await submit_btn.click()
            await page_att2.wait_for_timeout(1000)
            confirm_btn = page_att2.locator('button:has-text("Submit Final Exam"), button:has-text("Yes, Submit Exam"), button:has-text("Confirm Submit")').first
            if await confirm_btn.is_visible():
                await confirm_btn.click()
                await page_att2.wait_for_timeout(3000)

        # Capture screenshot of Attempt #2 submission review
        screenshot_path = "/Users/meet/.gemini/antigravity-ide/brain/de0ad293-f249-4698-8559-871513740551/reattempt_e2e_verified.png"
        await page_att2.screenshot(path=screenshot_path)
        print(f"Captured screenshot at {screenshot_path}")

        # Step 4: Verify DB states and Designate Attempt #2 as Final Result
        db = SessionLocal()
        att2_final = db.query(ExamSubmission).filter(ExamSubmission.id == att2_id).first()
        print(f"Attempt #2 final status in DB: status={att2_final.status}, score={att2_final.score}")
        
        # Step 5: Teacher designates Attempt #2 as the official counted result
        print("Teacher designating Attempt #2 as official result...")
        async with httpx.AsyncClient(base_url="http://localhost:8000") as api_client:
            res_select = await api_client.post(
                f"/api/v1/exams/{exam_id}/candidates/{cand_id}/select-result-attempt",
                headers={"Authorization": f"Bearer {teacher_token}"},
                json={"attempt_number": 2, "notes": "Approved Attempt #2 legitimate result"}
            )
            assert res_select.status_code == 200, f"Select result attempt failed: {res_select.text}"
            print("Select Result API Response:", res_select.json()["message"])

        # Final DB verification
        db.expire_all()
        att1_done = db.query(ExamSubmission).filter(ExamSubmission.id == att1_id).first()
        att2_done = db.query(ExamSubmission).filter(ExamSubmission.id == att2_id).first()

        print(f"FINAL AUDIT:")
        print(f"Attempt #1: status={att1_done.status}, is_counted={att1_done.is_counted_for_result}, score={att1_done.score}, strikes={att1_done.tab_switch_count}")
        print(f"Attempt #2: status={att2_done.status}, is_counted={att2_done.is_counted_for_result}, score={att2_done.score}, strikes={att2_done.tab_switch_count}")

        assert att1_done.is_counted_for_result is False, "Attempt #1 is_counted_for_result must now be False"
        assert att2_done.is_counted_for_result is True, "Attempt #2 is_counted_for_result must now be True"
        assert att1_done.status == "auto_submitted", "Attempt #1 status must remain auto_submitted"

        audit_entries = db.query(AuditLog).filter(
            AuditLog.action.in_(["REATTEMPT_GRANTED", "FINAL_RESULT_ATTEMPT_SELECTED"])
        ).all()
        assert len(audit_entries) >= 2, "Both audit events must exist in audit log"
        print("Audit entries verified successfully!")

        db.close()
        await browser.close()
        print("=== REAL CHROMIUM POST-DEPLOYMENT & REATTEMPT E2E PASSED 100% ===")

if __name__ == "__main__":
    asyncio.run(run_verification())
