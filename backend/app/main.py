from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.config import settings
from app.database import engine, Base
from app.api import auth, students, kb, exams, attempts, reports, notifications, institutions, academic, assessment_groups, workspaces, student_directories

import app.models

# Seed default initial data for local development
from app.database import SessionLocal
from app.models.user import User, Student
from app.models.institution import Institution, Department, Course, Subject
from app.models.workspace import Workspace, WorkspaceMember
from app.models.student_directory import StudentDirectory, DirectoryStudent
from app.models.exam import Exam
from app.models.document import Document
from app.utils.security import get_password_hash
from app.services.workspace_service import bootstrap_personal_workspace

def seed_initial_data():
    db = SessionLocal()
    try:
        # Seed Institution
        inst = db.query(Institution).first()
        if not inst:
            inst = Institution(name="EduQuizX Academy")
            db.add(inst)
            db.commit()
            db.refresh(inst)

        # Seed Department
        dept = db.query(Department).first()
        if not dept:
            dept = Department(name="Computer Science & Engineering", institution_id=inst.id)
            db.add(dept)
            db.commit()
            db.refresh(dept)

        # Seed Course
        course = db.query(Course).first()
        if not course:
            course = Course(name="B.Tech Computer Science", department_id=dept.id)
            db.add(course)
            db.commit()
            db.refresh(course)

        # Seed Subject
        subj = db.query(Subject).first()
        if not subj:
            subj = Subject(name="Database Systems & Data Structures", course_id=course.id)
            db.add(subj)
            db.commit()
            db.refresh(subj)

        # Seed Teacher User
        teacher = db.query(User).filter(User.email == "teacher@aegeus.edu").first()
        if not teacher:
            teacher = User(
                email="teacher@aegeus.edu",
                hashed_password=get_password_hash("securepassword"),
                full_name="Dr. Sarah Jenkins",
                role="teacher",
                institution_id=inst.id,
                is_active=True
            )
            db.add(teacher)
            db.commit()
            db.refresh(teacher)
        else:
            teacher.hashed_password = get_password_hash("securepassword")
            teacher.is_active = True
            db.commit()

        # Bootstrap Personal Workspace for Teacher
        teacher_ws = bootstrap_personal_workspace(teacher, db)

        # Backfill existing exams & documents to teacher workspace if unassigned
        db.query(Exam).filter(Exam.workspace_id == None).update(
            {"workspace_id": teacher_ws.id, "created_by": teacher.id},
            synchronize_session=False
        )
        db.query(Document).filter(Document.workspace_id == None).update(
            {"workspace_id": teacher_ws.id},
            synchronize_session=False
        )
        db.commit()

        # Seed Default Student Directory for Teacher
        sample_dir = db.query(StudentDirectory).filter(
            StudentDirectory.workspace_id == teacher_ws.id,
            StudentDirectory.is_deleted == False
        ).first()
        if not sample_dir:
            sample_dir = StudentDirectory(
                workspace_id=teacher_ws.id,
                name="CE 3rd Year - Morning Batch",
                description="Computer Engineering Class of 2026",
                created_by=teacher.id,
                is_active=True
            )
            db.add(sample_dir)
            db.flush()

            # Add sample directory students
            sample_students = [
                ("Alex Johnson", "student@aegeus.edu", "CS-2026-001", "+1-555-0101"),
                ("Priya Patel", "priya.patel@aegeus.edu", "CS-2026-002", "+1-555-0102"),
                ("Rahul Sharma", "rahul.sharma@aegeus.edu", "CS-2026-003", "+1-555-0103"),
                ("David Chen", "david.chen@aegeus.edu", "CS-2026-004", "+1-555-0104"),
                ("Emma Watson", "emma.watson@aegeus.edu", "CS-2026-005", "+1-555-0105"),
            ]
            for name, email, roll, phone in sample_students:
                s_obj = DirectoryStudent(
                    directory_id=sample_dir.id,
                    name=name,
                    email=email,
                    roll_number=roll,
                    phone=phone,
                    status="active"
                )
                db.add(s_obj)
            db.commit()

        # Seed Academic Session & Cohort (Legacy Compatibility)
        from app.models.academic import AcademicSession, Cohort, StudentCohortMembership
        session = db.query(AcademicSession).first()
        if not session:
            session = AcademicSession(name="2026-27", institution_id=inst.id, is_active=True)
            db.add(session)
            db.commit()
            db.refresh(session)

        cohort = db.query(Cohort).first()
        if not cohort:
            cohort = Cohort(
                name="CE-3-A",
                course_id=course.id,
                academic_session_id=session.id,
                year_number=3,
                semester_number=6,
                division="A",
                is_active=True
            )
            db.add(cohort)
            db.commit()
            db.refresh(cohort)

        # Seed Student User & Profile
        student_user = db.query(User).filter(User.email == "student@aegeus.edu").first()
        if not student_user:
            student_user = User(
                email="student@aegeus.edu",
                hashed_password=get_password_hash("securepassword"),
                full_name="Alex Johnson",
                role="student",
                institution_id=inst.id,
                is_active=True
            )
            db.add(student_user)
            db.commit()
            db.refresh(student_user)

            student_profile = Student(
                user_id=student_user.id,
                institution_id=inst.id,
                roll_number="CS-2026-001",
                department_id=dept.id,
                division="A",
                batch="2026-2027",
                status="active"
            )
            db.add(student_profile)
            db.commit()
            db.refresh(student_profile)

            membership = StudentCohortMembership(
                student_id=student_profile.id,
                cohort_id=cohort.id,
                is_current=True
            )
            db.add(membership)
            db.commit()
        else:
            student_user.hashed_password = get_password_hash("securepassword")
            student_user.is_active = True
            db.commit()
    except Exception as e:
        print(f"Initial seed notice: {e}")
    finally:
        db.close()

