from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.folder import FolderCreateRequest, FolderResponse, FolderUpdateRequest
from app.services.folder_service import folder_service

router = APIRouter(prefix="/folders", tags=["Folders"])

@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
def create_folder(
    req: FolderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return folder_service.create_folder(db, current_user, req)

@router.get("", response_model=List[FolderResponse])
def list_folders(
    parent_folder_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_parent = parent_folder_id if parent_folder_id and parent_folder_id.strip() else None
    return folder_service.list_folders(db, current_user, clean_parent)

@router.get("/{folder_id}", response_model=FolderResponse)
def get_folder(
    folder_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return folder_service.get_folder(db, current_user, folder_id)

@router.patch("/{folder_id}", response_model=FolderResponse)
def update_folder(
    folder_id: str,
    req: FolderUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return folder_service.update_folder(db, current_user, folder_id, req)

@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    folder_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    folder_service.delete_folder(db, current_user, folder_id)
    return None
