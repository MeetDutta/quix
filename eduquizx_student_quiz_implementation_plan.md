# EduQuizX — Student Directory, Cohort & Quiz Class Implementation Plan

## 1. Objective

Refactor the existing EduQuizX student and quiz assignment architecture so it scales from hundreds to tens of thousands of students without creating duplicate student records.

The implementation must support:

1. A hierarchical academic structure:
   - Institution
   - Department
   - Program/Course
   - Academic Session
   - Cohort
   - Students
2. Subject offerings tied to a cohort and teacher.
3. Student-subject enrollment.
4. A scalable Student Repository with server-side filtering, search and pagination.
5. A Quiz/Test Repository that can target:
   - an existing cohort/class,
   - a newly created reusable class/group,
   - or a custom set of students.
6. Quiz-specific student inclusion/exclusion overrides.
7. Backward-compatible migration of existing students, exams, credentials and attempts.
8. No duplicate student records when creating classes/groups.
9. Proper tenant/institution isolation and role-based access control.
10. A clean UI that makes academic grouping easy for teachers.

---

# 2. Core Architectural Principle

Separate these four concepts:

**Student Identity → Academic Placement → Subject Enrollment → Quiz Assignment**

Do NOT create a separate student record per subject or quiz.

A student must exist once in the institution's student master directory.

Academic placement determines where the student currently belongs.

Subject enrollment determines which subjects the student takes.

Quiz assignment determines which assessment the student is eligible to attempt.

---

# 3. Final Domain Model

```text
Institution
    │
    └── Department
          │
          └── Program / Course
                │
                ├── Subjects
                │
                └── Academic Session
                      │
                      └── Cohort
                            │
                            ├── Year
                            ├── Semester
                            ├── Division
                            │
                            └── Students
                                  │
                                  └── Subject Enrollment


Subject
   ↓
Subject Offering
   ↓
Cohort + Teacher
   ↓
Quiz / Exam
   ↓
Assessment Group
   ↓
Eligible Students
   ↓
Exam Credentials
   ↓
Attempt
   ↓
Submission
```

---

# 4. Database Changes

## 4.1 Institution

Keep the existing `Institution` model.

Requirements:
- Tenant isolation must remain mandatory.
- Every academic entity must ultimately belong to an institution.

---

## 4.2 Department

Keep the existing `Department` model but ensure:

```text
Department
-----------
id
institution_id
name
code
is_active
created_at
updated_at
```

Constraints:
- `(institution_id, code)` must be unique.
- Soft-disable departments with `is_active`.
- Never allow cross-institution access.

---

## 4.3 Program / Course

Use the existing `Course` model and make it institution-safe through its department.

Suggested fields:

```text
Course
------
id
department_id
name
code
degree_type
duration_years
is_active
created_at
updated_at
```

Example:

```text
B.E. Computer Engineering
```

---

# 5. Academic Session

Refactor the current `AcademicYear` into an institution-scoped academic session.

```text
AcademicSession
---------------
id
institution_id
name
start_date
end_date
is_active
created_at
updated_at
```

Examples:

```text
2025-26
2026-27
2027-28
```

Rules:
- Only one active session per institution unless existing business rules explicitly require otherwise.
- Historical sessions must remain immutable except for administrative correction.

---

# 6. Cohort

Create a new first-class `Cohort` entity.

A cohort represents the official academic grouping of students.

```text
Cohort
------
id
course_id
academic_session_id
year_number
semester_number
division
name
is_active
created_at
updated_at
```

Example:

```text
Course: B.E. Computer Engineering
Session: 2026-27
Year: 3
Semester: 6
Division: A
Name: CE-3-A
```

Uniqueness should prevent accidental duplicate cohorts:

```text
course_id
+ academic_session_id
+ year_number
+ division
```

If the institution operates without divisions in some programs, allow nullable/standardized division values rather than forcing fake values.

---

# 7. Student

