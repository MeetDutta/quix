# EduQuizX — New Features & Project Structure Plan

Two tracks, kept separate since they have different risk profiles: structural refactors touch
existing working code (higher regression risk, do incrementally with tests), new features are
additive. Planning only — nothing implemented yet.

---

# PART A — New Feature Ideas

Grounded in what's already in `PRD.md` / `Architecture.md` (RAG-based exam generation, live
proctoring, analytics) and what's conspicuously *not* there yet.

### A1. Question Bank / Reusable Question Library
**Why:** Right now questions only exist inside a generated exam (`Question` model tied to exam
generation flow in `backend/app/models/question.py`). Teachers regenerate similar questions
repeatedly instead of reusing a bank.
**Scope:** Tag questions by subject/topic/difficulty on save; add a "Question Bank" tab in the
teacher dashboard to browse/search/filter and drag existing questions into a new exam instead of
only AI-generating from scratch.
**Backend:** New `is_bank_question` flag + `tags` column on `Question`, `GET /questions/bank`
with filters.
**Frontend:** New tab in `dashboard/teacher/page.tsx` (or better — its own route, see Part B).

### A2. Student-Facing Progress Dashboard
**Why:** `reports.py` already computes rich analytics (leaderboard, per-exam breakdown) but it's
teacher-facing only. `dashboard/student/page.tsx` currently just lists assigned exams.
**Scope:** Add a trends view for students: score history over time (recharts, already a
dependency), topic-mastery radar chart, weak-topic call-outs pulled from the existing AI learning
diagnosis in `ai_service.py`.
**Backend:** `GET /reports/my-progress` aggregating a student's submissions across exams.
**Frontend:** New section in student dashboard using `recharts` (already installed, currently only
used on the teacher side).

### A3. Notification Center (in-app, not just email)
**Why:** Right now the only feedback channel is email (`email_service.py`) and toast messages that
disappear (`components/Toast.tsx`). Students/teachers have no persistent record of "exam
published", "authorization pending", "results ready".
**Scope:** A `Notification` model (user_id, type, message, read_at, created_at), bell icon in
`dashboard/layout.tsx` with unread count, `GET /notifications`, `POST /notifications/{id}/read`.
Emit notifications from existing event points (student created, exam published, submission
graded) alongside the existing emails rather than replacing them.

### A4. Exam Scheduling & Reminders
**Why:** Exams already have `start_time`/`end_time` (`models/exam.py`) but nothing proactively
reminds students. It's pure pull (student has to check the portal).
**Scope:** Background job (APScheduler or a simple cron-callable endpoint, since there's no task
queue yet) that emails/notifies students N hours before `start_time`, and auto-flags exams as
"ended" server-side rather than only computing `sched_status` on read.

### A5. Bulk Result Publishing / Grade Release Control
**Why:** `attempts.py`/`reports.py` suggest grading is instant/automatic for objective questions.
Teachers may want to review before students see individual scores (currently visible immediately
via `assigned-exams` → `submission_score`).
**Scope:** `is_result_published` flag on `Exam`; students see "Results pending review" until the
teacher hits "Publish Results" (bulk action), independent of the exam being closed.

### A6. Teacher-Side Manual Grading Queue for Subjective Answers
**Why:** PRD mentions "AI evaluation of subjective answers against rubrics" — worth adding a human
override queue since AI subjective grading is inherently imperfect.
**Scope:** `GET /attempts/{id}/subjective-answers` listing AI-graded subjective responses with
confidence/score, teacher can adjust marks inline before publishing (ties into A5).

### A7. Audit Log Viewer
**Why:** `AuditLog` model already exists (`models/exam.py` imports show `AuditLog`) but there's no
`api/audit.py` or frontend view for it — it looks like data is being written but never surfaced.
**Scope:** Confirm what's currently populating `AuditLog`; add `GET /audit-logs` (admin/inst_admin
only) and a simple table view — cheap win since the model already exists.

### A8. Multi-Institution / Tenant Admin Console
**Why:** `Institution` model + `super_admin` role already exist, implying multi-tenant intent, but
there's no dedicated admin UI to manage institutions, cross-institution reporting, or org-level
settings (branding, SMTP-from-name per institution, etc.).
**Scope:** New `dashboard/admin` route for `super_admin` only: institution CRUD (endpoint already
exists: `POST /students/institutions`, oddly located in `students.py` — see Part B for the fix),
department/course/subject management currently likely done ad hoc.

