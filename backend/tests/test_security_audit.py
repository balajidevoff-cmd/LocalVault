import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.security import sanitize_filename
from app.models.folder import Folder
from app.models.session import RefreshSession
from app.models.share import ShareLink
from app.models.user import User
from app.services.folder_service import folder_service
from app.services.storage_service import storage_engine
from fastapi import HTTPException

def test_folder_cycle_prevention(client: TestClient, test_db_session):
    """Verifies that moving a folder into one of its own descendants is blocked to prevent cycles."""
    # Register & login
    reg_resp = client.post("/api/v1/auth/register", json={
        "username": "cycleuser",
        "email": "cycle@example.com",
        "password": "SecurePassword123!"
    })
    token = client.post("/api/v1/auth/login", json={
        "username_or_email": "cycleuser",
        "password": "SecurePassword123!"
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Parent Folder A
    f_a = client.post("/api/v1/folders", json={"name": "FolderA"}, headers=headers).json()
    # Create Child Folder B inside Folder A
    f_b = client.post("/api/v1/folders", json={"name": "FolderB", "parent_folder_id": f_a["id"]}, headers=headers).json()
    # Create Grandchild Folder C inside Folder B
    f_c = client.post("/api/v1/folders", json={"name": "FolderC", "parent_folder_id": f_b["id"]}, headers=headers).json()

    # Attempt to move Folder A into its grandchild Folder C (must fail with 400)
    move_resp = client.patch(f"/api/v1/folders/{f_a['id']}", json={"parent_folder_id": f_c["id"]}, headers=headers)
    assert move_resp.status_code == 400
    assert "cycle detected" in move_resp.json()["detail"].lower()

    # Attempt to move Folder A into its direct child Folder B (must fail with 400)
    move_resp2 = client.patch(f"/api/v1/folders/{f_a['id']}", json={"parent_folder_id": f_b["id"]}, headers=headers)
    assert move_resp2.status_code == 400
    assert "cycle detected" in move_resp2.json()["detail"].lower()

def test_breadcrumb_cycle_guard(test_db_session):
    """Verifies that breadcrumb traversal terminates cleanly even if a database cycle exists."""
    user = User(username="breaduser", email="bread@example.com", password_hash="hash")
    test_db_session.add(user)
    test_db_session.commit()

    # Create f1 with no parent, and f2 with parent f1
    f1 = Folder(id="f1", owner_id=user.id, name="F1", parent_folder_id=None)
    test_db_session.add(f1)
    test_db_session.commit()

    f2 = Folder(id="f2", owner_id=user.id, name="F2", parent_folder_id=f1.id)
    test_db_session.add(f2)
    test_db_session.commit()

    # Now make f1's parent f2 directly via DB update
    f1.parent_folder_id = f2.id
    test_db_session.commit()

    # Traversal should not loop infinitely
    crumbs = folder_service.get_breadcrumbs(test_db_session, f1)
    assert len(crumbs) > 0
    assert crumbs[0].name == "Home"

def test_windows_reserved_device_names():
    """Verifies that Windows reserved device names are neutralized."""
    assert sanitize_filename("CON.txt") == "_CON.txt"
    assert sanitize_filename("prn.pdf") == "_prn.pdf"
    assert sanitize_filename("aux") == "_aux"
    assert sanitize_filename("nul.tar.gz") == "_nul.tar.gz"
    assert sanitize_filename("com1.png") == "_com1.png"
    assert sanitize_filename("LPT3.log") == "_LPT3.log"
    # Normal files should remain untouched
    assert sanitize_filename("contract.pdf") == "contract.pdf"
    assert sanitize_filename("my_document.docx") == "my_document.docx"

def test_storage_key_security():
    """Verifies that storage keys reject path traversal and invalid characters."""
    with pytest.raises(HTTPException) as exc:
        storage_engine._resolve_physical_path("../traversal")
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc2:
        storage_engine._resolve_physical_path("") # Empty key
    assert exc2.value.status_code == 400

    with pytest.raises(HTTPException) as exc3:
        storage_engine._resolve_physical_path("user/../../escaped")
    assert exc3.value.status_code == 400

def test_refresh_token_reuse_containment(client: TestClient, test_db_session):
    """Verifies that presenting a previously-revoked refresh token triggers session breach containment."""
    # Register & Login
    client.post("/api/v1/auth/register", json={
        "username": "reusetest",
        "email": "reuse@example.com",
        "password": "SecurePassword123!"
    })
    login_resp = client.post("/api/v1/auth/login", json={
        "username_or_email": "reusetest",
        "password": "SecurePassword123!"
    }).json()

    initial_refresh = login_resp["refresh_token"]

    # Legitimate refresh (rotates the token)
    refresh_resp1 = client.post("/api/v1/auth/refresh", json={"refresh_token": initial_refresh})
    assert refresh_resp1.status_code == 200
    rotated_refresh = refresh_resp1.json()["refresh_token"]

    # Re-use attack: presenting initial_refresh again
    reuse_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": initial_refresh})
    assert reuse_resp.status_code == 401
    assert "Token reuse detected" in reuse_resp.json()["detail"]

    # Now the rotated refresh token should ALSO have been invalidated by the containment breach response
    invalidated_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": rotated_refresh})
    assert invalidated_resp.status_code == 401

def test_admin_self_lockout_prevention(client: TestClient, test_db_session):
    """Verifies that an administrator cannot accidentally or maliciously deactivate or demote themselves."""
    # First user is automatically admin
    reg_resp = client.post("/api/v1/auth/register", json={
        "username": "mainadmin",
        "email": "admin@example.com",
        "password": "SecurePassword123!"
    }).json()
    admin_id = reg_resp["id"]

    token = client.post("/api/v1/auth/login", json={
        "username_or_email": "mainadmin",
        "password": "SecurePassword123!"
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to deactivate self
    deact_resp = client.patch(f"/api/v1/users/{admin_id}", json={"is_active": False}, headers=headers)
    assert deact_resp.status_code == 400
    assert "cannot deactivate their own account" in deact_resp.json()["detail"]

    # Attempt to demote self
    demote_resp = client.patch(f"/api/v1/users/{admin_id}", json={"role": "user"}, headers=headers)
    assert demote_resp.status_code == 400
    assert "cannot revoke their own administrator role" in demote_resp.json()["detail"]

def test_production_secret_key_rejection():
    """Verifies that deploying in production with default development secrets fails fast."""
    with pytest.raises(ValidationError) as exc:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="localvault_super_secret_development_key_change_in_production_1234567890"
        )
    assert "SECRET_KEY must be overridden" in str(exc.value)