Refactor the current Student model.

Do NOT permanently store:

```text
student.department_id
student.division
student.batch
```

as the source of truth.

Use:

```text
Student
-------
id
user_id
institution_id
roll_number
admission_year
status
created_at
updated_at
```

Student identity must remain institution-scoped and unique.

Recommended uniqueness:

```text
(institution_id, roll_number)
(institution_id, user_id)
```

Status examples:

```text
ACTIVE
INACTIVE
GRADUATED
SUSPENDED
```

---

# 8. Student Cohort Membership

Create:

```text
StudentCohortMembership
-----------------------
id
student_id
cohort_id
is_current
joined_at
left_at
```

Purpose:
- Allows students to move through academic years.
- Preserves historical placement.
- Prevents the student's department/year/division from becoming duplicated fields.

Example:

```text
Meet Dutta
2024-25 → CE-1-A
2025-26 → CE-2-A
2026-27 → CE-3-B
```

Rules:
- A student may have many historical memberships.
- At most one membership should be `is_current = true`.
- All memberships must belong to the same institution as the student.

---

# 9. Subject

Keep/refactor the existing Subject model:

```text
Subject
-------
id
course_id
name
code
semester
is_active
created_at
updated_at
```

Uniqueness:

```text
(course_id, code)
```

---

# 10. Subject Offering

Create a new entity:

```text
SubjectOffering
---------------
id
subject_id
cohort_id
teacher_id
academic_session_id
status
created_at
updated_at
```

This represents a subject actually being taught to a particular cohort.

Example:

```text
DBMS
Computer Engineering
3rd Year
Division A
2026-27
Teacher: Prof. Sharma
```

This is critical because the same subject may be offered to many cohorts.

---

# 11. Student Subject Enrollment

Create:

```text
StudentSubjectEnrollment
------------------------
id
student_id
subject_offering_id
status
enrolled_at
created_at
updated_at
```

Recommended status:

```text
ENROLLED
DROPPED
COMPLETED
```

Unique:

```text
(student_id, subject_offering_id)
```

This lets the system answer:

> Which students are taking this specific DBMS offering?

without scanning the entire student database.

---

# 12. Assessment Group / Quiz Class

Create a new entity.

Use the name `AssessmentGroup` internally.

```text
AssessmentGroup
---------------
id
institution_id
name
type
cohort_id
created_by
is_active
created_at
updated_at
```

Types:

```text
COHORT
CUSTOM
```

Optional future type:

```text
TEMPORARY
```

The group should NOT duplicate student records.

---

# 13. Assessment Group Students

Create:

```text
AssessmentGroupStudent
----------------------
id
assessment_group_id
student_id
created_at
```

Unique:

```text
(assessment_group_id, student_id)
```

This is used for custom groups.

For `COHORT` groups, the base membership can be resolved dynamically from the cohort instead of copying every student.

---

# 14. Quiz / Exam Model Changes

Keep the existing `Exam` model and extend it.

Preferred fields:

```text
Exam
----
id
subject_offering_id
assessment_group_id
...
```

Do not make the exam directly depend only on `subject_id`.

The subject offering identifies the exact teaching context.

---

# 15. Exam Targets

For future flexibility, create:

```text
ExamTarget
----------
id
exam_id
assessment_group_id
created_at
```

This allows one exam to target more than one group.

Example:

```text
DBMS Midterm
    ├── CE-3-A
    └── CE-3-B
```

---

# 16. Exam Student Overrides

Create:

```text
ExamStudentOverride
-------------------
id
exam_id
student_id
action
created_at
created_by
```

Allowed actions:

```text
INCLUDE
EXCLUDE
```

Example:

```text
Base target:
CE-3-A = 63 students

Exclude:
Student 17

Final eligible:
62
```

This MUST NOT modify the central cohort.

---

# 17. Candidate Resolution Logic

The backend must have one reusable service:

