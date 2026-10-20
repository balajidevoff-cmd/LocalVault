# LocalVault

> **Your files. Your storage. Your control.**

LocalVault is a modern, production-oriented, self-hosted cloud storage platform inspired by the usability of Google Drive and Dropbox. Instead of relying on expensive third-party cloud storage providers (AWS S3, Google Cloud, Firebase, Supabase), **LocalVault stores all physical file contents directly on your Windows laptop's local SSD**, maintaining complete privacy and data ownership with zero recurring storage subscriptions.

---

## Highlights & Features

- **Local SSD Storage Engine**: Streams binary payloads directly to a configurable local folder on your host drive. No cloud blobs.
- **Atomic File Operations**: Uploads stream to `.tmp` files with on-the-fly SHA-256 verification before atomic placement.
- **Physical Safety Margin**: Checks actual physical disk capacity (`shutil.disk_usage`) and enforces a 200 MB host OS safety guard to prevent system lockups.
- **Path Traversal Protection**: Sub-sharded UUID storage keys prevent directory escape, symlink exploitation, and malicious filenames.
- **Enterprise-Grade Authentication**: Argon2id password hashing, short-lived JWT access tokens, and rotatable refresh sessions with SHA-256 token hashing.
- **SQLite Database with WAL Mode**: Write-Ahead Logging for high-concurrency local performance, strict foreign key constraints, and Alembic migrations.
- **Polished Next.js Web Application**:
  - App Router, TypeScript, and Tailwind CSS with sleek dark/light theme support.
  - File Explorer with grid and list views, drag-and-drop uploads, breadcrumbs, search, and sorting.
  - Comprehensive File Preview modal (Images, PDFs, HTML5 Audio & Video, Code/Text viewer with syntax copying).
  - Storage Analytics dashboard with file type category distributions.
  - Public Share link generator with optional expiration and Argon2id password protection.
- **Expo Android Client**:
  - React Native Android application with configurable server URL (LAN Wi-Fi or Tailscale).
  - Hardware-backed credential security with `expo-secure-store`.
  - Document picker uploads (`expo-document-picker`) and file downloads (`expo-file-system`).
  - Native file sharing via Android system share sheet (`expo-sharing`).
- **Native Windows Automation**: PowerShell scripts for one-click setup, startup, shutdown, and ACID-consistent online SQLite backups.
- **Encrypted Remote Access**: Step-by-step guides for zero-port-forwarding access via Tailscale and Cloudflare Tunnel.

---

## Monorepo Project Structure

```
LocalVault/
  apps/
    web/                  # Next.js 14 App Router Web Application
      src/
        app/              # Dashboard, Files, Recent, Starred, Trash, Shares, Storage, Settings
        components/       # FileExplorer, PreviewModal, UploadModal, ShareModal, Sidebar, Topbar
        context/          # AuthContext, ToastContext
        lib/              # Typed API client
        types/            # Shared TypeScript definitions
      package.json
      tailwind.config.js
      Dockerfile

    android/              # Expo React Native Android Application
      src/
        screens/          # LoginScreen, DashboardScreen, ExplorerScreen, SettingsScreen
        context/          # Mobile AuthContext with SecureStore
        lib/              # Mobile API client with FileSystem & DocumentPicker
        types/            # Mobile TypeScript definitions
      app.json            # Expo Android configuration & permissions
      package.json

  backend/                # FastAPI Backend Service
    app/
      main.py             # FastAPI entry point, CORS, and security middleware
      core/               # Pydantic Settings, Argon2id security, structured logging
      api/                # Routes (auth, users, files, folders, search, sharing, storage, health)
      models/             # SQLAlchemy 2.x models (User, FileItem, Folder, RefreshSession, ShareLink)
      schemas/            # Pydantic request/response validation schemas
      services/           # Local storage engine, FileService, FolderService, AuthService, SharingService
      db/                 # SQLite database connection & Alembic migration scripts
    tests/                # Automated pytest suite (auth, files, hierarchy, security isolation)
    requirements.txt
    pyproject.toml
    alembic.ini
    Dockerfile

  data/
    storage/              # Primary storage directory for uploaded files (gitignored)
    db/                   # SQLite database directory (gitignored)
    backups/              # Transactional backup destination (gitignored)

  scripts/
    setup.ps1             # Automated Windows setup (prerequisites, venv, deps, migrations)
    start.ps1             # Starts backend and frontend servers
    stop.ps1              # Gracefully terminates running processes
    backup.ps1            # Transactional SQLite online backup + storage sync
    restore.ps1           # Verified backup restoration with integrity check
    sqlite_backup.py      # Standalone SQLite Online Backup API utility

  docs/
    ARCHITECTURE.md       # High-level system design and data flow
    INSTALLATION.md       # Native Windows and Docker setup instructions
    API.md                # REST API endpoint reference and schemas
    SECURITY.md           # Defense-in-depth security model & hardening
    BACKUP_AND_RECOVERY.md# Backup procedures, WAL consistency, and recovery tests
    REMOTE_ACCESS.md      # Tailscale WireGuard and Cloudflare Tunnel guide
    ANDROID_BUILD.md      # APK generation and mobile deployment
    TROUBLESHOOTING.md    # Common errors, firewall rules, and FAQ
```

