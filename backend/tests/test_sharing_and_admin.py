import io
from datetime import datetime, timedelta, timezone
import pytest
from app.models.user import User
from app.models.file import FileItem
from app.models.share import ShareLink
from app.models.audit import AdminAuditLog
from app.core.security import hash_password

def register_user(client, username, email, password="Password123!"):
    res = client.post("/api/v1/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    assert res.status_code == 201, res.text
    login_res = client.post("/api/v1/auth/login", json={
        "username_or_email": username,
        "password": password
    })
    assert login_res.status_code == 200, login_res.text
    return login_res.json()["access_token"]

def upload_file(client, token, filename="report.pdf", content=b"PDF Content 12345"):
    res = client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": (filename, io.BytesIO(content), "application/pdf")}
    )
    assert res.status_code == 201, res.text
    return res.json()

def test_public_share_flow(client, test_db_session):
    token_a = register_user(client, "alice", "alice@example.com")
    f = upload_file(client, token_a, "alice_notes.txt", b"Secret Notes Alice")

    # 1. Alice creates public share link
    share_res = client.post(
        "/api/v1/shares",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "file_id": f["id"],
            "permission": "download",
            "expires_in_hours": 24
        }
    )
    assert share_res.status_code == 201
    share_data = share_res.json()
    raw_token = share_data["raw_token"]
    assert raw_token is not None

    # Verify response schema does not expose internal storage keys or filesystem paths
    assert "internal_storage_key" not in share_data
    assert "storage_path" not in share_data

    # 2. Public access to metadata without auth
    meta_res = client.get(f"/api/v1/public/shares/{raw_token}")
    assert meta_res.status_code == 200
    meta = meta_res.json()
    assert meta["filename"] == "alice_notes.txt"
    assert meta["permission"] == "download"
    assert meta["requires_password"] is False
    assert "internal_storage_key" not in meta

    # 3. Public download without auth
    dl_res = client.get(f"/api/v1/public/shares/{raw_token}/download")
    assert dl_res.status_code == 200
    assert dl_res.content == b"Secret Notes Alice"

def test_public_share_password_protection(client, test_db_session):
    token_a = register_user(client, "bob", "bob@example.com")
    f = upload_file(client, token_a, "financials.csv", b"Revenue,Expense\n100,20")

    # Share with password
    share_res = client.post(
        "/api/v1/shares",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "file_id": f["id"],
            "permission": "download",
            "password": "ProtectMe123!"
        }
    )
    assert share_res.status_code == 201
    raw_token = share_res.json()["raw_token"]

    # Metadata shows requires_password
    meta_res = client.get(f"/api/v1/public/shares/{raw_token}")
    assert meta_res.status_code == 200
    assert meta_res.json()["requires_password"] is True

    # Download without password -> 401
    dl_no_pwd = client.get(f"/api/v1/public/shares/{raw_token}/download")
    assert dl_no_pwd.status_code == 401

    # Download with wrong password -> 401
    dl_wrong_pwd = client.get(f"/api/v1/public/shares/{raw_token}/download?password=WrongPassword")
    assert dl_wrong_pwd.status_code == 401

    # Download with correct password -> 200
    dl_ok = client.get(f"/api/v1/public/shares/{raw_token}/download?password=ProtectMe123!")
    assert dl_ok.status_code == 200
    assert dl_ok.content == b"Revenue,Expense\n100,20"

def test_expired_and_revoked_shares(client, test_db_session):
    token_a = register_user(client, "carol", "carol@example.com")
    f = upload_file(client, token_a, "temp_data.txt", b"Temporary Data")

    share_res = client.post(
        "/api/v1/shares",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"file_id": f["id"], "permission": "view"}
    )
    raw_token = share_res.json()["raw_token"]
    share_id = share_res.json()["id"]

    # Revoke share
    rev_res = client.delete(
        f"/api/v1/shares/{share_id}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert rev_res.status_code == 204

    # Subsequent access fails with 404
    get_res = client.get(f"/api/v1/public/shares/{raw_token}")
    assert get_res.status_code == 404

    # Test expired link
    share_exp = client.post(
        "/api/v1/shares",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"file_id": f["id"], "permission": "view"}
    )
    raw_token_exp = share_exp.json()["raw_token"]

    # Manually expire in DB
    db_share = test_db_session.query(ShareLink).filter(ShareLink.id == share_exp.json()["id"]).first()
    db_share.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    test_db_session.commit()

    exp_res = client.get(f"/api/v1/public/shares/{raw_token_exp}")
    assert exp_res.status_code == 410

