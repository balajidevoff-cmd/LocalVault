from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.logging_config import logger
from app.core.security import sanitize_filename
from app.models.file import FileItem
from app.models.folder import Folder
from app.models.user import User
from app.schemas.folder import BreadcrumbItem, FolderCreateRequest, FolderResponse, FolderUpdateRequest
from app.services.storage_service import storage_engine

class FolderService:
    @staticmethod
    def get_breadcrumbs(db: Session, folder: Optional[Folder]) -> List[BreadcrumbItem]:
        """Traverses parent folders up to root to produce breadcrumbs."""
        breadcrumbs: List[BreadcrumbItem] = []
        curr = folder
        seen = set()
        max_depth = 50
        while curr and len(breadcrumbs) < max_depth:
            if curr.id in seen:
                logger.warning(f"Cycle detected in folder hierarchy for folder {curr.id}")
                break
            seen.add(curr.id)
            breadcrumbs.insert(0, BreadcrumbItem(id=curr.id, name=curr.name))
            if curr.parent_folder_id:
                curr = db.query(Folder).filter(Folder.id == curr.parent_folder_id).first()
            else:
                break
        breadcrumbs.insert(0, BreadcrumbItem(id=None, name="Home"))
        return breadcrumbs

    @staticmethod
    def create_folder(db: Session, user: User, req: FolderCreateRequest) -> FolderResponse:
        clean_name = sanitize_filename(req.name)
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid folder name"
            )

        parent_id = req.parent_folder_id
        if parent_id:
            parent = db.query(Folder).filter(
                Folder.id == parent_id,
                Folder.owner_id == user.id
            ).first()
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Parent folder not found"
                )

        # Check for duplicate sibling name
        duplicate = db.query(Folder).filter(
            Folder.owner_id == user.id,
            Folder.parent_folder_id == parent_id,
            Folder.name == clean_name
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A folder named '{clean_name}' already exists in this directory"
            )

        new_folder = Folder(
            owner_id=user.id,
            parent_folder_id=parent_id,
            name=clean_name
        )
        db.add(new_folder)
        db.commit()
        db.refresh(new_folder)

        breadcrumbs = FolderService.get_breadcrumbs(db, new_folder)
        res = FolderResponse.model_validate(new_folder)
        res.breadcrumbs = breadcrumbs
        return res

    @staticmethod
    def get_folder(db: Session, user: User, folder_id: str) -> FolderResponse:
        folder = db.query(Folder).filter(
            Folder.id == folder_id,
            Folder.owner_id == user.id
        ).first()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )
        res = FolderResponse.model_validate(folder)
        res.breadcrumbs = FolderService.get_breadcrumbs(db, folder)
        return res

    @staticmethod
    def list_folders(db: Session, user: User, parent_folder_id: Optional[str] = None) -> List[FolderResponse]:
        query = db.query(Folder).filter(Folder.owner_id == user.id)
        if parent_folder_id:
            query = query.filter(Folder.parent_folder_id == parent_folder_id)
        else:
            query = query.filter(Folder.parent_folder_id == None)
        
        folders = query.order_by(Folder.name.asc()).all()
        return [FolderResponse.model_validate(f) for f in folders]

    @staticmethod
    def update_folder(db: Session, user: User, folder_id: str, req: FolderUpdateRequest) -> FolderResponse:
        folder = db.query(Folder).filter(
            Folder.id == folder_id,
            Folder.owner_id == user.id
        ).first()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

        if req.name is not None:
            clean_name = sanitize_filename(req.name)
            if not clean_name:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid folder name")
            # Duplicate check
            duplicate = db.query(Folder).filter(
                Folder.owner_id == user.id,
                Folder.parent_folder_id == folder.parent_folder_id,
                Folder.name == clean_name,
                Folder.id != folder.id
            ).first()
            if duplicate:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder with this name already exists")
            folder.name = clean_name

        if req.parent_folder_id is not None:
            if req.parent_folder_id == folder.id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot move folder into itself")
            if req.parent_folder_id != "":
                target_parent = db.query(Folder).filter(
                    Folder.id == req.parent_folder_id,
                    Folder.owner_id == user.id
                ).first()
                if not target_parent:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target parent folder not found")
                
                # Check for cycle: verify target_parent is not a descendant of folder
                cursor = target_parent
                visited = set()
                while cursor:
                    if cursor.id == folder.id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Cannot move folder into one of its subfolders (cycle detected)"
                        )
                    if cursor.id in visited:
                        break
                    visited.add(cursor.id)
                    if cursor.parent_folder_id:
                        cursor = db.query(Folder).filter(Folder.id == cursor.parent_folder_id).first()
                    else:
                        break

                folder.parent_folder_id = req.parent_folder_id
            else:
                folder.parent_folder_id = None

        folder.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(folder)

        res = FolderResponse.model_validate(folder)
        res.breadcrumbs = FolderService.get_breadcrumbs(db, folder)
        return res

    @staticmethod
    def delete_folder(db: Session, user: User, folder_id: str) -> None:
        folder = db.query(Folder).filter(
            Folder.id == folder_id,
            Folder.owner_id == user.id
        ).first()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

        # Collect all files recursively in this folder and subfolders to physically delete them
        all_folder_ids = [folder.id]
        def collect_children(f_id: str):
            subs = db.query(Folder.id).filter(Folder.parent_folder_id == f_id).all()
            for (sub_id,) in subs:
                all_folder_ids.append(sub_id)
                collect_children(sub_id)

        collect_children(folder.id)

        # Query all files belonging to these folders
        files_to_delete = db.query(FileItem).filter(
            FileItem.folder_id.in_(all_folder_ids),
            FileItem.owner_id == user.id
        ).all()

        for f in files_to_delete:
            storage_engine.delete_physical_file(f.internal_storage_key)
            db.delete(f)

        # Delete folders in leaf-to-root order to respect foreign keys cleanly
        for fid in reversed(all_folder_ids):
            f_obj = db.query(Folder).filter(Folder.id == fid).first()
            if f_obj:
                db.delete(f_obj)

        db.commit()
        logger.info(f"Folder {folder_id} and {len(files_to_delete)} contained files deleted.")

folder_service = FolderService()