```text
resolve_exam_eligible_students(exam_id)
```

Resolution:

```text
Exam
 ↓
Exam Targets
 ↓
Assessment Groups
 ↓
 ├── COHORT → students in current cohort
 └── CUSTOM → assessment_group_students
 ↓
Apply EXCLUDE overrides
 ↓
Apply INCLUDE overrides
 ↓
Validate student/subject enrollment where required
 ↓
Return unique eligible students
```

Do not implement this logic separately in multiple endpoints.

---

# 18. Quiz Creation Workflow

Redesign the existing Create Assessment flow into four stages:

```text
1. Details
2. Questions
3. Assign Class
4. Review & Publish
```

---

## Stage 1 — Details

Keep the current functionality:

- Quiz title
- Subject
- Duration
- Instructions
- Question settings

Subject selection should use a `SubjectOffering` where possible.

---

## Stage 2 — Questions

Keep the existing AI Question Studio workflow.

No need to redesign this part for the first implementation.

---

# 19. Stage 3 — Assign Class

Show:

```text
Who should take this quiz?

[ Existing Class ]

[ Create New Class ]

[ Select Individual Students ]
```

This must be a major part of the quiz creation flow.

---

# 20. Option A — Existing Class

Allow the teacher to browse/filter:

```text
Department
Program
Academic Session
Year
Semester
Division
```

Example:

```text
Computer Engineering
→ B.E.
→ 2026-27
→ 3rd Year
→ Semester 6
→ Division A

63 students
```

Display:

```text
Class Name
Student Count
Department
Program
Session
Year
Division
Subjects/Offerings
```

Button:

```text
[ Select Class ]
```

On selection:

```text
Quiz → ExamTarget → AssessmentGroup(COHORT) → Cohort
```

---

# 21. Option B — Create New Class

This should NOT create duplicate Student records.

Flow:

```text
Create New Class

Class Name
[ DBMS Remedial Group ]

Class Type
[ Custom ]

Students
[ Select from Student Directory ]
```

Student picker supports:

```text
Department
Program
Session
Year
Semester
Division
Subject
Search
```

Then:

```text
63 students selected

[ Create Class ]
```

This creates:

```text
AssessmentGroup(type=CUSTOM)
+
AssessmentGroupStudent rows
```

It does NOT create new Student rows.

---

# 22. Option C — Select Individual Students

Direct custom assignment:

```text
Student Directory

Search...
Department...
Program...
Session...
Year...
Division...

☑ Meet Dutta
☑ Rahul
☐ Amit
☑ Priya
```

Then:

```text
[ Create Assessment Group & Continue ]
```

The system may create an unnamed internal custom assessment group or explicitly name it:

```text
Quiz-specific group
```

Do not create duplicate students.

---

# 23. Review Step

Display:

```text
Quiz
DBMS Midterm

Subject
Database Management Systems

Class
Computer Engineering
B.E. Computer Engineering
2026-27
3rd Year
Division A

Eligible Students
63

Questions
30

Duration
60 minutes
```

Allow:

```text
[ Edit Quiz ]
[ Change Class ]
[ View Students ]
[ Publish ]
```

---

# 24. Student Repository UI

Replace the current flat student directory with:

```text
Student Repository

Departments
--------------------------------
Computer Engineering     1842
Mechanical Engineering   1124
Civil Engineering         980
IT                       1430
```

Selecting a department:

```text
B.E. Computer Engineering

2026-27
--------------------------------

1st Year
  A   65
  B   63

2nd Year
  A   61
  B   64

3rd Year
  A   63
  B   60
```

Selecting a cohort opens paginated students.

---

# 25. Student Table

Use server-side pagination.

Columns:

```text
Roll Number
Name
Email
Department
Program
Year
Division
Status
Actions
```

Controls:

```text
Search
Department
Program
Session
Year
Division
Subject
Status
```

Never load all students into the browser.

---

# 26. Backend Pagination

