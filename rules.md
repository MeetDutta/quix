# EduQuizX — System Rules & Coding Constraints

## 1. Data Integrity & Operational Rules

### 1.1 Real Data Policy
- **No Mock Data in Production**: All dashboards, tables, rosters, and test rooms must pull directly from active database records.
- **Permanent Teacher Credentials**: Email `meetdutta001@gmail.com` with password `securepassword`.

### 1.2 Database Deletion Sequence (Cascading Integrity)
- When deleting an assessment that has submissions and credentials, strictly execute deletions in child-first order inside an atomic transaction:
  1. Delete related `ProctoringLog` records linked to `ExamSubmission`.
  2. Delete `ExamSubmission` records.
  3. Delete `ExamCredential` records.
  4. Mark `Exam.is_deleted = True`.

### 1.3 Knowledge Base Ingestion Rules
- **100% Whole-File Preservation**: Never truncate pages, slides, or table rows during upload.
- **Multi-Modal Document Extraction**:
  - PDFs must iterate over every page (`reader.pages`).
  - Word documents must extract both paragraphs and embedded tables (`doc.tables`).
  - Presentations must extract shapes, slide tables, and speaker notes (`slide.notes_slide`).
  - Images must use multi-modal Gemini Vision OCR.
- **Unicode Sanitization**: Lone surrogates (`\ud800`–`\udfff`) must be cleaned via surrogatepass before UTF-8 encoding.

---

## 2. API Routing & Backend Rules

### 2.1 FastAPI Route Order Precedence
- **Static Before Dynamic**: Explicit routes (e.g. `/my-submissions`, `/assigned-exams`, `/submission-detail/{id}`) must ALWAYS be declared **before** catch-all wildcard routes (e.g. `/{exam_id}`).
- Declare any root-level parameter fallback routes at the very bottom of router files.

### 2.2 Question Schema & Type Normalization
- All `question_type` strings must be normalized to lowercase: `"mcq" | "true_false" | "subjective"`.
- MCQ questions must contain valid `options` array (minimum 2 options) and a valid `correct_answer` or `correct_option`.

### 2.3 Assessment Question Count Compliance
- AI question generators must slice raw generation strictly to `raw_questions[:count]` to prevent counter overshoots.
- When saving questions via the Question Studio (`PUT /api/v1/exams/{id}/questions`), total marks must be recalculated to match sum of individual question marks.

---

## 3. Frontend & UI/UX Rules

### 3.1 KaTeX Formula & Math Rendering
- All question stems, option cards, explanation solutions, and report cards containing scientific or mathematical text (`$...$` or `$$...$$`) must be wrapped in the universal `<MathText text={...} />` component.
- The KaTeX stylesheet (`katex/dist/katex.min.css`) must be imported globally in `app/layout.tsx`.

### 3.2 Responsive Theme & Color System
- Use predefined warm aesthetic design tokens (Warm terracotta `#C84B18` / `#EA580C`, stone neutrals `#242321` / `#F5F5F4`, beige canvas `#FBF9F5` / `#171615`).
- Ensure all interactive elements include micro-animations, hover feedback, and clear focus rings.

### 3.3 Anti-Cheat Sandbox Constraints
- Enforce fullscreen mode on assessment room entry.
- Capture `visibilitychange`, `blur`, `keydown` (F12, Cmd+C, Cmd+V, Alt+Tab) events and dispatch real-time proctoring alerts to `/api/v1/attempts/proctor-alert`.
