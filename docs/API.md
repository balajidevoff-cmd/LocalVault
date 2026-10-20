# LocalVault REST API Reference

The LocalVault backend exposes a REST API with interactive OpenAPI documentation available at `http://localhost:8000/api/docs`.

**Base URL**: `/api/v1`

---

## 1. Health & Status

### `GET /api/v1/health`
Checks backend, database, and host disk health.
- **Auth**: None
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "version": "0.1.0",
    "environment": "development",
    "database": "connected",
    "disk_healthy": true,
    "first_run_setup_required": false
  }
  ```

---

## 2. Authentication

### `POST /api/v1/auth/register`
Creates a new account. If 0 users exist in the database, the user is automatically granted the `admin` role.
- **Body**:
  ```json
  {
    "username": "user123",
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response `201 Created`**: User metadata object.

### `POST /api/v1/auth/login`
Authenticates with Argon2id and sets HttpOnly session cookies.
- **Body**:
  ```json
  {
    "username_or_email": "user123",
    "password": "SecurePassword123!"
  }
  ```
- **Response `200 OK`**: Returns access token, refresh token, and user details. Sets `localvault_access_token` and `localvault_refresh_token` cookies.

### `POST /api/v1/auth/refresh`
Rotates the refresh token and issues a new access token.
- **Body** (optional if cookie present): `{"refresh_token": "..."}`
- **Response `200 OK`**: New access token and rotated refresh token.

### `POST /api/v1/auth/logout`
Revokes the refresh session and clears auth cookies.
- **Response `200 OK`**: `{"message": "Logged out successfully"}`

### `GET /api/v1/auth/me`
Returns current authenticated user profile.
- **Auth**: Bearer token or HttpOnly cookie.

### `POST /api/v1/auth/change-password`
Changes user password and invalidates all other active refresh sessions.
- **Body**: `{"current_password": "...", "new_password": "..."}`

---

## 3. Files

### `POST /api/v1/files/upload`
Uploads a file to the host SSD. Streams in chunks, enforces user quota and host SSD safety margins, and computes SHA-256 on the fly.
- **Auth**: Bearer token
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: Binary file payload
  - `folder_id` (optional): Destination folder UUID
- **Response `201 Created`**:
  ```json
  {
    "id": "e9b28f82-3df7-4467-bc8a-d9df656a5c32",
    "owner_id": "...",
    "folder_id": null,
    "original_name": "document.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 1048576,
    "checksum_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    "is_starred": false,
    "is_deleted": false,
    "created_at": "2026-10-20T08:00:00Z"
  }
  ```

### `GET /api/v1/files`
Lists files for the authenticated user.
- **Query Parameters**:
  - `folder_id` (string, optional): Filter by folder
  - `all_files` (bool, optional): List all files recursively
  - `starred` (bool, optional): Filter starred files
  - `deleted` (bool, optional): `true` for trash, `false` for active
  - `query` (string, optional): Search by filename
  - `sort_by` (string): `created_at`, `original_name`, `size_bytes`
  - `sort_order` (string): `asc` or `desc`
  - `page` (int, default 1)
  - `page_size` (int, default 50)

### `GET /api/v1/files/{file_id}/download`
Streams file binary with `Content-Disposition: attachment`.
- **Headers**: Supports `Range: bytes=start-end` (returns `206 Partial Content`).

### `GET /api/v1/files/{file_id}/preview`
Streams file binary with `Content-Disposition: inline` and `X-Content-Type-Options: nosniff`.

### `PATCH /api/v1/files/{file_id}`
Renames, moves, stars, or trashes a file.
- **Body**:
  ```json
  {
    "original_name": "new_name.txt",
    "folder_id": "optional_new_parent_id",
    "is_starred": true,
    "is_deleted": false
  }
  ```

### `DELETE /api/v1/files/{file_id}`
Permanently deletes the file record and physical file from the host SSD.
- **Response `204 No Content`**

---

## 4. Folders

### `POST /api/v1/folders`
Creates a folder.
- **Body**: `{"name": "Projects", "parent_folder_id": null}`
- **Response `201 Created`**

### `GET /api/v1/folders`
Lists folders in a given parent directory.
- **Query Parameter**: `parent_folder_id`

### `GET /api/v1/folders/{folder_id}`
Returns folder metadata and breadcrumb hierarchy.

### `PATCH /api/v1/folders/{folder_id}`
Renames or moves a folder.

### `DELETE /api/v1/folders/{folder_id}`
Recursively deletes folder, its subfolders, and physically purges all contained files from disk.

---

## 5. Storage & Search

### `GET /api/v1/storage/usage`
Returns user quota usage, file counts, physical host disk capacity, and MIME category distributions.

### `GET /api/v1/storage/status`
Returns host disk writable verification and database connectivity status.

### `GET /api/v1/search?q={query}`
Searches matching files and folders simultaneously.

---

## 6. Public Sharing

### `POST /api/v1/shares`
Generates a public share link.
- **Body**:
  ```json
  {
    "file_id": "...",
    "permission": "view", // "view" or "download"
    "password": "OptionalPassword",
    "expires_in_hours": 24
  }
  ```
- **Response `201 Created`**: Returns single-view `raw_token` and `share_url`.

### `GET /api/v1/public/shares/{token}`
Public endpoint (no auth required) returning file metadata and whether password is required.

### `GET /api/v1/public/shares/{token}/download`
Public endpoint (no auth required) to stream shared file.
- **Query Parameter**: `password` (if protected)
- **Header**: `Range` (supported)