def test_cross_user_file_sharing(client, test_db_session):
    token_owner = register_user(client, "dave_owner", "dave@example.com")
    token_recipient = register_user(client, "eva_recipient", "eva@example.com")
    token_stranger = register_user(client, "frank_stranger", "frank@example.com")

    f = upload_file(client, token_owner, "project_blueprint.pdf", b"Blueprints XYZ")

    # 1. Dave shares with Eva
    share_res = client.post(
        "/api/v1/shares",
        headers={"Authorization": f"Bearer {token_owner}"},
        json={
            "file_id": f["id"],
            "share_with_username": "eva_recipient",
            "permission": "download"
        }
    )
    assert share_res.status_code == 201
    assert share_res.json()["shared_with_username"] == "eva_recipient"

    # 2. Eva checks 'shared-with-me'
    shared_res = client.get(
        "/api/v1/shares/shared-with-me",
        headers={"Authorization": f"Bearer {token_recipient}"}
    )
    assert shared_res.status_code == 200
    shared_items = shared_res.json()
    assert len(shared_items) == 1
    assert shared_items[0]["file_name"] == "project_blueprint.pdf"
    assert shared_items[0]["owner_username"] == "dave_owner"

    # 3. Eva can preview and download
    preview_res = client.get(
        f"/api/v1/files/{f['id']}/preview",
        headers={"Authorization": f"Bearer {token_recipient}"}
    )
    assert preview_res.status_code == 200
    assert preview_res.content == b"Blueprints XYZ"

    download_res = client.get(
        f"/api/v1/files/{f['id']}/download",
        headers={"Authorization": f"Bearer {token_recipient}"}
    )
    assert download_res.status_code == 200
    assert download_res.content == b"Blueprints XYZ"

    # 4. Eva cannot modify the owner's file
    modify_res = client.patch(
        f"/api/v1/files/{f['id']}",
        headers={"Authorization": f"Bearer {token_recipient}"},
        json={"original_name": "tampered_name.pdf"}
    )
    assert modify_res.status_code == 403

    # 5. Eva cannot delete the owner's file
    del_res = client.delete(
        f"/api/v1/files/{f['id']}",
        headers={"Authorization": f"Bearer {token_recipient}"}
    )
    assert del_res.status_code == 403

    # 6. Frank (unauthorized user) is denied access
    frank_dl = client.get(
        f"/api/v1/files/{f['id']}/download",
        headers={"Authorization": f"Bearer {token_stranger}"}
    )
    assert frank_dl.status_code in (403, 404)

def test_admin_capabilities_and_authorization(client, test_db_session):
    # Register admin user first (first-run user automatically gets role='admin')
    admin_token = register_user(client, "super_admin", "admin@example.com")

    # Register ordinary user second (gets role='user')
    user_token = register_user(client, "regular_user", "regular@example.com")
    f = upload_file(client, user_token, "user_tax_doc.pdf", b"Tax Return 2026")

    # 1. Non-admin is strictly rejected from admin endpoints with 403
    forbidden_files = client.get(
        "/api/v1/admin/files",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert forbidden_files.status_code == 403

    forbidden_delete = client.delete(
        f"/api/v1/admin/files/{f['id']}?confirmed=true",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert forbidden_delete.status_code == 403

    forbidden_audit = client.get(
        "/api/v1/admin/audit-logs",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert forbidden_audit.status_code == 403

    # 2. Authenticated Admin can list users and files
    admin_files = client.get(
        "/api/v1/admin/files",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_files.status_code == 200
    data = admin_files.json()
    assert data["total"] >= 1
    found = any(item["original_name"] == "user_tax_doc.pdf" for item in data["items"])
    assert found is True

    # 3. Admin deletes file requiring explicit confirmation
    no_confirm_del = client.delete(
        f"/api/v1/admin/files/{f['id']}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert no_confirm_del.status_code == 400
    assert "confirmation" in no_confirm_del.text.lower()

    # 4. Admin soft-deletes file
    soft_del = client.delete(
        f"/api/v1/admin/files/{f['id']}?confirmed=true&permanent=false",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert soft_del.status_code == 200
    assert soft_del.json()["action"] == "SOFT_DELETE"

    # Verify audit log was recorded
    audit_res = client.get(
        "/api/v1/admin/audit-logs",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) >= 1
    assert logs[0]["action"] == "SOFT_DELETE"
    assert logs[0]["admin_username"] == "super_admin"
    assert logs[0]["result"] == "SUCCESS"

    # 5. Admin restores the file
    restore_res = client.post(
        f"/api/v1/admin/files/{f['id']}/restore",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert restore_res.status_code == 200

    # 6. Admin permanently deletes file
    perm_del = client.delete(
        f"/api/v1/admin/files/{f['id']}?confirmed=true&permanent=true",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert perm_del.status_code == 200
    assert perm_del.json()["action"] == "PERMANENT_DELETE"

    # Verify permanent deletion removed DB record
    assert test_db_session.query(FileItem).filter(FileItem.id == f["id"]).first() is None
