from pydantic import BaseModel, EmailStr
from typing import Optional

class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str  # "inst_admin", "teacher", "student"
    institution_id: Optional[str] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    role: str
    full_name: str

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class UserProfile(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    institution_id: Optional[str]

    class Config:
        from_attributes = True

class GoogleAuthPayload(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    google_id: Optional[str] = None
    token: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
