from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
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
    except Exception as e:
        print(f"Initial seed notice: {e}")
    finally:
        db.close()

from contextlib import asynccontextmanager
from sqlalchemy import text

def run_db_migrations():
    """Runs Alembic versioned migrations to ensure reproducible, version-controlled schema."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ini_path = os.path.join(base_dir, "alembic.ini")
    if os.path.exists(ini_path):
        try:
            from alembic.config import Config
            from alembic import command
            alembic_cfg = Config(ini_path)
            alembic_cfg.set_main_option("script_location", os.path.join(base_dir, "alembic"))
            command.upgrade(alembic_cfg, "head")
            print("✅ [Migrations] Alembic schema verified at head revision.")
        except Exception as e:
            print(f"⚠️ [Migrations] Alembic upgrade notice: {e}")
            if settings.ENVIRONMENT == "production":
                raise RuntimeError(f"FATAL: Database migration failed in production: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Automatically build database schema and seed initial demo data on startup."""
    try:
        run_db_migrations()
    except Exception as e:
        if settings.ENVIRONMENT == "production":
            raise RuntimeError(f"FATAL: Migration failed during production startup: {e}")
        print(f"Migration notice: {e}")

    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Schema sync notice: {e}")

    if settings.ENVIRONMENT != "production":
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

# Set up CORS middleware with safe credential handling
raw_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
frontend_origin = settings.FRONTEND_URL.rstrip("/")
if frontend_origin and frontend_origin not in raw_origins and "*" not in raw_origins:
    raw_origins.append(frontend_origin)

if "*" in raw_origins:
    # If wildcard is explicitly chosen, disable credentials to adhere to W3C CORS security specifications
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["*"]
    )
else:
    # Whitelisted explicit origins allow credentials securely
    app.add_middleware(
        CORSMiddleware,
        allow_origins=raw_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["*"]
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    logging.getLogger("uvicorn.error").error(f"Unhandled Exception on {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again later."},
        headers={
            "Access-Control-Allow-Origin": origin if origin else "*",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*",
        }
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
    redis_status = "disabled"
    try:
        from app.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        if settings.ENVIRONMENT == "production" and "sqlite" in str(engine.url):
            db_status = "unhealthy_sqlite_in_production"
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").error(f"Health check DB error: {e}")
        db_status = "unreachable"

    if settings.REDIS_URL:
        try:
            import redis
            r = redis.from_url(settings.REDIS_URL, socket_timeout=2)
            r.ping()
            redis_status = "ok"
        except Exception as e:
            redis_status = f"unreachable: {e}"

    is_healthy = (
        db_status == "ok" and 
        (not redis_status.startswith("unreachable") if settings.REDIS_URL else True)
    )

    return {
        "status": "healthy" if is_healthy else "unhealthy",
        "database": db_status,
        "redis": redis_status,
        "ai_engine": "enabled" if ai_status else "disabled"
    }

