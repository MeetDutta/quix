# EduQuizX — UI/UX Design System & Aesthetics

## 1. Visual Philosophy & Design Language
EduQuizX uses a refined **Warm Editorial & Modern SaaS** design aesthetic. It combines high-clarity typography, subtle warmth in neutral tones, and rich accent colors to provide an enjoyable experience for both instructors and student candidates.

---

## 2. Color Palette & Design Tokens

### 2.1 Color Spectrum

| Token Name | Light Mode Value | Dark Mode Value | Usage |
|---|---|---|---|
| **Primary Brand (Terracotta)** | `#C84B18` | `#EA580C` | Primary buttons, active tabs, brand icons, key highlights |
| **Secondary Neutral (Stone)** | `#716D67` | `#A8A29E` | Secondary copy, metadata, timestamps, subtitles |
| **Foreground Text** | `#242321` | `#F5F5F4` | Headings, main text, table content |
| **Canvas Background** | `#FBF9F5` | `#171615` | Body background, root container |
| **Surface Card** | `#FFFFFF` | `#1D1B19` | Content cards, modal dialogs, question containers |
| **Border Neutral** | `#E5E0D8` | `#292524` | Card outlines, dividers, table borders |
| **Success Emerald** | `#059669` | `#10B981` | Passed tags, correct answers, active status |
| **Alert Amber** | `#D97706` | `#F59E0B` | Scheduled tests, flags, draft statuses |
| **Violation Rose** | `#E11D48` | `#F43F5E` | Anti-cheat red flags, failed tests, delete actions |
| **Information Blue** | `#2563EB` | `#3B82F6` | Teacher preview badges, info pills |

---

## 3. Typography & Hierarchy
- **Primary Body & Headings**: `Outfit` / `Inter`, system UI fallback.
- **Code & Monospace**: `JetBrains Mono` / `ui-monospace` (used for exam codes, student roll numbers, and session passcodes).
- **Scale**:
  - `Hero / Title`: `text-2xl font-extrabold` (24px–32px)
  - `Section Header`: `text-lg font-bold` (18px)
  - `Card Header`: `text-sm font-bold` (14px)
  - `Body Copy`: `text-xs md:text-sm` (12px–14px)
  - `Micro Tag / Metadata`: `text-[10px] font-semibold uppercase tracking-wider`

---

## 4. Key Component Layout Specifications

### 4.1 Teacher Dashboard (`/dashboard/teacher`)
- **Navigation Bar**: Tab switcher with icon indicators: *Assessments, Create Assessment Wizard, Knowledge Base, Students Directory, Analytics Reports*.
- **Live Assessment Table**: Status chips (Live, Draft, Scheduled, Ended), Action icons (Live Proctor Room, AI Question Studio Preview, PDF Question Paper, Passcode Generation, End Early, Cascading Delete).
- **AI Question Studio Modal**:
  - Top bar with duration, total marks, and "Edit Mode" toggle.
  - Question cards with `<MathText />` equation rendering, inline text/marks editing, and individual **AI Re-Roll** button with spinning feedback.
  - Action footer with "Save Paper Changes", "Add Custom Question", and "Print PDF".

### 4.2 Live Anti-Cheat Proctoring Room
- **Header**: Pulsing red live indicator with WebSocket stream connection status.
- **Metrics Bar**: Red Flag Count, Active Listening Guard, Duration Remaining.
- **Event Feed**: Live violation cards (Tab switch, Fullscreen exit, Blur) with exact event timestamps and remote "End Assessment Early" button.

### 4.3 Student Exam Room (`/exam/[exam_code]`)
- **Top Bar**: Sticky header with countdown timer, Question progress counter, and "Submit Exam" button.
- **Main Arena**:
  - Left: Question stem with KaTeX formula rendering, option selection buttons, or rich subjective textarea.
  - Right: Quick question matrix palette with Answered, Unanswered, and Flagged color-coded indicators.
  - Fullscreen Lock: Overlay warning prompt when fullscreen is exited or window loses focus.

### 4.4 Student Portal (`/dashboard/student`)
- **Top Header**: Verified student badge, overall completed quiz count, cohort average, best score, and pass rate.
- **Dual Tab Switcher**:
  - *Tab 1: Assigned & Live Tests*: Available exams, live countdowns, session passcode cards, and 1-click "Enter Exam Room" buttons.
  - *Tab 2: Past Submissions & Analytics*: Submissions list on the left, question-by-question review with KaTeX formulas, topic mastery breakdown, and class leaderboard on the right.