from contextlib import asynccontextmanager
from sqlalchemy import text

def run_db_migrations():
    """Applies non-destructive schema migrations for new SaaS workspace and student directory fields."""
    with engine.connect() as conn:
        statements = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;",
            "ALTER TABLE exams ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(36);",
            "ALTER TABLE exams ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);",
            "ALTER TABLE exams ADD COLUMN IF NOT EXISTS student_directory_id VARCHAR(36);",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(36);",
        ]
        for stmt in statements:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Automatically build database schema and seed initial demo data on startup."""
    try:
        run_db_migrations()
    except Exception as e:
        print(f"Migration notice: {e}")

    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Schema sync notice: {e}")

    try:
        seed_initial_data()
    except Exception as e:
        print(f"Seed notice: {e}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise-grade AI-powered Examination & Student Management System",
    version="1.0.0",
    redirect_slashes=False,
    lifespan=lifespan
)


# Set up CORS middleware for dev & production client requests
allowed_origins_list = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
if "*" in allowed_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"]
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"]
    )

# Register routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(workspaces.router, prefix=settings.API_V1_STR)
app.include_router(student_directories.router, prefix=settings.API_V1_STR)
app.include_router(students.router, prefix=settings.API_V1_STR)
app.include_router(kb.router, prefix=settings.API_V1_STR)
app.include_router(exams.router, prefix=settings.API_V1_STR)
app.include_router(attempts.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(institutions.router, prefix=settings.API_V1_STR)
app.include_router(academic.router, prefix=settings.API_V1_STR)
app.include_router(assessment_groups.router, prefix=settings.API_V1_STR)

# Serve static playground files
static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "api_v1_base": settings.API_V1_STR
    }

@app.get("/health")
def health_check():
    ai_status = bool(settings.GEMINI_API_KEY)
    db_status = "ok"
    try:
        from app.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy" if db_status == "ok" else "unhealthy",
        "database": db_status,
        "ai_engine": "enabled" if ai_status else "mocked"
    }

