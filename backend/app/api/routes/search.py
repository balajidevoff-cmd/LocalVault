from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.file import FileItem
from app.models.folder import Folder
from app.models.user import User
from app.schemas.file import FileResponse
from app.schemas.folder import FolderResponse

router = APIRouter(prefix="/search", tags=["Search"])

class SearchResultResponse(BaseModel):
    query: str
    files: List[FileResponse]
    folders: List[FolderResponse]

@router.get("", response_model=SearchResultResponse)
def search_items(
    q: str = Query(..., min_length=1, max_length=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_q = f"%{q.strip()}%"
    
    # Query files
    files = db.query(FileItem).filter(
        FileItem.owner_id == current_user.id,
        FileItem.is_deleted == False,
        FileItem.original_name.ilike(clean_q)
    ).order_by(FileItem.updated_at.desc()).limit(50).all()

    # Query folders
    folders = db.query(Folder).filter(
        Folder.owner_id == current_user.id,
        Folder.name.ilike(clean_q)
    ).order_by(Folder.updated_at.desc()).limit(20).all()

    return SearchResultResponse(
        query=q,
        files=[FileResponse.model_validate(f) for f in files],
        folders=[FolderResponse.model_validate(f) for f in folders]
    )
