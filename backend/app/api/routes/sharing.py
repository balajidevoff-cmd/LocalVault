from typing import List, Optional
from fastapi import APIRouter, Depends, Header, Query, Request, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, share_limiter
from app.db.database import get_db
from app.models.user import User
from app.schemas.share import PublicShareMetadata, ShareCreateRequest, ShareResponse
from app.services.sharing_service import sharing_service

router = APIRouter(tags=["Sharing"])

@router.post("/shares", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
def create_share(
    req: ShareCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return sharing_service.create_share(db, current_user, req)

@router.get("/shares", response_model=List[ShareResponse])
def list_shares(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return sharing_service.list_user_shares(db, current_user)

@router.delete("/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_share(
    share_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sharing_service.revoke_share(db, current_user, share_id)
    return None

# Public unauthenticated share endpoints
@router.get("/public/shares/{token}", response_model=PublicShareMetadata)
def get_public_share_metadata(
    token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    share_limiter.check(request)
    return sharing_service.get_public_metadata(db, token)

@router.get("/public/shares/{token}/download")
def download_public_share(
    token: str,
    request: Request,
    password: Optional[str] = Query(None),
    x_share_password: Optional[str] = Header(None),
    range: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    share_limiter.check(request)
    pwd = password or x_share_password
    return sharing_service.download_public_share(
        db=db,
        raw_token=token,
        password=pwd,
        range_header=range
    )
