import socket
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

db_url = settings.DATABASE_URL

# Automatically handle IPv6-only Supabase direct connection failure on Render (IPv4 environments)
if "db.vshyjdmtpxqbjptzrqzp.supabase.co" in db_url:
    try:
        # Check if direct hostname has an IPv4 address
        addrs = socket.getaddrinfo("db.vshyjdmtpxqbjptzrqzp.supabase.co", 5432, socket.AF_INET)
        if not addrs:
            raise socket.gaierror("No IPv4 address")
    except (socket.gaierror, Exception):
        # Fallback to Supabase IPv4 Pooler URL
        db_url = db_url.replace(
            "postgres:Meetdutta%40001@db.vshyjdmtpxqbjptzrqzp.supabase.co:5432",
            "postgres.vshyjdmtpxqbjptzrqzp:Meetdutta%40001@aws-0-ap-south-1.pooler.supabase.com:6543"
        )
        if "sslmode" not in db_url:
            db_url += "?sslmode=require"

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
