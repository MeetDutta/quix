# QuickStart & Running Guide

Detailed step-by-step instructions for starting, running, and operating the **AI Dynamic Examination & Student Management System**.

---

## 📋 System Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Option A (Docker)**: Docker Desktop / Docker Engine & Docker Compose
- **Option B (Local Dev)**: Python `3.9+`, Node.js `18.0+`, npm `9.0+`

---

## 🐳 Starting with Docker (Recommended for Deployment)

You can launch both the FastAPI backend and Next.js frontend with a single command:

```bash
# From the project root
docker compose up --build
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

To run in detached background mode:
```bash
docker compose up -d
```

To stop containers:
```bash
docker compose down
```

---

## 🚀 How to Start Manually (Local Development)

To run the complete system, you will start two servers in separate terminal windows:
1. **Backend Server** (FastAPI on Port `8000`)
2. **Frontend Server** (Next.js on Port `3000`)

---

### Terminal 1: Backend Server (FastAPI)

1. Open your terminal and navigate to the project root directory:
   ```bash
   cd /Users/meet/Desktop/quiz_application
   ```

2. Activate the Python virtual environment:
   ```bash
   source venv/bin/activate
   ```

3. Ensure environment variables are loaded in `backend/.env`:
   ```env
   GEMINI_API_KEY=your-gemini-api-key-here
   SECRET_KEY=super-secret-key-change-in-production
   DATABASE_URL=sqlite:///./quiz.db
   ```

4. Launch the FastAPI Uvicorn server:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload --port 8000
   ```

> **Confirmation**: The backend is running when you see `Application startup complete` and server process started on `http://127.0.0.1:8000`.

---

### Terminal 2: Frontend Server (Next.js)

1. Open a second terminal window and navigate to the frontend directory:
   ```bash
   cd /Users/meet/Desktop/quiz_application/frontend
   ```

2. Start the Next.js development server:
   ```bash
   npm run dev
   ```

> **Confirmation**: The frontend is running when you see `Ready in ...` on `http://localhost:3000`.

---

## 🔑 Login Credentials

The system seeds default accounts automatically on initial startup:

| Account Type | Email | Password | Quick Action Button |
|---|---|---|---|
| **Teacher Studio** | `teacher@aegeus.edu` | `securepassword` | ⚡ *Fill Teacher Creds* |
| **Student Portal** | `student@aegeus.edu` | `securepassword` | 🎓 *Fill Student Creds* |

---

## 🌐 Application URLs

| Interface | URL | Description |
|---|---|---|
| **Main Portal Login** | [http://localhost:3000](http://localhost:3000) | Main sign-in screen for teachers and students |
| **Teacher Studio** | [http://localhost:3000/dashboard/teacher](http://localhost:3000/dashboard/teacher) | Full teacher hub (create exams, upload RAG docs, student directory) |
| **Student Portal** | [http://localhost:3000/dashboard/student](http://localhost:3000/dashboard/student) | Student hub (view live exams, past scorecards, performance overview) |
| **Direct Exam Portal** | `http://localhost:3000/exam/{EXAM_CODE}` | Isolated exam portal requiring exam session credentials |
| **API Documentation** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger UI for exploring backend endpoints |
| **Health Check** | [http://localhost:8000/health](http://localhost:8000/health) | System health status JSON |

---

## 📖 Feature & Operations Walkthrough

### 1. Uploading Study Materials (RAG Vector Indexing)

1. Log into **Teacher Studio** (`teacher@aegeus.edu`).
2. Click the **📚 Subject Knowledge Base** tab.
3. Enter a Subject Code (e.g. `biology_101`).
4. Select a file (`.pdf`, `.docx`, `.pptx`, `.txt`, `.csv`, `.png`, `.jpg`).
5. Click **`Index Material into Vector DB`**.
   *The system extracts text, chunks it, and generates embeddings for AI question retrieval.*

---

### 2. Creating an AI Exam Paper

1. In Teacher Studio, click the **📝 Create & Schedule Quiz** tab.
2. Enter **Subject Name** and **Quiz Title**.
3. Configure **Time Limit (mins)**, **Total Marks**, and optional **Schedule Window** (Start & End date/time).
4. Configure **Question Blueprint**:
   - Number of MCQs and Subjective questions
   - Question Type (MCQ, Subjective, True/False, Mixed)
   - Difficulty Level (Easy, Medium, Hard)
   - Topic Keyword (e.g., `Photosynthesis`)
5. Click **`Generate Non-Repeating Questions from Subject KB`**.
   *Questions will be compiled using RAG context from indexed documents.*

---

### 3. Publishing Exams & Exporting Credentials

1. Locate the generated exam card under **Question Papers & Live Links**.
2. Click **`Question Paper Review`** to inspect compiled questions, options, and answers.
3. Click **`Publish`** to make the exam live.
4. Click **`🔑 Gen Creds`** to generate student login credentials.
5. Click **`📥 CSV`** to download the `credentials_{exam_name}.csv` file containing student usernames and passwords.

---

### 4. Taking an Exam (Student View)

1. Navigate to the exam link: `/exam/{EXAM_CODE}`.
2. Enter the student's exam username (e.g., `std_alex_45741`) and 6-digit passcode.
3. Features available during the test:
   - **Live Countdown Timer Bar**: Sticky timer at top turning red under 5 minutes.
   - **Question Palette Grid**: Numbered grid tracking Answered (green), Flagged (amber), and Unanswered items.
   - **Flag for Review**: Bookmark questions to revisit before submitting.
   - **Proctoring Protection**: Tab switches, window resizes, or copy-paste attempts trigger security warnings.
4. Click **`Finish Exam`** and confirm submission.

---

### 5. Downloading Response Booklet with Correct Answers

After a student completes an exam:
- **Immediate Download**: Right after submission, click **`📄 Download / Print Response Booklet`** on the completion screen.
- **From Student Dashboard**: Under **Past Examination History**, click **`View Report`** → **`📄 Download Printable Response Booklet (PDF)`**.
- **From Teacher Studio**: In **Gradebook & Analytics**, view submission details and print response sheets.

> The response booklet includes: Student Info, Score & Percentage, Student's Selected Answers (green ✓ for correct, red ✕ for wrong), Official Correct Answers, Detailed Explanations, and AI Rubric Feedback.

---

### 6. Bulk Importing Students via CSV

1. In Teacher Studio, click the **👥 Student Roster & CSV** tab.
2. Under **Bulk Import from CSV**, choose a `.csv` file with the following headers:
   ```csv
   full_name,email,roll_number,division,batch
   John Doe,john@school.edu,CS-2024-002,A,2024-2028
   Jane Smith,jane@school.edu,CS-2024-003,A,2024-2028
   ```
3. Click **`Import Students from CSV`**.

---

## 🛠️ Troubleshooting & Commands

- **Check Server Status**:
  ```bash
  curl http://localhost:8000/health
  ```
  Returns `{"status":"healthy","database":"ok","ai_engine":"enabled"}`.

- **Re-creating Database / Resetting Data**:
  To start with fresh database tables, stop the backend server and remove the database file:
  ```bash
  rm backend/quiz.db
  ```
  On next backend server start, tables and initial seed data will be recreated automatically.
