import re
import uuid
from typing import Optional, List
from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.utils.security import get_current_user

def generate_workspace_slug(name: str, db: Session) -> str:
    base = re.sub(r'[^a-zA-Z0-9]+', '-', name.lower()).strip('-') or "workspace"
    slug = base
    counter = 1
    while db.query(Workspace).filter(Workspace.slug == slug, Workspace.is_deleted == False).first():
        slug = f"{base}-{counter}"
        counter += 1
    return slug

def bootstrap_personal_workspace(user: User, db: Session) -> Workspace:
    """
    Finds or transactionally creates a personal workspace for the given user,
    with the user as OWNER.
    """
    # Check if user already owns a workspace
    existing = (
        db.query(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .filter(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.role == "OWNER",
            Workspace.is_deleted == False,
            Workspace.is_active == True
        )
        .first()
    )
    if existing:
        return existing

    ws_name = f"{user.full_name}'s Workspace" if user.full_name else "Personal Workspace"
    slug = generate_workspace_slug(ws_name, db)

    workspace = Workspace(
        name=ws_name,
        slug=slug,
        owner_id=user.id,
        is_active=True
    )
    db.add(workspace)
    db.flush()

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role="OWNER"
    )
    db.add(member)
    db.commit()
    db.refresh(workspace)
    return workspace

def get_current_workspace(
    current_user: User = Depends(get_current_user),
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-Id"),
    db: Session = Depends(get_db)
) -> Workspace:
    """
    Resolves and authorizes the active workspace for the authenticated request.
    If X-Workspace-Id is supplied, verifies user is a member.
    Otherwise, defaults to the user's primary/owned workspace.
    """
    if x_workspace_id:
        membership = (
            db.query(WorkspaceMember)
            .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
            .filter(
                WorkspaceMember.workspace_id == x_workspace_id,
                WorkspaceMember.user_id == current_user.id,
                Workspace.is_deleted == False,
                Workspace.is_active == True
            )
            .first()
        )
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not a member of the requested workspace"
            )
        return membership.workspace

    # Default to owned or first joined workspace
    member = (
        db.query(WorkspaceMember)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .filter(
            WorkspaceMember.user_id == current_user.id,
            Workspace.is_deleted == False,
            Workspace.is_active == True
        )
        .order_by(WorkspaceMember.created_at.asc())
        .first()
    )
    if member:
        return member.workspace

    # If no workspace exists yet (e.g. legacy user or first login), bootstrap one
    return bootstrap_personal_workspace(current_user, db)
