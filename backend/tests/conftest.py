import os
import tempfile
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.database import Base, get_db
from app.main import app
from app.services.storage_service import StorageEngine

@pytest.fixture(scope="session")
def temp_storage():
    with tempfile.TemporaryDirectory() as storage_temp:
        yield Path(storage_temp)

@pytest.fixture(scope="function")
def test_db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()

@pytest.fixture(scope="function")
def client(test_db_session, temp_storage, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")
    test_storage = StorageEngine(base_path=temp_storage)
    monkeypatch.setattr("app.services.storage_service.storage_engine", test_storage)
    monkeypatch.setattr("app.services.file_service.storage_engine", test_storage)
    monkeypatch.setattr("app.services.folder_service.storage_engine", test_storage)
    monkeypatch.setattr("app.api.routes.admin.storage_engine", test_storage)
    monkeypatch.setattr("app.main.storage_engine", test_storage)

    def override_get_db():
        try:
            yield test_db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
