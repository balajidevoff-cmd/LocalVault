from pathlib import Path
from typing import List, Optional, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine base repository directory
# backend/app/core/config.py -> parents[2] is backend/, parents[3] is project root
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "LocalVault"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # API Prefix
    API_V1_PREFIX: str = "/api/v1"

    # Storage Path Configuration
    # Defaults to data/storage in the project root, resolves Windows & POSIX paths
    LOCALVAULT_STORAGE_PATH: Path = PROJECT_ROOT / "data" / "storage"
    
    # SQLite Database Configuration
    LOCALVAULT_DB_PATH: Path = PROJECT_ROOT / "data" / "db" / "localvault.db"

    # Storage Quotas & Limits
    # 250 GB default quota
    LOCALVAULT_STORAGE_QUOTA_BYTES: int = 250 * 1024 * 1024 * 1024
    # 10 GB max upload file size
    LOCALVAULT_MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024 * 1024
    # Chunk size for streaming uploads/downloads (4 MB for high-throughput)
    STREAM_CHUNK_SIZE_BYTES: int = 4 * 1024 * 1024

    # Security & Tokens
    # Default secret for development, MUST be overridden in production
    SECRET_KEY: str = "localvault_super_secret_development_key_change_in_production_1234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # User registration policy
    ALLOW_REGISTRATION: bool = True
    FIRST_RUN_SETUP_COMPLETED: bool = False

    # CORS Configuration
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081", # Expo dev
        "http://127.0.0.1:8081",
        "exp://localhost:8081",
    ]
    CORS_ORIGIN_REGEX: Optional[str] = r"^https:\/\/.*\.vercel\.app$"

    @field_validator("LOCALVAULT_STORAGE_PATH", mode="before")
    @classmethod
    def validate_storage_path(cls, v: Union[str, Path]) -> Path:
        p = Path(v).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @field_validator("LOCALVAULT_DB_PATH", mode="before")
    @classmethod
    def validate_db_path(cls, v: Union[str, Path]) -> Path:
        p = Path(v).resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            if "change_in_production" in self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be overridden with a secure key of at least 32 characters in production.")
        return self

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # SQLite with absolute Windows / POSIX path
        db_path_str = str(self.LOCALVAULT_DB_PATH.as_posix())
        return f"sqlite:///{db_path_str}"

settings = Settings()
