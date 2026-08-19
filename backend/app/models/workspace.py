from sqlalchemy import Column, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.models.base import TimeStampedModel

class Workspace(TimeStampedModel):
    __tablename__ = "workspaces"
    
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)

    owner = relationship("User", back_populates="owned_workspaces", foreign_keys=[owner_id])
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="workspace", cascade="all, delete-orphan")
    directories = relationship("StudentDirectory", back_populates="workspace", cascade="all, delete-orphan")

class WorkspaceMember(TimeStampedModel):
    __tablename__ = "workspace_members"
    
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(50), default="OWNER", nullable=False)  # "OWNER", "ADMIN", "TEACHER", "VIEWER"

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="workspace_memberships")
