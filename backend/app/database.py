from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

raw_db_url = settings.DATABASE_URL or ""
db_url = raw_db_url.strip().strip('"').strip("'")

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
else:
    engine = create_engine(
        db_url, 
        pool_size=5, 
        max_overflow=10, 
        pool_recycle=300, 
        pool_pre_ping=True
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
