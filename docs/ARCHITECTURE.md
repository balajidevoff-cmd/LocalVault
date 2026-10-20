# LocalVault System Architecture

LocalVault is a self-hosted personal cloud storage platform designed to transform a standard Windows laptop with a 512 GB SSD into an accessible, private cloud server.

---

## 1. High-Level Architecture Diagram

```
+-------------------------------------------------------------------------+
|                                Clients                                  |
|                                                                         |
|      +---------------------------+       +------------------------+     |
|      | Next.js Web Application   |       | Expo Android Client    |     |
|      | (TypeScript + Tailwind)   |       | (React Native)         |     |
|      +-------------+-------------+       +-----------+------------+     |
+--------------------|---------------------------------|------------------+
                     |                                 |
                     | HTTPS / LAN / WireGuard         |
                     v                                 v
+-------------------------------------------------------------------------+
|                     FastAPI Backend (Port 8000)                         |
|                                                                         |
|  +------------------+  +-------------------+  +-----------------------+ |
|  | Auth & Security  |  | File & Folder API |  | Streaming & Chunking  | |
|  | (Argon2id, JWT)  |  | (CRUD, Hierarchy) |  | (RFC 7233 Range)      | |
|  +--------+---------+  +---------+---------+  +-----------+-----------+ |
+-----------|----------------------|------------------------|-------------+
            |                      |                        |
            | SQLAlchemy 2.x       | Safe File Placement    | Free Space Check
            v                      v                        v
+-----------------------+  +----------------------------------------------+
| SQLite Database (WAL) |  | Local Filesystem Storage Engine              |
| data/db/localvault.db |  | data/storage/objects/ab/cd/abcdef...         |
|                       |  | - Atomic .tmp rename                         |
| - Users & Quotas      |  | - SHA-256 On-The-Fly Hash Verification       |
| - Folder Hierarchies  |  | - Strict Path Containment Checks             |
| - File Metadata       |  | - 200 MB Host OS Safety Margin Guard         |
| - Hashed Sessions     |  +----------------------------------------------+
| - Public Share Links  |
+-----------------------+
```

---

## 2. Key Component Responsibilities

### A. Local Storage Engine (`backend/app/services/storage_service.py`)
- **No Cloud Blobs**: Uploaded binary payloads never go to AWS S3, Google Cloud, or Supabase. They are written directly to the host laptop's filesystem.
- **Physical Key Isolation**: Each file is stored by an internal, unguessable UUID hex key (e.g., `911a51f4e55c442588cee0745eb9b4c7`). The original filename is preserved in SQLite as metadata.
- **Path Traversal Shield**: Canonical resolution ensures physical paths cannot escape `data/storage`. Filenames with `../`, `..\\`, null bytes, or dangerous Windows characters (`: * ? " < > |`) are stripped.
- **Atomic Operations**: Files stream to `.tmp` files first, compute SHA-256 checksums on the fly, and atomically replace the destination file upon successful completion (`os.replace`).
- **Disk Protection**: An enforced 200 MB physical safety margin prevents uploads from exhausting the host SSD and crashing the Windows OS.

### B. Database & Migrations (`backend/app/db/`)
- **Engine**: SQLite 3 configured with Write-Ahead Logging (`PRAGMA journal_mode=WAL`) and strict foreign key constraints (`PRAGMA foreign_keys=ON`).
- **Migrations**: Alembic with batch mode enabled for SQLite `ALTER TABLE` compatibility.
- **Data Models**:
  - `User`: Accounts, Argon2id password hash, role (`admin` or `user`), storage quota.
  - `Folder`: Hierarchical tree with self-referencing foreign keys and cascade cleanup.
  - `FileItem`: Metadata, size, mime type, SHA-256 checksum, star status, soft-delete flag.
  - `RefreshSession`: SHA-256 hash of refresh tokens, IP, user-agent, revocation timestamp.
  - `ShareLink`: SHA-256 hash of share tokens, Argon2id password hash, expiration, access count.

### C. Web Frontend (`apps/web`)
- **Framework**: Next.js 14 using the App Router.
- **Styling**: Tailwind CSS with custom vault palette, dark/light theme toggle, glassmorphism panels.
- **Features**: Drag-and-drop file upload with progress bar, rich file preview modal (Images, PDFs, Video, Audio, Code/Text), breadcrumb navigation, storage analytics gauge, context actions (star, share, rename, trash, purge).

### D. Android Client (`apps/android`)
- **Framework**: Expo / React Native with TypeScript.
- **Credentials**: Stored in `expo-secure-store` (backed by Android Keystore).
- **Transfers**: Document picker upload via `expo-document-picker` and streaming downloads via `expo-file-system`.
- **Dynamic Server Address**: Allows configuring and verifying connection to LAN IP, Tailscale IP, or custom domain.
