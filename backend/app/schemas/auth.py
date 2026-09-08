from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional

class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str  # "teacher", "student"
    institution_id: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        if len(v.strip()) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    role: str
    full_name: str
    workspace_id: Optional[str] = None
    workspace_name: Optional[str] = None

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password_length(cls, v: str) -> str:
        if len(v.strip()) < 8:
            raise ValueError("New password must be at least 8 characters long")
        return v

class UserProfile(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    institution_id: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class GoogleAuthPayload(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    google_id: Optional[str] = None
    token: Optional[str] = None
    role: Optional[str] = "teacher"

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        if len(v.strip()) < 8:
            raise ValueError("New password must be at least 8 characters long")
        return v
