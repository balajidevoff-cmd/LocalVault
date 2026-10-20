# LocalVault Implementation Checklist

## Phase 1: Environment & Project Structure
- [x] Inspect local tools: Python 3.11, Node.js v24, npm 11, git
- [x] Setup project repository structure (`apps/web`, `apps/android`, `backend`, `data`, `scripts`, `docs`)
- [x] Configure `.gitignore` and `.editorconfig`
- [x] Setup root and sub-project documentation scaffolding

## Phase 2: Configuration, Database, Migrations & Storage Engine
- [x] Create Python `pyproject.toml` and `requirements.txt` for backend
- [x] Implement `backend/app/core/config.py` (Pydantic Settings, Windows paths, quota, JWT secrets)
- [x] Implement `backend/app/core/logging_config.py` (Structured logging without leaking secrets/data)
- [x] Implement SQLAlchemy 2.x models in `backend/app/models/`:
  - `User` (id, username, email, password_hash, role, is_active, timestamps)
  - `Folder` (id, owner_id, parent_folder_id, name, timestamps)
  - `File` (id, owner_id, folder_id, original_name, internal_storage_key, mime_type, size_bytes, checksum_sha256, is_starred, is_deleted, timestamps)
  - `RefreshSession` (id, user_id, token_hash, expires_at, revoked_at, created_at)
  - `ShareLink` (id, file_id, owner_id, token_hash, permission, password_hash, expires_at, revoked_at, access_count, created_at)
- [x] Implement SQLite database setup with foreign key enforcement (`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;`)
- [x] Implement Alembic migration configuration and initial migration (`0001_initial_schema.py`)
- [x] Implement `backend/app/services/storage_service.py`:
  - Configurable storage root (`LOCALVAULT_STORAGE_PATH`)
  - Path traversal & escape prevention
  - Safe file key allocation (UUID/hash based sub-sharded paths)
  - Atomic write placement (`.tmp` to final)
  - Chunked streaming upload/download
  - SHA-256 computation on the fly
  - Free disk space check (`shutil.disk_usage`)
  - Quota verification (configurable 250 GB default, disk bounded)
  - Cleanup of orphaned temporary files
  - MIME type sniffing via `filetype` with fallback

## Phase 3: Authentication and Authorization
- [x] Implement Argon2id password hashing & verification in `backend/app/core/security.py`
- [x] Implement JWT token issuance & verification (short-lived access tokens, refresh tokens with secure hashing)
- [x] Implement Auth schemas in `backend/app/schemas/auth.py`
- [x] Implement `backend/app/services/auth_service.py` (register, login, refresh, session revocation, change password)
- [x] Implement first-run admin initialization command/endpoint
- [x] Implement Auth dependencies and middleware (`get_current_user`, `get_current_active_user`, `require_admin`, rate limiting)
- [x] Implement Auth routes in `backend/app/api/routes/auth.py` & `users.py`

## Phase 4: File and Folder APIs
- [x] Implement Schemas for Files, Folders, Shares, and Storage
- [x] Implement `backend/app/services/folder_service.py` (create, get, list, rename, delete recursive, breadcrumbs)
- [x] Implement `backend/app/services/file_service.py` (upload, download stream, preview stream, metadata, rename, delete, trash, restore, star)
- [x] Implement `backend/app/services/sharing_service.py` (create public/private share link, verify token/password, stream download)
- [x] Implement API Routes:
  - `POST /api/v1/files/upload`
  - `GET /api/v1/files` (filter by folder, starred, trash, query, pagination)
  - `GET /api/v1/files/{file_id}`
  - `GET /api/v1/files/{file_id}/download` (supports range requests)
  - `GET /api/v1/files/{file_id}/preview` (inline disposition, image/pdf/text/media)
  - `PATCH /api/v1/files/{file_id}` (rename, move, star, trash, restore)
  - `DELETE /api/v1/files/{file_id}` (soft-delete / purge)
  - `POST /api/v1/folders`
  - `GET /api/v1/folders/{folder_id}`
  - `PATCH /api/v1/folders/{folder_id}`
  - `DELETE /api/v1/folders/{folder_id}`
  - `GET /api/v1/search`
  - `GET /api/v1/storage/usage`
  - `GET /api/v1/storage/status`
  - `GET /api/v1/health`
  - `POST /api/v1/shares`, `GET /api/v1/shares`, `DELETE /api/v1/shares/{id}`
  - `GET /api/v1/public/shares/{token}`, `GET /api/v1/public/shares/{token}/download`
- [x] Automated tests for Phase 2-4 using Pytest and HTTPX (13/13 passing)

