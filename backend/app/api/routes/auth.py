from typing import Optional
from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, login_limiter
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    is_prod = (settings.ENVIRONMENT == "production")
    response.set_cookie(
        key="localvault_access_token",
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )
    response.set_cookie(
        key="localvault_refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/"
    )

def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="localvault_access_token", path="/")
    response.delete_cookie(key="localvault_refresh_token", path="/")

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    login_limiter.check(request)
    user = auth_service.register_user(db, req)
    return UserResponse.model_validate(user)

@router.post("/login", response_model=TokenResponse)
def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    login_limiter.check(request)
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    
    user, access_token, refresh_token = auth_service.authenticate_user(
        db=db,
        login_req=req,
        user_agent=user_agent,
        ip_address=ip_address
    )
    
    set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user)
    )

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    localvault_refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    raw_refresh = None
    if body and body.refresh_token:
        raw_refresh = body.refresh_token
    elif localvault_refresh_token:
        raw_refresh = localvault_refresh_token

    if not raw_refresh:
        return Response(status_code=status.HTTP_401_UNAUTHORIZED, content="Missing refresh token")

    user, new_access_token, new_refresh_token = auth_service.refresh_access_token(db, raw_refresh)
    set_auth_cookies(response, new_access_token, new_refresh_token)

    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user)
    )

@router.post("/logout")
def logout(
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    localvault_refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    token_to_revoke = (body.refresh_token if body else None) or localvault_refresh_token
    if token_to_revoke:
        auth_service.revoke_session(db, token_to_revoke)
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    auth_service.change_password(db, current_user, req)
    return {"message": "Password changed successfully"}
