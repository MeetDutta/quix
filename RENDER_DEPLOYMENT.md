# Render Deployment Guide & Email Configuration (EduQuizX)

This guide addresses email delivery issues (credentials transmission, student authorization, and password reset) and environment setup when deploying to **Render**.

---

## 1. Why Emails Fail on Render Free Tier

Render's free tier **blocks all outbound SMTP traffic** on ports `25`, `465`, `587`, and `2525` to prevent spam abuse.
- Standard Python `smtplib.SMTP` and `smtplib.SMTP_SSL` to `smtp.gmail.com` will fail with:
  ```
  [Errno 111] Connection refused
  # or
  [Errno 110] Connection timed out / socket.timeout
  ```

---

## 2. Solutions

### Solution A: Use Resend HTTP REST API (Recommended — Free & Works Instantly)
Resend transmits emails via **HTTPS Port 443** (REST API), which is **never blocked** by Render or any cloud firewall.
1. Sign up for free at [resend.com](https://resend.com) (3,000 free emails/month, no credit card required).
2. Create an API Key (starts with `re_...`).
3. In your Render Dashboard -> Select your **Backend Web Service** -> Go to **Environment** tab:
   - Add Key: `RESEND_API_KEY`
   - Value: `re_your_api_key_here`
4. Click **Save Changes**.
5. The backend will automatically detect `RESEND_API_KEY` and deliver all student credentials, exam passcodes, and verification emails over HTTPS!

---

### Solution B: In-App Direct Credential Access (Zero Email Setup Required)
EduQuizX is built with direct in-app fallbacks so teachers can run exams even without an active email server:
1. **Exam Passcodes & Credentials**:
   - In **Teacher Studio** -> **Live Assessments Table** -> Click **"Credentials"** or **"Preview Credentials"**.
   - A full table of generated student usernames and 6-digit PINs is displayed right on screen.
   - Click **"Export CSV"** or copy individual credentials to share directly via Google Classroom, LMS, or WhatsApp.
2. **Student Authorization Link**:
   - In **Student Directory** -> Click on any student row to open the details drawer.
   - Click **"Copy Verification Link"** to copy the authorization URL directly:
     ```
     https://your-frontend.onrender.com/verify-student?token=<token>
     ```
3. **Student Verification Result**:
   - When a student opens the verification URL, the screen displays their generated portal password with a **"Copy Password"** button.

---

### Solution C: Render Paid Plan with SMTP Unblocking
If you upgrade to a paid Render instance ($7/month):
1. Submit a support ticket in the Render dashboard requesting:
   > *"Please unblock outbound SMTP ports 465 and 587 for my service so I can connect to smtp.gmail.com."*
2. Render support will whitelist outbound SMTP for your service.

---

## 3. Essential Render Environment Variables Checklist

Ensure these variables are configured in your **Backend Web Service** on Render:

| Variable | Recommended Value | Note |
| :--- | :--- | :--- |
| `FRONTEND_URL` | `https://your-frontend-service.onrender.com` | **Critical**: Ensures verification and exam links in emails point to your live site, not `localhost:3000` |
| `RESEND_API_KEY` | `re_...` (from resend.com) | Bypasses Render SMTP port blocking |
| `DATABASE_URL` | `postgresql://...` or `sqlite:///quiz.db` | PostgreSQL connection string (auto-normalizes `postgres://` to `postgresql://`) |
| `SECRET_KEY` | `your-random-32-char-secret-key` | JWT authentication signing secret |
| `GEMINI_API_KEY` | `your-gemini-api-key` | AI Blueprint Co-Pilot Question Generator |
| `ALLOWED_ORIGINS` | `*` or `https://your-frontend.onrender.com` | Prevents browser CORS errors |
| `PORT` | `8000` | Port for backend service |

---

## 4. Frontend Web Service Environment Variables

Ensure these variables are configured in your **Frontend Web Service** on Render:

| Variable | Value | Note |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://your-backend-service.onrender.com` | Points frontend API calls to live backend |
| `PORT` | `3000` or `10000` | Render port |
