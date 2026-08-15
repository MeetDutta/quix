import os
from pydantic_settings import BaseSettings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Settings(BaseSettings):
    PROJECT_NAME: str = "EduQuizX - AI Dynamic Examination & Student Management System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "super-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = f"sqlite:///{os.path.join(BASE_DIR, 'quiz.db')}"
    
    # AI Engine
    GEMINI_API_KEY: str = ""
    
    # Uploads
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    KB_UPLOADS_DIR: str = os.path.join(BASE_DIR, "uploads", "kb_documents")
    
    # SMTP Email Configuration
    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = ""
    EMAILS_FROM_NAME: str = "EduQuizX Examination System"
    
    # Allowed CORS origins (comma-separated string or wildcard)
    ALLOWED_ORIGINS: str = "*"
    
    # Frontend Deployment URL for emails & links
    FRONTEND_URL: str = "http://localhost:3000"
    
    class Config:
        case_sensitive = True
        extra = "ignore"
        env_file = [os.path.join(BASE_DIR, "..", ".env"), ".env"]

settings = Settings()

# Create upload directories if not exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.KB_UPLOADS_DIR, exist_ok=True)
