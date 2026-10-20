# LocalVault Installation & Quickstart Guide

This guide covers installing and launching LocalVault natively on Windows 10/11 or via Docker Compose.

---

## Prerequisites

1. **Operating System**: Windows 10 or Windows 11 (64-bit).
2. **Python**: Python 3.11 or later ([python.org](https://www.python.org/downloads/windows/)). Make sure to check **"Add Python to PATH"** during installation.
3. **Node.js**: Node.js v18 or later ([nodejs.org](https://nodejs.org/)).
4. **Git**: Git for Windows ([gitforwindows.org](https://gitforwindows.org/)).

---

## Native Windows Quickstart (Recommended)

LocalVault includes automated PowerShell scripts that handle the complete installation and launch.

### Step 1: Clone or Open Repository
Open Windows PowerShell in the project directory:
```powershell
cd "d:\All files\Cloud storage"
```

### Step 2: Run Automated Setup
Execute the setup script:
```powershell
.\scripts\setup.ps1
```
This script automatically:
- Verifies Python, Node.js, and npm.
- Creates the Python virtual environment in `backend\.venv`.
- Installs backend dependencies (`fastapi`, `uvicorn`, `sqlalchemy`, `argon2-cffi`, `alembic`, etc.).
- Applies database migrations to initialize SQLite.
- Installs frontend npm packages in `apps\web`.

### Step 3: Start the Application
Launch both backend and frontend servers:
```powershell
.\scripts\start.ps1
```

Once started, access the services:
- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API & Swagger Docs**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **Server Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### Step 4: First-Run Administrator Setup
1. Navigate to [http://localhost:3000](http://localhost:3000).
2. LocalVault will detect that zero users exist and prompt you with the **First-Run Administrator Setup** screen.
3. Enter your desired administrator username, email, and password.
4. Your account is created with full administrator privileges!

---

## Stopping the Application
To terminate all running LocalVault background processes:
```powershell
.\scripts\stop.ps1
```

---

## Manual Step-by-Step Setup (Without Scripts)

If you prefer to configure each component manually:

### 1. Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup
In a second terminal window:
```powershell
cd apps\web
npm install
npm run dev
```

---

## Storage Path Configuration

By default, files and databases are stored in the project's `data/` directory:
- Uploaded Files: `data/storage/objects/`
- SQLite Database: `data/db/localvault.db`

To configure a custom storage drive (e.g. `D:\MyVaultStorage`):
1. Copy `backend\.env.example` to `backend\.env`.
2. Edit `LOCALVAULT_STORAGE_PATH`:
   ```env
   LOCALVAULT_STORAGE_PATH=D:/MyVaultStorage
   ```
3. Restart the backend. LocalVault will automatically create the sub-sharded directories and verify write permissions.

---

## Docker Compose Setup (Alternative)

To run LocalVault inside Docker containers while preserving storage files on your host SSD:
```powershell
docker compose up -d
```
All files remain permanently bound to `./data/storage` and `./data/db` on your Windows SSD.
