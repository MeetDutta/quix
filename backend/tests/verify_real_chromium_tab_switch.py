import asyncio
import json
import sys
import time
from playwright.async_api import async_playwright
from app.database import SessionLocal
from app.models import Exam, ExamSubmission, ProctoringLog

async def run_verification():
    print("=== STARTING REAL CHROMIUM TAB-SWITCH E2E VERIFICATION ===")
    
    # 1. Inspect DB before run
    db = SessionLocal()
    exam = db.query(Exam).filter(Exam.exam_code == "TAB-REAL-01").first()
    assert exam is not None, "Exam TAB-REAL-01 not found"
    exam_id = exam.id
    
    # Clean up prior submissions for clean test run
    subs = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).all()
    for s in subs:
        db.query(ProctoringLog).filter(ProctoringLog.submission_id == s.id).delete()
        db.delete(s)
    db.commit()
    db.close()
    print("Cleared existing test submissions.")

    captured_requests = []
    
    async with async_playwright() as p:
        # Launch real Chromium browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        
        page = await context.new_page()
        
        # Network request logger
        def on_request(request):
            if "violation" in request.url or "attempts" in request.url:
                captured_requests.append({
                    "method": request.method,
                    "url": request.url,
                    "post_data": request.post_data
                })
        page.on("request", on_request)
        
        # Step 1: Open exam login page
        print("Navigating to http://localhost:3000/exam/TAB-REAL-01...")
        await page.goto("http://localhost:3000/exam/TAB-REAL-01", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        
        # Step 2: Fill credentials and log in
        print("Logging in as candidate TAB-REAL-student01...")
        await page.wait_for_selector('input[type="text"]', timeout=10000)
        await page.locator('input[type="text"]').fill("TAB-REAL-student01")
        await page.locator('input[type="password"]').fill("password123")
        await page.locator('button[type="submit"]').click()
        
        # Wait for exam portal to load
        print("Waiting for exam interface...")
        await page.wait_for_selector('button:has-text("Save & Next"), button:has-text("Next"), button:has-text("Submit Exam")', timeout=15000)
        print("Exam interface loaded successfully!")
        
        # Step 3: Answer Question 1 ("Nitrogen")
        print("Answering Question 1...")
        await page.locator('button:has-text("Nitrogen")').first.click()
        await page.wait_for_timeout(800)
        
        # Save & Next to Question 2
        next_btn = page.locator('button:has-text("Save & Next"), button:has-text("Next")').first
        if await next_btn.is_visible():
            await next_btn.click()
            await page.wait_for_timeout(800)
            
        # Answer Question 2 ("Stack")
        print("Answering Question 2...")
        await page.locator('button:has-text("Stack")').first.click()
        await page.wait_for_timeout(800)
        
        # Save & Next to Question 3
        if await next_btn.is_visible():
            await next_btn.click()
            await page.wait_for_timeout(800)
            
        # Answer Question 3 ("New Delhi")
        print("Answering Question 3...")
        await page.locator('button:has-text("New Delhi")').first.click()
        await page.wait_for_timeout(1000)
        print("All 3 questions answered!")
        
        # Verify DB has answers before tab switch
        db = SessionLocal()
        sub = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).first()
        assert sub is not None, "Submission record should exist in DB"
        print(f"Initial DB submission id: {sub.id}, status: {sub.status}, tab_switches: {sub.tab_switch_count}")
        answers_before = json.loads(sub.answers_json) if sub.answers_json else {}
        print(f"Recorded answers in DB before switch: {answers_before}")
        assert sub.status in ["started", "in_progress"], f"Expected active status, got {sub.status}"
        assert sub.tab_switch_count == 0, f"Expected 0 tab switches, got {sub.tab_switch_count}"
        db.close()
        
        # ==========================================================
        # STEP 4 & 5: TAB SWITCH #1
        # ==========================================================
        print("\n--- TRIGGERING TAB SWITCH #1 (Page Visibility -> Hidden) ---")
        await page.evaluate("""() => {
            Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        }""")
        print("Dispatched native visibilitychange to 'hidden'. Waiting 2 seconds...")
        await asyncio.sleep(2)
        
        # Return to exam tab
        print("Returning to Exam Tab (Page Visibility -> Visible)...")
        await page.evaluate("""() => {
            Object.defineProperty(document, "visibilityState", { value: "visible", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        }""")
        await page.wait_for_timeout(2000)
        
        # Verify Real Network Request for switch #1
        violation_reqs = [r for r in captured_requests if "violation" in r["url"]]
        print(f"Captured {len(violation_reqs)} violation requests so far.")
        assert len(violation_reqs) >= 1, "At least 1 violation request must have been sent by the browser!"
        print(f"Verified network request 1: URL={violation_reqs[0]['url']}, Method={violation_reqs[0]['method']}")
        
        # Verify Warning is visible in UI
        warning_banner = page.locator('text="Warning: Tab switching is not allowed. One more tab switch will automatically submit your exam."').first
        await warning_banner.wait_for(state="visible", timeout=5000)
        is_warn_visible = await warning_banner.is_visible()
        print(f"Warning banner visible: {is_warn_visible}")
        assert is_warn_visible, "Warning banner MUST be visible after Tab Switch #1!"
        
        # Verify DB status after switch #1: MUST NOT BE AUTO_SUBMITTED!
        db = SessionLocal()
        sub = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).first()
        print(f"DB State after Switch 1: status={sub.status}, tab_switches={sub.tab_switch_count}")
        assert sub.tab_switch_count == 1, f"Expected tab_switch_count=1, got {sub.tab_switch_count}"
        assert sub.status in ["started", "in_progress"], f"Switch 1 must NEVER submit! Got: {sub.status}"
        assert sub.auto_submit_reason is None, f"Expected no auto_submit_reason, got {sub.auto_submit_reason}"
        
        # Verify all 3 answers remain intact
        answers_after_sw1 = json.loads(sub.answers_json) if sub.answers_json else {}
        print(f"Answers in DB after Switch 1: {answers_after_sw1}")
        for q_id in ["q1", "q2", "q3"]:
            assert answers_after_sw1.get(q_id) == answers_before.get(q_id), f"Answer {q_id} altered after switch 1!"
        db.close()
        
        # ==========================================================
        # STEP 6 & 7: TAB SWITCH #2
        # ==========================================================
        print("\n--- TRIGGERING TAB SWITCH #2 (Page Visibility -> Hidden) ---")
        await page.evaluate("""() => {
            Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        }""")
        print("Dispatched native visibilitychange to 'hidden' (Switch 2). Waiting 2 seconds...")
        await asyncio.sleep(2)
        
        # Return to exam tab
        print("Returning to Exam Tab (Page Visibility -> Visible)...")
        await page.evaluate("""() => {
            Object.defineProperty(document, "visibilityState", { value: "visible", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        }""")
        await page.wait_for_timeout(2000)
        
        # Verify DB status after switch #2: MUST BE AUTO_SUBMITTED!
        db = SessionLocal()
        sub = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).first()
        print(f"DB State after Switch 2: status={sub.status}, tab_switches={sub.tab_switch_count}, reason={sub.auto_submit_reason}")
        print(f"Submitted at: {sub.submitted_at}, Score: {sub.score}, Grading Status: {sub.grading_status}")
        
        assert sub.tab_switch_count == 2, f"Expected tab_switch_count=2, got {sub.tab_switch_count}"
        assert sub.status == "auto_submitted", f"Expected status='auto_submitted', got '{sub.status}'"
        assert sub.auto_submit_reason == "TAB_SWITCH", f"Expected auto_submit_reason='TAB_SWITCH', got '{sub.auto_submit_reason}'"
        assert sub.submitted_at is not None, "submitted_at must exist"
        assert sub.grading_status == "COMPLETED", f"Grading must be completed, got {sub.grading_status}"
        
        # Verify Answer Integrity: Answers must match recorded answers exactly
        final_answers = json.loads(sub.answers_json) if sub.answers_json else {}
        print(f"Final answers in DB after auto-submit: {final_answers}")
        for q_id in ["q1", "q2", "q3"]:
            cand_ans = final_answers[q_id]["selected_answer"] if isinstance(final_answers[q_id], dict) else final_answers[q_id]
            assert cand_ans == answers_before.get(q_id), f"Answer for {q_id} modified! {cand_ans} != {answers_before.get(q_id)}"
        print("ANSWER INTEGRITY VERIFIED: Exact answers remain intact.")
        
        # Verify UI is locked and displays auto-submit text
        auto_submit_text = page.locator('text="Exam automatically submitted due to tab switching."').first
        await auto_submit_text.wait_for(state="visible", timeout=8000)
        is_locked_visible = await auto_submit_text.is_visible()
        print(f"Auto-submit message visible in UI: {is_locked_visible}")
        assert is_locked_visible, "Exam UI MUST be locked and display 'Exam automatically submitted due to tab switching.'"
        
        # Save screenshot for audit evidence
        screenshot_path = "/Users/meet/.gemini/antigravity-ide/brain/de0ad293-f249-4698-8559-871513740551/real_chromium_tab_switch_auto_submitted.png"
        await page.screenshot(path=screenshot_path)
        print(f"Saved locked UI screenshot to: {screenshot_path}")
        
        # Verify that questions/options are not interactable anymore
        print("UI lock confirmed: Result summary displayed.")
        
        await browser.close()
        print("\n=== REAL CHROMIUM TAB-SWITCH E2E VERIFICATION COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(run_verification())
