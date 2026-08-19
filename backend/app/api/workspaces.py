from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.workspace import WorkspaceResponse, WorkspaceMemberResponse
from app.utils.security import get_current_user
from app.services.workspace_service import get_current_workspace, bootstrap_personal_workspace

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

@router.get("/current", response_model=WorkspaceResponse)
def get_active_workspace(
    current_workspace: Workspace = Depends(get_current_workspace),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the current resolved workspace and the user's role."""
    member = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == current_workspace.id,
            WorkspaceMember.user_id == current_user.id
        )
        .first()
    )
    role = member.role if member else "OWNER"
    return {
        "id": current_workspace.id,
        "name": current_workspace.name,
        "slug": current_workspace.slug,
        "owner_id": current_workspace.owner_id,
        "role": role,
        "is_active": current_workspace.is_active,
        "created_at": current_workspace.created_at
    }

@router.get("/", response_model=List[WorkspaceResponse])
def list_user_workspaces(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all workspaces the authenticated user belongs to."""
    memberships = (
        db.query(WorkspaceMember)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .filter(
            WorkspaceMember.user_id == current_user.id,
            Workspace.is_deleted == False,
            Workspace.is_active == True
        )
        .all()
    )
    res = []
    for m in memberships:
        res.append({
            "id": m.workspace.id,
            "name": m.workspace.name,
            "slug": m.workspace.slug,
            "owner_id": m.workspace.owner_id,
            "role": m.role,
            "is_active": m.workspace.is_active,
            "created_at": m.workspace.created_at
        })
    return res
