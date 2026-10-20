import pytest

def test_health_check(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["ok", "degraded"]
    assert data["first_run_setup_required"] is True

def test_register_and_first_user_admin(client):
    # First user should become admin automatically
    res = client.post("/api/v1/auth/register", json={
        "username": "adminuser",
        "email": "admin@localvault.internal",
        "password": "SuperSecretPassword123!"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == "adminuser"
    assert data["role"] == "admin"

    # Second user should become regular user
    res2 = client.post("/api/v1/auth/register", json={
        "username": "regularuser",
        "email": "regular@localvault.internal",
        "password": "RegularPassword123!"
    })
    assert res2.status_code == 201
    assert res2.json()["role"] == "user"

def test_login_and_token_refresh(client):
    # Register user
    client.post("/api/v1/auth/register", json={
        "username": "testlogin",
        "email": "login@localvault.internal",
        "password": "Password12345!"
    })

    # Successful login
    login_res = client.post("/api/v1/auth/login", json={
        "username_or_email": "testlogin",
        "password": "Password12345!"
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

    # Verify cookies are set
    cookies = login_res.cookies
    assert "localvault_access_token" in cookies
    assert "localvault_refresh_token" in cookies

    # Test authenticated /me
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "testlogin"

    # Test token refresh
    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 200
    new_data = refresh_res.json()
    assert "access_token" in new_data
    assert new_data["refresh_token"] != refresh_token  # rotated

    # Old refresh token should now fail
    failed_refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert failed_refresh.status_code == 401

def test_invalid_login(client):
    res = client.post("/api/v1/auth/login", json={
        "username_or_email": "nonexistent",
        "password": "wrongpassword"
    })
    assert res.status_code == 401
    assert "detail" in res.json()

def test_change_password(client):
    client.post("/api/v1/auth/register", json={
        "username": "pwdchangeuser",
        "email": "pwd@localvault.internal",
        "password": "OriginalPassword123!"
    })
    login_res = client.post("/api/v1/auth/login", json={
        "username_or_email": "pwdchangeuser",
        "password": "OriginalPassword123!"
    })
    token = login_res.json()["access_token"]

    # Change password
    chg_res = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "OriginalPassword123!", "new_password": "NewUpdatedPassword456!"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert chg_res.status_code == 200

    # Old password fails
    fail_res = client.post("/api/v1/auth/login", json={
        "username_or_email": "pwdchangeuser",
        "password": "OriginalPassword123!"
    })
    assert fail_res.status_code == 401

    # New password succeeds
    succ_res = client.post("/api/v1/auth/login", json={
        "username_or_email": "pwdchangeuser",
        "password": "NewUpdatedPassword456!"
    })
    assert succ_res.status_code == 200