All student APIs must support:

```text
page
page_size
search
department_id
course_id
academic_session_id
cohort_id
subject_offering_id
status
```

Example:

```text
GET /api/v1/students?cohort_id=abc&page=1&page_size=50
```

Response:

```json
{
  "items": [],
  "page": 1,
  "page_size": 50,
  "total": 1842,
  "total_pages": 37
}
```

Default:

```text
page_size = 50
max_page_size = 200
```

---

# 27. Bulk Import

Update import format.

Preferred CSV:

```csv
full_name,email,roll_number,department_code,program_code,session,year,semester,division
```

The import service must:

1. Validate every row.
2. Resolve the target cohort.
3. Create/update the Student.
4. Create/update StudentCohortMembership.
5. Avoid duplicates.
6. Return row-level validation errors.
7. Provide a downloadable error report.

Never silently discard invalid rows.

---

# 28. Existing Data Migration

This is mandatory.

Before modifying production schema:

1. Create a full database backup.
2. Add the new tables/models.
3. Do not immediately delete old columns.
4. Write a migration script.
5. Map existing:
   - `Student.department_id`
   - `Student.division`
   - `Student.batch`
   - existing `AcademicYear`
6. Create corresponding:
   - AcademicSession
   - Cohort
   - StudentCohortMembership
7. Backfill SubjectOfferings where possible.
8. Backfill exam target groups.
9. Validate counts.
10. Only then remove deprecated fields.

Migration must be reversible until validation is complete.

---

# 29. Compatibility Strategy

For existing exams:

```text
Old Exam
  ↓
Subject
  ↓
Existing student relationship / assignment
```

must be migrated to:

```text
Exam
 ↓
AssessmentGroup
 ↓
ExamTarget
 ↓
Eligible Students
```

Existing:

- exam credentials
- attempts
- submissions
- grades
- proctoring records

must remain intact.

Do NOT change student primary keys during migration.

---

# 30. Permissions

Every new endpoint must enforce institution isolation.

Teacher access:

- Read only cohorts/departments/programs belonging to their institution.
- Create custom assessment groups only within their institution.
- Assign only students visible to them.
- Do not allow cross-institution student assignment.

Admin access:

- Full academic hierarchy management.

Student access:

- Read their own academic information.
- Read their own assigned assessments.
- Never read another student's records.

---

# 31. API Design

Implement/adjust endpoints approximately like:

## Academic hierarchy

```text
GET    /api/v1/departments
POST   /api/v1/departments

GET    /api/v1/courses
POST   /api/v1/courses

GET    /api/v1/academic-sessions
POST   /api/v1/academic-sessions

GET    /api/v1/cohorts
POST   /api/v1/cohorts

GET    /api/v1/cohorts/{id}
PUT    /api/v1/cohorts/{id}

GET    /api/v1/cohorts/{id}/students
```

## Students

```text
GET    /api/v1/students
POST   /api/v1/students

GET    /api/v1/students/{id}
PUT    /api/v1/students/{id}

GET    /api/v1/students/by-cohort/{cohort_id}

POST   /api/v1/students/import
GET    /api/v1/students/export
```

## Subject offerings

```text
GET    /api/v1/subject-offerings
POST   /api/v1/subject-offerings

GET    /api/v1/subject-offerings/{id}/students
```

## Assessment groups

```text
GET    /api/v1/assessment-groups
POST   /api/v1/assessment-groups

GET    /api/v1/assessment-groups/{id}
PUT    /api/v1/assessment-groups/{id}

GET    /api/v1/assessment-groups/{id}/students
POST   /api/v1/assessment-groups/{id}/students
DELETE /api/v1/assessment-groups/{id}/students/{student_id}
```

## Exams

```text
GET    /api/v1/exams/{id}/eligible-students
POST   /api/v1/exams/{id}/targets
POST   /api/v1/exams/{id}/student-overrides
```

---