### A9. Dark Mode Toggle Persistence Check
**Why:** `globals.css` and JSX already reference `dark:` Tailwind classes extensively, implying
dark mode exists — worth confirming there's a user-facing toggle and that preference persists
(localStorage or `prefers-color-scheme`), since this wasn't visible in the pages reviewed. If a
toggle is missing, add one; if present, this item drops off the list.

### A10. Exam Question Import (not just AI-generated)
**Why:** Currently exams are built via `generate-from-kb` (AI) or manual entry inside the Question
Studio. Bulk-importing questions from an existing DOCX/CSV question set (common for teachers
migrating from another system) isn't supported.
**Scope:** `POST /exams/{id}/questions/import` accepting CSV/DOCX with a defined column schema,
reusing the `python-docx`/`pandas` deps already in `requirements.txt`.

---

# PART B — Project Structure Improvements

Findings are specific to what's in the repo, not generic advice.

## B1. Backend: introduce a migrations tool (Alembic)

**Problem:** `backend/app/main.py` runs raw `ALTER TABLE ... ADD COLUMN` inside `try/except`
blocks on every startup as a manual "zero-setup migration" — see the `cols_to_add` loop. This
works only for SQLite, silently swallows all errors (`except Exception: pass`), and has no
rollback story or versioning. It will not survive a move to Postgres (`psycopg2-binary` is already
a dependency, implying that's the intended production DB) since the ALTER statements aren't
guarded for dialect differences.

**Change:**
- Add `alembic` to `requirements.txt`, run `alembic init`.
- Convert the ad-hoc column-add logic in `main.py` into a proper migration.
- Remove the manual `Base.metadata.create_all` + ALTER-TABLE dance from `main.py`; replace with
  `alembic upgrade head` run as a startup step (or a documented manual step in `RUNNING_GUIDE.md`).

## B2. Backend: split oversized route files by sub-resource

**Problem:** `exams.py` (893 lines) and `reports.py` (641 lines) each handle many unrelated
concerns in one file — exam CRUD, credential generation, PDF export, question regeneration all
live in `exams.py`; analytics, CSV export, leaderboard, and printable reports all live in
`reports.py`.

**Change:** Split into sub-routers included under the same prefix, e.g.:
- `api/exams/crud.py`, `api/exams/credentials.py`, `api/exams/questions.py`,
  `api/exams/exports.py` → aggregated in `api/exams/__init__.py`.
- `api/reports/analytics.py`, `api/reports/exports.py`, `api/reports/leaderboard.py`.
No behavior change — pure file reorganization, so this is low-risk and mechanical (good candidate
for an agent to execute file-by-file with a diff review after each split).

## B3. Backend: add a data-access layer (stop querying the ORM directly in routes)

**Problem:** Every route handler builds SQLAlchemy queries inline (`db.query(Student).join(User)...`
repeated across `students.py`, `exams.py`, `reports.py`). There's no `crud/` or `repository`
layer, so the same query patterns (e.g. "students in current user's institution") are duplicated.

**Change:** Add `backend/app/crud/` with one module per model (`crud/student.py`, `crud/exam.py`,
etc.) exposing functions like `get_students_for_institution(db, institution_id, **filters)`.
Route handlers call these instead of building queries inline. Do this incrementally per-router
alongside B2, not as one giant rewrite.

## B4. Backend: relocate misplaced endpoints

**Problem:** Institution CRUD (`GET/POST /students/institutions`) lives inside `students.py`
despite having nothing to do with individual students — it's an artifact of quick prototyping.

**Change:** Move to a new `api/institutions.py` (ties into A8 above), registered in `main.py`
alongside the other routers.

## B5. Backend: consolidate config/security into a `core/` package

**Problem:** `config.py`, `database.py` sit at `app/` root while `utils/security.py` holds JWT +
password logic — a common FastAPI convention is a `core/` package (`core/config.py`,
`core/security.py`, `core/database.py`) so `api/`, `models/`, `schemas/` all import from one
predictable place. Not urgent, but worth doing during the B2/B3 pass since imports are already
being touched.

## B6. Backend: organize tests into `backend/tests/`

**Problem:** `test_e2e_suite.py` and `test_google_auth_workflow.py` sit at the repo root, outside
`backend/`, with no `tests/` package structure, no `conftest.py`, and no visible fixtures for a
test DB (risk: tests may be hitting the same `quiz.db` as dev).

**Change:** Move both into `backend/tests/`, add `conftest.py` with a fixture that spins up a
throwaway SQLite/in-memory DB per test session (override `get_db` dependency), and split
`test_e2e_suite.py` by feature area (`tests/test_students.py`, `tests/test_exams.py`,
`tests/test_auth.py`) as it grows.

## B7. Backend: pin and audit dependencies

**Problem:** `requirements.txt` pins versions but several are old (FastAPI 0.110, SQLAlchemy
2.0.28 from early 2024) with no `requirements-dev.txt` separation (pytest is mixed into the main
requirements file) and no dependency-update process (no Dependabot/Renovate config).

**Change:** Split into `requirements.txt` (runtime) + `requirements-dev.txt` (pytest, linters);
add a `.github/dependabot.yml` if the repo moves to GitHub-hosted CI (see B11).

## B8. Frontend: break up the 2480-line teacher dashboard page

**Problem:** `frontend/app/dashboard/teacher/page.tsx` is a single 2480-line client component
handling students, knowledge base, exams, reports, and settings all in one file with dozens of
`useState` calls and inline fetch handlers.

**Change:** Split by tab into `frontend/app/dashboard/teacher/_components/`:
- `StudentRoster.tsx` (A1/A8-adjacent), `KnowledgeBaseManager.tsx`, `ExamBuilder.tsx`,
  `ReportsPanel.tsx` — each owns its own state and fetch calls.
- `page.tsx` becomes a thin shell: tab switcher + rendering the active component.
- This is best done tab-by-tab (one component extracted, verified working, then the next) rather
  than as one giant rewrite, since it's currently one working file.

## B9. Frontend: introduce a typed API client per domain instead of raw `apiFetch` calls everywhere

**Problem:** `lib/api.ts` only exports a generic `apiFetch` wrapper; every page constructs its own
URL strings and inline `res.json()` parsing with no shared response types (`any` is implied
throughout given no `types/` directory exists).

**Change:** Add `frontend/lib/api/students.ts`, `exams.ts`, `reports.ts`, `auth.ts` — each
exporting typed functions (`listStudents(): Promise<Student[]>`, `createStudent(data): Promise<Student>`)
built on top of `apiFetch`. Add `frontend/types/` with shared interfaces (`Student`, `Exam`,
`Submission`, etc.) matching the backend Pydantic schemas.

## B10. Frontend: actually use `@tanstack/react-query` (already installed, unused)

**Problem:** `react-query` is a declared dependency and `Providers.tsx` likely wraps the app in a
`QueryClientProvider` (worth confirming), but no component in the codebase calls `useQuery` or
`useMutation` — all data fetching is manual `useEffect` + `useState` + `apiFetch`, meaning no
caching, no automatic refetch, no request de-duplication despite paying the bundle-size cost of
the library.

**Change:** Once B9's typed API client exists, migrate list-fetching (`fetchStudents`,
`fetchExams`, `fetchDocuments`) to `useQuery`, and mutations (`handleAddStudent`,
`handleUpdateStudent`, `handleDeleteStudent`) to `useMutation` with `invalidateQueries` replacing
the manual `fetchStudents()` re-call after every write. Do this alongside B8 since it's the same
files being touched.

