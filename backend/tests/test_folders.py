import io
import pytest
from tests.test_files_and_storage import get_auth_token

def test_folder_hierarchy_and_breadcrumbs(client):
    token = get_auth_token(client, "foldertester")
    headers = {"Authorization": f"Bearer {token}"}

    # Create root folder "Documents"
    f1_res = client.post("/api/v1/folders", json={"name": "Documents"}, headers=headers)
    assert f1_res.status_code == 201
    f1_id = f1_res.json()["id"]

    # Create subfolder "Finances" inside "Documents"
    f2_res = client.post("/api/v1/folders", json={"name": "Finances", "parent_folder_id": f1_id}, headers=headers)
    assert f2_res.status_code == 201
    f2_id = f2_res.json()["id"]

    # Verify breadcrumbs of subfolder
    get_f2 = client.get(f"/api/v1/folders/{f2_id}", headers=headers)
    assert get_f2.status_code == 200
    crumbs = get_f2.json()["breadcrumbs"]
    crumb_names = [c["name"] for c in crumbs]
    assert crumb_names == ["Home", "Documents", "Finances"]

    # Upload file into subfolder
    file_res = client.post(
        "/api/v1/files/upload",
        files={"file": ("tax_2026.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")},
        data={"folder_id": f2_id},
        headers=headers
    )
    assert file_res.status_code == 201
    assert file_res.json()["folder_id"] == f2_id

    # List files inside subfolder
    list_res = client.get(f"/api/v1/files?folder_id={f2_id}", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 1

    # Delete parent folder - should cascade delete subfolders and files safely
    del_res = client.delete(f"/api/v1/folders/{f1_id}", headers=headers)
    assert del_res.status_code == 204

    # Subfolder and files should no longer be accessible
    assert client.get(f"/api/v1/folders/{f2_id}", headers=headers).status_code == 404