## Phase 5: Next.js Web Application
- [x] Initialize Next.js 14 App Router project in `apps/web` with TypeScript and Tailwind CSS
- [x] Install Lucide React icons, utilities
- [x] Implement design system (theme provider, dark/light mode, glassmorphism/cards, typography)
- [x] Implement authentication state & API client (cookie/bearer handling, refresh loop)
- [x] Implement layout: responsive sidebar, topbar with search & storage gauge, breadcrumbs
- [x] Implement pages & features:
  - Login & Register & First-run Setup (`/login`)
  - Dashboard with real usage metrics and breakdown (`/`)
  - File Explorer with grid/list view, sort, filter, breadcrumb, folder create, drag-and-drop upload (`/files`)
  - File Context Menus & Action Modals (rename, move, delete, share, star, details)
  - File Preview Modal (Image, PDF, Video, Audio, Code/Text viewers)
  - Starred files (`/starred`), Recent files (`/recent`), Trash & Restore (`/trash`)
  - Shared Links Manager (`/shares`)
  - Storage Analytics Dashboard (`/storage`)
  - User Settings & Admin Configuration (`/settings`)
  - Public Share Download & Preview (`/share/[token]`)
- [x] Next.js production build check (`npm run build`: 12/12 static/dynamic routes compiled successfully)

## Phase 6: Expo Android Client
- [x] Setup React Native Expo app in `apps/android` with TypeScript
- [x] Implement dynamic server URL management (LAN, Tailscale, Cloudflare) with live connection test
- [x] Secure token storage using Expo SecureStore (backed by Android Keystore)
- [x] Auth screens (server setup, login, register)
- [x] Dashboard with storage quota progress & host SSD online status
- [x] File explorer with document picker upload (`expo-document-picker`)
- [x] Download & file preview / system share integration (`expo-file-system` and `expo-sharing`)
- [x] Settings screen with connection testing, profile info, and sign out
- [x] App configuration with Android permissions in `app.json`

## Phase 7: Remote Access & Security
- [x] Document and configure private Tailscale setup for Windows server + Android device
- [x] Document Cloudflare Tunnel setup for optional public HTTPS domain
- [x] Security hardening (CORS origin validation, rate limiting, secure cookies, path sanitization, 200MB host safety margin)
- [x] Create `docs/REMOTE_ACCESS.md` and `docs/SECURITY.md`

## Phase 8: Windows Scripts, Backup & Recovery, Docs
- [x] Implement PowerShell scripts:
  - `scripts/setup.ps1` (Automated prerequisite check, venv, dependencies, migrations)
  - `scripts/start.ps1` (Launch backend and web frontend)
  - `scripts/stop.ps1` (Clean process termination)
  - `scripts/backup.ps1` (Consistent transactional SQLite online backup via `sqlite_backup.py` + storage object sync + SHA-256 manifest)
  - `scripts/restore.ps1` (Restoration with SHA-256 manifest integrity verification and confirmation)
- [x] Create `docker-compose.yml` and `Dockerfile`s with persistent host volume mounts
- [x] Complete comprehensive docs in `docs/`:
  - `docs/ARCHITECTURE.md`
  - `docs/INSTALLATION.md`
  - `docs/API.md`
  - `docs/BACKUP_AND_RECOVERY.md`
  - `docs/ANDROID_BUILD.md`
  - `docs/TROUBLESHOOTING.md`
  - `README.md`

## Phase 9: Verification, Tests & Final Deliverable Review
- [x] Run backend automated tests (13/13 passed)
- [x] Run web frontend production build (`npm run build`: passed)
- [x] Test backup and restore scripts end-to-end
- [x] Verify final repository state and deliverable documentation

## Phase 10: Security Audit & Hardening
- [x] Audit Authentication & Argon2id configuration
- [x] Audit Authorization & Cross-user file/folder isolation
- [x] Audit Path traversal prevention in `StorageEngine` and `sanitize_filename`
- [x] Fix folder reparenting cycle vulnerability and breadcrumb infinite loop / DoS
- [x] Neutralize Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`)
- [x] Implement RFC 6819 Refresh Token reuse detection with automatic session containment breach termination
- [x] Prevent administrator self-lockout (prevent self-deactivation and self-demotion)
- [x] Add rate limiting (`share_limiter`) to unauthenticated public share metadata and download endpoints
- [x] Add production secret key validation (`Settings.validate_production_security`) to reject insecure default secrets
- [x] Add full regression test suite in `backend/tests/test_security_audit.py` (20/20 tests passed)
- [x] Verify Next.js frontend TypeScript check (`tsc --noEmit`: 0 errors)
- [x] Verify Next.js frontend ESLint check (`next lint`: 0 errors)
- [x] Verify Next.js frontend production build (`npm run build`: 12/12 routes compiled cleanly)
