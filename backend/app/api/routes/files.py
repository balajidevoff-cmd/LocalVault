from typing import Optional
from fastapi import APIRouter, Depends, File, Form, Header, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, upload_limiter
from app.db.database import get_db
from app.models.user import User
from app.schemas.file import FileListResponse, FileResponse, FileUpdateRequest
from app.services.file_service import file_service

router = APIRouter(prefix="/files", tags=["Files"])

@router.post("/upload", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    upload_limiter.check(request)
    # Convert empty string folder_id to None
    clean_folder_id = folder_id if folder_id and folder_id.strip() else None
    return await file_service.upload_file(
        db=db,
        user=current_user,
        upload_file=file,
        folder_id=clean_folder_id
    )

@router.get("", response_model=FileListResponse)
def list_files(
    folder_id: Optional[str] = None,
    all_files: bool = False,
    starred: Optional[bool] = None,
    deleted: bool = False,
    query: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_folder_id = folder_id if folder_id and folder_id.strip() else None
    return file_service.list_files(
        db=db,
        user=current_user,
        folder_id=clean_folder_id,
        all_files=all_files,
        starred=starred,
        deleted=deleted,
        search_query=query,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size
    )

@router.get("/{file_id}", response_model=FileResponse)
def get_file_metadata(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_item = file_service.get_file(db, current_user, file_id)
    return FileResponse.model_validate(file_item)

@router.get("/{file_id}/download")
def download_file(
    file_id: str,
    range: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_item = file_service.get_file(db, current_user, file_id)
    return file_service.build_file_stream_response(
        file_item=file_item,
        range_header=range,
        is_preview=False
    )

@router.get("/{file_id}/preview")
def preview_file(
    file_id: str,
    range: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_item = file_service.get_file(db, current_user, file_id)
    return file_service.build_file_stream_response(
        file_item=file_item,
        range_header=range,
        is_preview=True
    )

@router.patch("/{file_id}", response_model=FileResponse)
def update_file(
    file_id: str,
    req: FileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return file_service.update_file(db, current_user, file_id, req)

@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_service.purge_file(db, current_user, file_id)
    return None
