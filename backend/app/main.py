from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.config import settings
from app.database import engine, Base
from app.api import auth, students, kb, exams, attempts, reports, notifications, institutions

import app.models

# Automatically build database schema on startup for easy zero-setup local deployment!
try:
    Base.metadata.create_all(bind=engine)

    # Run manual schema updates (zero-setup migration)
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT subject_id FROM documents LIMIT 1"))
        except Exception:
            try:
                conn.execute(text("ALTER TABLE documents ADD COLUMN subject_id VARCHAR(36) REFERENCES subjects(id)"))
                conn.commit()
            except Exception:
                pass

        # Ensure user verification and Google Auth columns exist
        cols_to_add = [
            ("is_verified", "BOOLEAN DEFAULT 1"),
            ("verification_token", "VARCHAR(255)"),
            ("auth_provider", "VARCHAR(50) DEFAULT 'local'"),
            ("google_id", "VARCHAR(255)")
        ]
        for col_name, col_type in cols_to_add:
            try:
                conn.execute(text(f"SELECT {col_name} FROM users LIMIT 1"))
            except Exception:
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
                    
        # Ensure question bank columns exist
        q_cols_to_add = [
            ("is_bank_question", "BOOLEAN DEFAULT 0"),
            ("tags", "TEXT"),
            ("exam_id", "VARCHAR(36)")
        ]
        for col_name, col_type in q_cols_to_add:
            try:
                conn.execute(text(f"SELECT {col_name} FROM questions LIMIT 1"))
            except Exception:
                try:
                    conn.execute(text(f"ALTER TABLE questions ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
except Exception as startup_db_err:
    print(f"⚠️ Startup Database initialization notice: {startup_db_err}")

# Seed default initial data for local development
from app.database import SessionLocal
from app.models.user import User, Student
from app.models.institution import Institution, Department, Course, Subject
from app.utils.security import get_password_hash

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
        else:
            teacher.hashed_password = get_password_hash("securepassword")
            teacher.is_active = True
        db.commit()

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
                roll_number="CS-2024-001",
                department_id=dept.id,
                division="A",
                batch="2024-2028"
            )
            db.add(student_profile)
            db.commit()
        else:
            student_user.hashed_password = get_password_hash("securepassword")
            student_user.is_active = True
            db.commit()
    except Exception as e:
        print(f"Initial seed notice: {e}")
    finally:
        db.close()

seed_initial_data()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise-grade AI-powered Examination & Student Management System",
    version="1.0.0"
)

# Set up CORS middleware for dev & production client requests
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Register routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(students.router, prefix=settings.API_V1_STR)
app.include_router(kb.router, prefix=settings.API_V1_STR)
app.include_router(exams.router, prefix=settings.API_V1_STR)
app.include_router(attempts.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(institutions.router, prefix=settings.API_V1_STR)

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