# 32. Service Layer

Do not put all this logic directly inside FastAPI routers.

Create services such as:

```text
AcademicHierarchyService
StudentService
StudentImportService
CohortService
SubjectOfferingService
AssessmentGroupService
ExamTargetService
ExamEligibilityService
```

Important central service:

```text
ExamEligibilityService.resolve_students(exam_id)
```

---

# 33. Frontend Structure

Suggested components:

```text
components/
  academic/
    DepartmentSelector
    CourseSelector
    AcademicSessionSelector
    CohortSelector

  students/
    StudentDirectory
    StudentFilters
    StudentTable
    StudentPicker
    StudentImportDialog

  assessment-groups/
    AssessmentGroupSelector
    ExistingCohortSelector
    CreateAssessmentGroup
    CustomStudentSelector

  exams/
    ExamClassAssignment
    ExamEligibilityPreview
```

---

# 34. State Management

Do not store an entire institution's students in Zustand.

Use React Query/server state for:

- student search
- cohort students
- subject enrollment
- eligible students

Use Zustand only for local wizard state such as:

```text
quiz creation
selected questions
selected class/group
```

---

# 35. Important UX Requirement

At every selection stage show the number of affected students.

For example:

```text
CE-3-A
63 Students
```

and:

```text
This quiz will be assigned to 63 students.
```

Before publishing, require explicit confirmation.

---

# 36. Validation

The backend must validate:

1. Student belongs to the institution.
2. Cohort belongs to the institution.
3. Subject offering belongs to the cohort/course context.
4. Teacher has permission for the subject offering.
5. Assessment group belongs to the same institution.
6. Exam targets are valid.
7. Overrides reference valid students.
8. Duplicate group membership is rejected/idempotent.
9. A student is not assigned twice through multiple identical paths.
10. Exam eligibility resolves to unique students.

---

# 37. Testing Requirements

Add unit tests for:

```text
Cohort creation
Student creation
Student cohort membership
Student movement between cohorts
Subject offering
Subject enrollment
Custom assessment group
Cohort assessment group
Exam targeting
Exam student inclusion
Exam student exclusion
Duplicate prevention
Cross-institution access prevention
Pagination
Student import
Migration
```

Add integration tests for:

```text
Create cohort → add students → create quiz → assign cohort → publish → generate credentials
```

and:

```text
Create custom group → select students → create quiz → publish
```

---

# 38. Migration Verification

Before considering the migration complete, generate reports comparing:

```text
Old Student Count
New Student Count

Old Department Distribution
New Cohort Distribution

Existing Exam Count
Migrated Exam Count

Existing Credential Count
Migrated Credential Count

Existing Attempt Count
Migrated Attempt Count
```

All critical counts must match unless an explicit migration rule says otherwise.

---

# 39. Do Not Do These Things

Do NOT:

- create separate Student tables per department.
- create separate students per subject.
- copy students into every quiz.
- keep division/batch as uncontrolled strings as the source of truth.
- load all students into the frontend.
- delete old exam/attempt data during migration.
- let the frontend decide exam eligibility.
- bypass tenant/institution authorization.
- hard-code academic years or departments.
- embed eligibility logic in multiple routers/components.

---

# 40. Recommended Implementation Order

Execute in this order.

### Phase 1 — Database foundation

- Add AcademicSession.
- Add Cohort.
- Add StudentCohortMembership.
- Add SubjectOffering.
- Add StudentSubjectEnrollment.
- Add AssessmentGroup.
- Add AssessmentGroupStudent.
- Add ExamTarget.
- Add ExamStudentOverride.

Do not remove deprecated fields yet.

### Phase 2 — Migration

- Back up database.
- Migrate existing academic years.
- Create cohorts.
- Migrate students.
- Create memberships.
- Migrate existing exam targeting.
- Validate counts.

### Phase 3 — Backend

Implement services and APIs.

### Phase 4 — Student Repository

