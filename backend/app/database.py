from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings
import os

raw_db_url = settings.DATABASE_URL or ""
db_url = raw_db_url.strip().strip('"').strip("'")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Ensure Supabase connections enforce SSL mode
if ("supabase.co" in db_url or "pooler.supabase.com" in db_url) and "sslmode" not in db_url:
    delimiter = "&" if "?" in db_url else "?"
    db_url = f"{db_url}{delimiter}sslmode=require"

def create_sqlite_engine(url="sqlite:///quiz.db"):
    eng = create_engine(url, connect_args={"check_same_thread": False, "timeout": 15}, pool_pre_ping=True)
    @event.listens_for(eng, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=10000")
            cursor.execute("PRAGMA foreign_keys=ON")
        except Exception:
            pass
        finally:
            cursor.close()
    return eng

def get_sqlite_path():
    for candidate_dir in ["/app/data", "./data", "."]:
        try:
            if not os.path.exists(candidate_dir):
                os.makedirs(candidate_dir, exist_ok=True)
            test_file = os.path.join(candidate_dir, ".perm_test")
            with open(test_file, "w") as f:
                f.write("ok")
            os.remove(test_file)
            db_file = os.path.abspath(os.path.join(candidate_dir, "quiz.db"))
            return f"sqlite:///{db_file}"
        except Exception:
            continue
    return "sqlite:///quiz.db"

if db_url.startswith("sqlite") or not db_url:
    sqlite_path = get_sqlite_path() if not db_url else db_url
    engine = create_sqlite_engine(sqlite_path)
else:
    try:
        test_engine = create_engine(
            db_url, 
            connect_args={"connect_timeout": 15},
            pool_size=10, 
            max_overflow=20, 
            pool_recycle=300, 
            pool_pre_ping=True
        )
        with test_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        host_preview = db_url.split("@")[-1].split("/")[0] if "@" in db_url else "remote"
        print(f"✅ [Database] Connected successfully to remote PostgreSQL ({host_preview})")
        engine = test_engine
    except Exception as e:
        print(f"[Database Notice] Remote PostgreSQL unreachable: {e}. Gracefully falling back to persistent SQLite at {get_sqlite_path()}.")
        engine = create_sqlite_engine(get_sqlite_path())

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


