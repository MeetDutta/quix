# EduQuizX — Project Memory & Technical Log

## 1. Project Identity & Verified Credentials

- **Application Name**: **EduQuizX**
- **Repository**: [edgenmedia/EduQuizX](https://github.com/edgenmedia/EduQuizX.git)
- **Teacher / Admin Account**:
  - **Email**: `meetdutta001@gmail.com`
  - **Password**: `securepassword`
  - **Role**: `teacher` / `inst_admin`
- **Default Institution**: EduQuizX Academy

---

## 2. Key Bug Fixes & Architectural Decisions

### 2.1 MCQ Rendering & Type Case-Insensitivity
- **Issue**: Some generated questions had `question_type: "MCQ"` or `"choice"` in uppercase, causing the candidate room to render them as subjective textareas.
- **Solution**: Standardized `question_type` normalization across backend (`.lower()`) and updated frontend exam room to check `(Array.isArray(options) && options.length > 0) || ["mcq", "tf", "true_false", "choice"].includes(type.toLowerCase())`.

### 2.2 Question Counter Strict Slicing
- **Issue**: AI generator occasionally produced an extra question (+1 count) exceeding the requested count.
- **Solution**: Sliced generated questions strictly to `raw_questions[:count]` in both `ai_service.py` and `exams.py`.

### 2.3 Cascading Exam Deletion Sequence
- **Issue**: Deleting published exams caused foreign key constraint violations because submissions referenced exams and proctoring logs referenced submissions.
- **Solution**: Implemented child-first cascading deletion sequence inside an atomic transaction:
  ```python
  submissions = db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).all()
  for s in submissions:
      db.query(ProctoringLog).filter(ProctoringLog.submission_id == s.id).delete(synchronize_session=False)
  db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam_id).delete(synchronize_session=False)
  db.query(ExamCredential).filter(ExamCredential.exam_id == exam_id).delete(synchronize_session=False)
  exam.is_deleted = True
  db.commit()
  ```

### 2.4 FastAPI Static vs Dynamic Route Order
- **Issue**: `/reports/my-submissions` was returning HTTP 404 because `@router.get("/{exam_id}")` was declared above it and intercepted the path.
- **Solution**: Reorganized routes so all static/explicit paths (`/my-submissions`, `/submission-detail/{id}`, `/leaderboard/{id}`) precede dynamic wildcard paths (`/{exam_id}`).

### 2.5 Student Portal Active Exams Feed
- **Issue**: Student portal only showed tests *after* submission. Active tests published by teachers were not visible.
- **Solution**: Created `GET /api/v1/students/assigned-exams` returning all published/live tests, start times, question counts, and individual candidate passcodes.

### 2.6 Whole-File Knowledge Base Extraction
- **Issue**: Ingestion needed to capture 100% of multi-format documents including tables and slide notes.
- **Solution**: Enhanced `rag_service.py` with full table extraction for DOCX (`doc.tables`), slide shapes and speaker notes for PPTX (`slide.notes_slide`), multi-page PDF loops, and Gemini Vision OCR for images.

### 2.7 KaTeX Math & Science Formula Rendering
- **Solution**: Built universal client component `<MathText />` with `katex` library to parse `$inline$` and `$$block$$` mathematical expressions across question studio, candidate exam room, student review portal, and printable PDF exams.

---

## 3. Automated Verification History
- **25-Point Master Verification Test Suite**: Executed with **100% Pass Rate (25/25)** covering Auth, Roster, KB RAG, AI Generator, Question Studio, Passcode Login, Anti-Cheat, Submissions, Auto-Grading, Analytics, and Lifecycle.
