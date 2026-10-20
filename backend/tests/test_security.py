import io
import pytest
from tests.test_files_and_storage import get_auth_token

def test_cross_user_isolation(client):
    # User A registers and uploads a private file
    token_a = get_auth_token(client, "usera")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    upload_res = client.post(
        "/api/v1/files/upload",
        files={"file": ("usera_private.txt", io.BytesIO(b"Confidential data for User A"), "text/plain")},
        headers=headers_a
    )
    assert upload_res.status_code == 201
    file_id_a = upload_res.json()["id"]

    # User B registers
    token_b = get_auth_token(client, "userb")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B attempts to get User A's file metadata
    get_res = client.get(f"/api/v1/files/{file_id_a}", headers=headers_b)
    assert get_res.status_code == 404  # Explicitly forbidden / not found for unauthorized user

    # User B attempts to download User A's file directly
    dl_res = client.get(f"/api/v1/files/{file_id_a}/download", headers=headers_b)
    assert dl_res.status_code == 404

    # User B attempts to delete User A's file
    del_res = client.delete(f"/api/v1/files/{file_id_a}", headers=headers_b)
    assert del_res.status_code == 404

def test_path_traversal_prevention(client):
    token = get_auth_token(client, "traversal_tester")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload with dangerous path traversal filename
    malicious_name = "../../../../../windows/system32/cmd.exe"
    upload_res = client.post(
        "/api/v1/files/upload",
        files={"file": (malicious_name, io.BytesIO(b"malicious content"), "application/octet-stream")},
        headers=headers
    )
    assert upload_res.status_code == 201
    data = upload_res.json()
    
    # Filename must have been sanitized: no directory separators or parent directory references
    assert "/" not in data["original_name"]
    assert ".." not in data["original_name"]

def test_share_links_and_revocation(client):
    token = get_auth_token(client, "shareowner")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload file to share
    upload_res = client.post(
        "/api/v1/files/upload",
        files={"file": ("shared_memo.txt", io.BytesIO(b"Public announcement text"), "text/plain")},
        headers=headers
    )
    file_id = upload_res.json()["id"]

    # Create public share link with password
    share_res = client.post(
        "/api/v1/shares",
        json={"file_id": file_id, "permission": "download", "password": "SecretSharePassword"},
        headers=headers
    )
    assert share_res.status_code == 201
    share_data = share_res.json()
    raw_token = share_data["raw_token"]
    share_id = share_data["id"]

    # Public metadata retrieval (no password needed for metadata)
    meta_res = client.get(f"/api/v1/public/shares/{raw_token}")
    assert meta_res.status_code == 200
    assert meta_res.json()["requires_password"] is True

    # Download without password should fail 401
    fail_dl = client.get(f"/api/v1/public/shares/{raw_token}/download")
    assert fail_dl.status_code == 401

    # Download with wrong password should fail 401
    fail_pwd = client.get(f"/api/v1/public/shares/{raw_token}/download?password=WrongPassword")
    assert fail_pwd.status_code == 401

    # Download with correct password should succeed 200
    succ_dl = client.get(f"/api/v1/public/shares/{raw_token}/download?password=SecretSharePassword")
    assert succ_dl.status_code == 200
    assert succ_dl.content == b"Public announcement text"

    # Revoke share link
    revoke_res = client.delete(f"/api/v1/shares/{share_id}", headers=headers)
    assert revoke_res.status_code == 204

    # Download after revocation should now return 404
    post_revoke = client.get(f"/api/v1/public/shares/{raw_token}/download?password=SecretSharePassword")
    assert post_revoke.status_code == 404
