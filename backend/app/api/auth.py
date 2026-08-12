from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from jose import jwt
from app.database import get_db
from app.models.user import User
from app.models.institution import Institution
from app.schemas.auth import UserLogin, UserCreate, Token, PasswordChange, UserProfile
from app.utils.security import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    create_refresh_token, 
    get_current_user
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserProfile)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    db_user = db.query(User).filter(User.email == user_in.email, User.is_deleted == False).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # If institution id is provided, check if valid
    if user_in.institution_id:
        inst = db.query(Institution).filter(Institution.id == user_in.institution_id, Institution.is_deleted == False).first()
        if not inst:
            raise HTTPException(status_code=400, detail="Institution not found")
            
    hashed_pwd = get_password_hash(user_in.password)
    user = User(
        email=user_in.email,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name,
        role=user_in.role,
        institution_id=user_in.institution_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

import secrets
import string
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, EmailStr
from app.services.email_service import email_service

class GoogleAuthPayload(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    google_id: Optional[str] = None
    token: Optional[str] = None

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.email == login_in.email) | (User.full_name.ilike(login_in.email.strip())),
        User.is_deleted == False
    ).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email, username, or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")
        
    if user.role == "student" and user.is_verified is False:
        raise HTTPException(
            status_code=403, 
            detail="Your student account is pending authorization. Please check your email to authorize your account before logging in."
        )
        
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name
    }

@router.get("/verify-student")
def verify_student(
    token: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Validates email verification token, marks student as authorized,
    generates a secure student portal password, and emails it to the student.
    """
    user = db.query(User).filter(User.verification_token == token, User.is_deleted == False).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
        
    # Generate human-friendly strong password (e.g. Quiz84#Vp)
    chars = string.ascii_letters + string.digits
    rand_part = ''.join(secrets.choice(chars) for _ in range(6))
    generated_pwd = f"Quiz{rand_part}!"
    
    user.is_verified = True
    user.verification_token = None
    user.hashed_password = get_password_hash(generated_pwd)
    db.commit()
    db.refresh(user)
    
    # Dispatch email with generated password
    background_tasks.add_task(
        email_service.send_student_credentials_email,
        student_name=user.full_name,
        email=user.email,
        password=generated_pwd
    )
    
    return {
        "status": "success",
        "message": "Account authorized successfully. Your student portal password has been generated and sent to your email.",
        "email": user.email,
        "full_name": user.full_name
    }

@router.post("/google-login", response_model=Token)
@router.post("/google-authorize", response_model=Token)
def google_auth(
    payload: GoogleAuthPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Authorizes or logs in a student using Google Workspace SSO.
    Marks student as verified and issues JWT session.
    """
    user = db.query(User).filter(User.email == payload.email, User.is_deleted == False).first()
    
    if not user:
        # Check if institution exists
        inst = db.query(Institution).filter(Institution.is_deleted == False).first()
        # Create student profile
        generated_pwd = f"GoogleAuth{secrets.token_hex(4)}!"
        user = User(
            email=payload.email,
            full_name=payload.name or payload.email.split("@")[0].title(),
            hashed_password=get_password_hash(generated_pwd),
            role="student",
            is_verified=True,
            auth_provider="google",
            google_id=payload.google_id,
            institution_id=inst.id if inst else None
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Also dispatch credentials email
        background_tasks.add_task(
            email_service.send_student_credentials_email,
            student_name=user.full_name,
            email=user.email,
            password=generated_pwd
        )
    else:
        # Student was pre-enrolled by teacher
        was_unverified = not user.is_verified
        user.is_verified = True
        user.google_id = payload.google_id or user.google_id
        user.auth_provider = "google"
        
        if was_unverified:
            # Generate initial portal password too
            generated_pwd = f"Quiz{secrets.token_hex(3)}!"
            user.hashed_password = get_password_hash(generated_pwd)
            background_tasks.add_task(
                email_service.send_student_credentials_email,
                student_name=user.full_name,
                email=user.email,
                password=generated_pwd
            )
            
        db.commit()
        db.refresh(user)
        
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name
    }

@router.post("/refresh", response_model=Token)
def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    access = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)
    
    return {
        "access_token": access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name
    }

@router.get("/me", response_model=UserProfile)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/change-password")
def change_password(pass_in: PasswordChange, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(pass_in.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    current_user.hashed_password = get_password_hash(pass_in.new_password)
    db.add(current_user)
    db.commit()
    return {"message": "Password changed successfully"}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

@router.post("/forgot-password")
def forgot_password(
    req: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Generates a secure temporary password and dispatches a password recovery email.
    """
    user = db.query(User).filter(User.email == req.email, User.is_deleted == False).first()
    if not user:
        # Return generic success to prevent email enumeration
        return {"message": "If an account with this email exists, a password reset link has been dispatched."}
        
    temp_pwd = f"Reset{secrets.token_hex(3)}!"
    user.hashed_password = get_password_hash(temp_pwd)
    db.commit()
    
    background_tasks.add_task(
        email_service.send_password_reset_email,
        user_name=user.full_name,
        email=user.email,
        new_password=temp_pwd
    )
    
    return {"message": "A temporary recovery password has been dispatched to your email address."}