Replace flat directory with hierarchical navigation, filters, search and pagination.

### Phase 5 — Quiz Repository

Add:
- Existing Class
- Create New Class
- Individual Student Selection

### Phase 6 — Exam Eligibility

Implement one central resolution service.

### Phase 7 — Existing Quiz Compatibility

Ensure all existing exams, credentials, attempts, grades and analytics continue to work.

### Phase 8 — Testing

Run migration, unit tests, integration tests and authorization tests.

### Phase 9 — Cleanup

Only after successful validation:

- remove deprecated `Student.department_id`
- remove deprecated `Student.division`
- remove deprecated `Student.batch`
- remove obsolete exam assignment paths

---

# 41. Antigravity Execution Rules

When implementing this plan:

1. First inspect the existing codebase completely.
2. Do not overwrite existing functionality blindly.
3. Reuse existing models/endpoints/components where appropriate.
4. Implement backend/database changes before redesigning the frontend.
5. Make small, verifiable commits/changes.
6. Run migrations after each schema stage.
7. Run backend tests after database changes.
8. Run frontend build/type-check after UI changes.
9. Preserve existing authentication and RBAC.
10. Preserve existing exam/attempt/submission data.
11. Do not introduce duplicate parallel implementations.
12. Keep the current application usable during migration where practical.
13. Do not use mock data in production paths.
14. Use real database relationships.
15. Prefer server-side filtering and pagination.
16. Keep exam eligibility logic centralized.

---

# 42. Definition of Done

The implementation is complete when all of the following are true:

- A student exists only once in the institution.
- Students can be organized by department → program → session → year → division.
- Historical academic placement is preserved.
- Students can be enrolled in subject offerings.
- Teachers can browse a scalable Student Repository.
- Student searches are server-side and paginated.
- A teacher can create a quiz.
- During creation, the teacher can choose:
  - Existing Class
  - Create New Class
  - Individual Students
- Creating a class never duplicates students.
- Existing cohorts can be reused for multiple quizzes.
- Custom groups can be reused where appropriate.
- Exams can include/exclude individual students.
- Eligible students are resolved server-side.
- Existing credentials, attempts, submissions and grades remain valid.
- Institution isolation is enforced.
- All major flows have automated tests.
- Existing application functionality still works.

---

# 43. Final UX Example

A teacher creates:

```text
DBMS Midterm
```

During class assignment:

```text
Who should take this quiz?

○ Existing Class
● Create New Class
○ Individual Students
```

Teacher chooses:

```text
Create New Class

Name:
DBMS Unit 2 Remedial

Source:
Student Directory

Department:
Computer Engineering

Year:
3rd

Division:
A

Selected:
18 students
```

System creates:

```text
AssessmentGroup
    DBMS Unit 2 Remedial
          │
          └── 18 existing Student IDs
```

No student duplication occurs.

Another teacher later creates:

```text
Operating Systems Internal
```

and chooses:

```text
Existing Class
→ Computer Engineering
→ 2026-27
→ 3rd Year
→ Division A
```

The system resolves all 63 students automatically.

That is the target behavior.

---

# 44. Final Architectural Outcome

The resulting system should behave as:

```text
                 STUDENT DIRECTORY
                       │
         ┌─────────────┼─────────────┐
         │             │             │
      Cohorts       Subjects      History
         │             │
         │       Subject Offerings
         │             │
         └───────┬─────┘
                 │
          QUIZ CREATION
                 │
        ┌────────┼────────┐
        │        │        │
   Existing    New     Individual
    Class      Class     Students
        │        │        │
        └────────┼────────┘
                 │
        Assessment Group
                 │
              Quiz
                 │
          Eligibility Engine
                 │
              Students
                 │
             Attempts
                 │
            Submissions
                 │
             Analytics
```

This is the architecture to implement. Do not redesign the feature again unless a future requirement conflicts with one of these core principles.