## B11. Add CI (currently none)

**Problem:** No `.github/workflows/` directory — no automated lint/test/build on push or PR.

**Change:** Add a basic GitHub Actions workflow: backend (`pytest`, once B6 lands), frontend
(`npm run lint`, `npm run build`). Cheap to add, catches regressions from B2/B8 refactors
immediately.

## B12. Environment variable documentation

**Problem:** `config.py` and the Google OAuth work (from the previous plan) both need `.env`
values, but there's no `.env.example` in either `backend/` or `frontend/` — `RUNNING_GUIDE.md`
should be checked for whether it covers this, and a `.env.example` added if not.

---

## Suggested sequencing

1. B1 (Alembic) — do before any other schema changes (A1, A3, A5, A6, A7's audit log, B4) so new
   features don't add to the ad-hoc-migration debt.
2. B6 (test structure) — do before B2/B3/B8 refactors so there's a safety net while moving code.
3. B2 + B3 (backend split + data-access layer) — mechanical, low-risk once tests exist.
4. B4, B5, B7 — small cleanups, bundle with B2/B3 since files are already open.
5. B9 (typed API client) — needed before B8 and B10 to avoid extracting components against an
   untyped API surface twice.
6. B8 + B10 (frontend split + react-query adoption) — do together, tab by tab.
7. B11 (CI) — add once B6 exists so it has something to run.
8. New features (Part A) — build on top of the now-restructured code; A7 (audit log) and A9 (dark
   mode check) are cheap enough to slot in anywhere since they're mostly discovery + wiring.

Each Part B item above is scoped as an independent, verifiable change (specific files, specific
before/after) so an agent can execute them one at a time with a working app after each step,
rather than one large "restructure everything" pass.
