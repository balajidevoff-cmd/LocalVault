import io
import pytest

def get_auth_token(client, username="storageuser"):
    client.post("/api/v1/auth/register", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "Password123!"
    })
    res = client.post("/api/v1/auth/login", json={
        "username_or_email": username,
        "password": "Password123!"
    })
    return res.json()["access_token"]

def test_file_upload_and_download(client):
    token = get_auth_token(client, "testupload")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload test file
    content = b"Hello, LocalVault! Testing local storage engine integrity."
    files = {"file": ("test_document.txt", io.BytesIO(content), "text/plain")}
    res = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert res.status_code == 201
    file_data = res.json()
    file_id = file_data["id"]
    assert file_data["original_name"] == "test_document.txt"
    assert file_data["size_bytes"] == len(content)

    # Download full file
    dl_res = client.get(f"/api/v1/files/{file_id}/download", headers=headers)
    assert dl_res.status_code == 200
    assert dl_res.content == content
    assert dl_res.headers["content-disposition"].startswith("attachment;")

    # Preview file
    prev_res = client.get(f"/api/v1/files/{file_id}/preview", headers=headers)
    assert prev_res.status_code == 200
    assert prev_res.headers["content-disposition"].startswith("inline;")

    # Range request (e.g. bytes 0-4 -> "Hello")
    range_res = client.get(
        f"/api/v1/files/{file_id}/download",
        headers={**headers, "Range": "bytes=0-4"}
    )
    assert range_res.status_code == 206
    assert range_res.content == b"Hello"
    assert range_res.headers["content-range"] == f"bytes 0-4/{len(content)}"

def test_empty_file_upload(client):
    token = get_auth_token(client, "emptyuser")
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
    res = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["size_bytes"] == 0
    # Standard SHA-256 for empty file
    assert data["checksum_sha256"] == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

def test_file_operations_star_trash_rename_purge(client):
    token = get_auth_token(client, "opsuser")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload
    files = {"file": ("notes.txt", io.BytesIO(b"some notes"), "text/plain")}
    res = client.post("/api/v1/files/upload", files=files, headers=headers)
    file_id = res.json()["id"]

    # Star file
    star_res = client.patch(f"/api/v1/files/{file_id}", json={"is_starred": True}, headers=headers)
    assert star_res.status_code == 200
    assert star_res.json()["is_starred"] is True

    # Rename file
    ren_res = client.patch(f"/api/v1/files/{file_id}", json={"original_name": "renamed_notes.txt"}, headers=headers)
    assert ren_res.status_code == 200
    assert ren_res.json()["original_name"] == "renamed_notes.txt"

    # Soft-delete to trash
    trash_res = client.patch(f"/api/v1/files/{file_id}", json={"is_deleted": True}, headers=headers)
    assert trash_res.status_code == 200
    assert trash_res.json()["is_deleted"] is True

    # Check trash listing
    trash_list = client.get("/api/v1/files?deleted=true", headers=headers)
    assert trash_list.status_code == 200
    assert trash_list.json()["total"] == 1

    # Active listing should be 0
    active_list = client.get("/api/v1/files?deleted=false", headers=headers)
    assert active_list.status_code == 200
    assert active_list.json()["total"] == 0

    # Purge file permanently
    del_res = client.delete(f"/api/v1/files/{file_id}", headers=headers)
    assert del_res.status_code == 204

    # Now get file should 404
    assert client.get(f"/api/v1/files/{file_id}", headers=headers).status_code == 404

def test_storage_usage_analytics(client):
    token = get_auth_token(client, "storageanalytics")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload an image-like and document-like file
    files1 = {"file": ("doc.txt", io.BytesIO(b"1234567890"), "text/plain")}
    client.post("/api/v1/files/upload", files=files1, headers=headers)

    usage_res = client.get("/api/v1/storage/usage", headers=headers)
    assert usage_res.status_code == 200
    data = usage_res.json()
    assert data["user_used_bytes"] >= 10
    assert data["file_count"] >= 1
    assert "categories" in data
