import os
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BASE_DIR)

class Settings(BaseSettings):
    PROJECT_NAME: str = "EduQuizX - AI Dynamic Examination & Student Management System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "super-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database (workspace root quiz.db)
    DATABASE_URL: str = f"sqlite:///{os.path.join(ROOT_DIR, 'quiz.db')}"
    
    # AI Engine
    GEMINI_API_KEY: str = ""
    
    # Google OAuth / Identity Services
    GOOGLE_CLIENT_ID: str = ""
    
    # Uploads
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    KB_UPLOADS_DIR: str = os.path.join(BASE_DIR, "uploads", "kb_documents")
    
    # SMTP Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "aegeusexams@gmail.com"
    SMTP_PASSWORD: str = "bpofgsqqgmbectsb"
    EMAILS_FROM_EMAIL: str = "aegeusexams@gmail.com"
    EMAILS_FROM_NAME: str = "EduQuizX Examination System"
    
    # Allowed CORS origins (comma-separated string or wildcard)
    ALLOWED_ORIGINS: str = "*"
    
    # Frontend Deployment URL for emails & links
    FRONTEND_URL: str = "http://localhost:3000"
    
    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="ignore",
        env_file=[os.path.join(BASE_DIR, "..", ".env"), ".env"]
    )

settings = Settings()

# Create upload directories if not exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.KB_UPLOADS_DIR, exist_ok=True)

