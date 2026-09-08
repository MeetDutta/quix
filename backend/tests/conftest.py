import pytest
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from app.models.institution import Institution, Department, Course, Subject
from app.models.user import User, Student
from app.utils.security import get_password_hash
from app.services.workspace_service import bootstrap_personal_workspace

from app.utils.rate_limiter import limiter

TEST_DB_URL = "sqlite:///./test_unified.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(autouse=True)
def setup_test_database():
    limiter.reset()
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    db = TestingSessionLocal()
    try:
        inst = Institution(name="EduQuizX Academy")
        db.add(inst)
        db.flush()

        dept = Department(name="Computer Science", institution_id=inst.id)
        db.add(dept)
        db.flush()

        course = Course(name="Undergraduate CS", department_id=dept.id)
        db.add(course)
        db.flush()

        subj1 = Subject(name="General Computer Science", id="cs_101", course_id=course.id)
        subj2 = Subject(name="Thermodynamics & Physics", id="PHYS-101", course_id=course.id)
        subj3 = Subject(name="General Knowledge", id="general_101", course_id=course.id)
        db.add_all([subj1, subj2, subj3])
        db.commit()

        # Seed default teacher
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
        bootstrap_personal_workspace(teacher, db)

        # Seed default student
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
    finally:
        db.close()

    yield

    app.dependency_overrides.clear()

@pytest.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as c:
        yield c

@pytest.fixture
async def teacher_auth(client):
    res = await client.post("/api/v1/auth/login", json={
        "email": "teacher@aegeus.edu",
        "password": "securepassword"
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def student_auth(client):
    res = await client.post("/api/v1/auth/login", json={
        "email": "student@aegeus.edu",
        "password": "securepassword"
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
