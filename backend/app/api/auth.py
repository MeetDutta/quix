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