---

## Quickstart (Windows Native)

### 1. Prerequisites
- Windows 10 or Windows 11
- Python 3.11+ ([python.org](https://www.python.org/))
- Node.js 18+ ([nodejs.org](https://nodejs.org/))
- Git for Windows ([gitforwindows.org](https://gitforwindows.org/))

### 2. Run Automated Setup
Open Windows PowerShell in the project root:
```powershell
.\scripts\setup.ps1
```

### 3. Start LocalVault
```powershell
.\scripts\start.ps1
```

Once started:
- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Interactive API Docs**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### 4. First-Run Administrator Account
Open [http://localhost:3000](http://localhost:3000) in your browser. LocalVault will automatically detect that no users exist and display the **First-Run Administrator Setup** screen. Register your initial administrator credentials to begin using the vault.

### 5. Stopping the Server
To stop all backend and frontend processes:
```powershell
.\scripts\stop.ps1
```

---

## Running Automated Tests

LocalVault includes a test suite covering authentication, file operations, streaming range requests, folder cascading, cross-user isolation, path traversal prevention, and public share links.

Run the test suite using pytest:
```powershell
cd backend
.\.venv\Scripts\pytest -v
```

All 13 automated tests run against in-memory SQLite and isolated temporary storage directories without affecting live user data.

---

## Backups & Disaster Recovery

### Creating a Backup
LocalVault features a transactional backup tool that leverages the **SQLite Online Backup API** to snapshot your active database without stopping the server:
```powershell
.\scripts\backup.ps1
```
Backups are saved to `data/backups/backup_YYYYMMDD_HHMMSS/` with an accompanying `manifest.json` containing the database's SHA-256 hash.

### Restoring from a Backup
```powershell
.\scripts\restore.ps1 -BackupPath "data\backups\backup_YYYYMMDD_HHMMSS"
```
The restore script verifies the SHA-256 hash against the manifest and requires explicit confirmation before restoring active data.

> [!TIP]
> To protect against physical SSD hardware failure, mirror your backup destination to an external USB hard drive or network storage. See [`docs/BACKUP_AND_RECOVERY.md`](file:///d:/All%20files/Cloud%20storage/docs/BACKUP_AND_RECOVERY.md).

---

## Remote Access via Tailscale

To access your Windows laptop storage from your Android phone anywhere in the world without opening router firewall ports:
1. Install **Tailscale** on your Windows laptop and Android phone.
2. Bind the LocalVault backend to all interfaces:
   ```powershell
   .\scripts\start.ps1 -BindHost "0.0.0.0"
   ```
3. In the LocalVault Android app, set the server URL to your laptop's Tailscale IP (e.g. `http://100.85.120.45:8000/api/v1`) or use Tailscale Serve for automatic HTTPS.
4. For complete instructions, see [`docs/REMOTE_ACCESS.md`](file:///d:/All%20files/Cloud%20storage/docs/REMOTE_ACCESS.md).

---

## Docker Compose (Alternative Option)

To run LocalVault via Docker Compose with persistent bind mounts to your host SSD:
```powershell
docker compose up -d
```
Storage files remain permanently preserved on your host SSD at `./data/storage` and `./data/db`.

---

## Documentation Index

- [System Architecture](file:///d:/All%20files/Cloud%20storage/docs/ARCHITECTURE.md)
- [Installation Guide](file:///d:/All%20files/Cloud%20storage/docs/INSTALLATION.md)
- [REST API Reference](file:///d:/All%20files/Cloud%20storage/docs/API.md)
- [Security Architecture](file:///d:/All%20files/Cloud%20storage/docs/SECURITY.md)
- [Backup & Recovery](file:///d:/All%20files/Cloud%20storage/docs/BACKUP_AND_RECOVERY.md)
- [Remote Access (Tailscale & Cloudflare)](file:///d:/All%20files/Cloud%20storage/docs/REMOTE_ACCESS.md)
- [Android Build Guide](file:///d:/All%20files/Cloud%20storage/docs/ANDROID_BUILD.md)
- [Troubleshooting & FAQ](file:///d:/All%20files/Cloud%20storage/docs/TROUBLESHOOTING.md)

---

## License
MIT License. Self-hosted personal software.
