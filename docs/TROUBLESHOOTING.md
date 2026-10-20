# LocalVault Troubleshooting & FAQ

This document addresses common installation, network, and runtime issues.

---

## 1. Network & Connectivity Issues

### "Cannot connect to server" from Android Phone
- **Cause**: Using `localhost` or `127.0.0.1` on the Android client.
- **Solution**: Open the LocalVault Android app, and in the Server Base URL field, enter your Windows laptop's Wi-Fi IP address (e.g. `http://192.168.1.50:8000/api/v1`) or your Tailscale IP (e.g. `http://100.x.y.z:8000/api/v1`).
- **Firewall Check**: Ensure Windows Defender Firewall allows incoming connections on port 8000 for private networks:
  ```powershell
  New-NetFirewallRule -DisplayName "LocalVault Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
  ```

### Backend Not Accessible Outside Localhost
- **Cause**: Backend bound only to `127.0.0.1`.
- **Solution**: Start the backend bound to `0.0.0.0`:
  ```powershell
  .\scripts\start.ps1 -BindHost "0.0.0.0"
  ```

---

## 2. Port Conflicts (Port 8000 or Port 3000 In Use)

If you see `[Errno 10048] error while attempting to bind on address ('127.0.0.1', 8000)`:
1. Run the stop script:
   ```powershell
   .\scripts\stop.ps1
   ```
2. Or inspect the process occupying the port:
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess
   ```
3. You can also specify an alternate port when running `start.ps1`:
   ```powershell
   .\scripts\start.ps1 -BackendPort 8080 -FrontendPort 3001
   ```

---

## 3. SQLite Database Locked (`sqlite3.OperationalError: database is locked`)

- **Cause**: Concurrent heavy writes without WAL mode enabled.
- **Solution**: LocalVault automatically enables `PRAGMA journal_mode=WAL;` and `PRAGMA synchronous=NORMAL;` on startup. If an external tool has locked the file, restart the backend or run:
  ```powershell
  .\scripts\stop.ps1
  .\scripts\start.ps1
  ```

---

## 4. Windows Long Paths Issue (`Filename too long`)

By default, older Windows systems enforce a 260-character path limit (`MAX_PATH`).
To enable long paths:
1. Open PowerShell as Administrator.
2. Run:
   ```powershell
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
     -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   ```

---

## 5. Uploading Very Large Files (> 2 GB)

- LocalVault streams uploads in 1 MB chunks to prevent exhausting server RAM.
- Default max upload limit is configured to 10 GB (`LOCALVAULT_MAX_UPLOAD_SIZE_BYTES=10737418240`).
- If uploads time out on slow networks, check your reverse proxy or browser timeout settings.

---

## 6. How to Reset Database / Re-run Setup

If you want to completely wipe test data and restart from a clean slate:
1. Stop the application:
   ```powershell
   .\scripts\stop.ps1
   ```
2. Delete the database file:
   ```powershell
   Remove-Item "data\db\localvault.db*" -Force
   ```
3. Re-run migrations:
   ```powershell
   cd backend
   .\.venv\Scripts\alembic.exe upgrade head
   cd ..
   ```
4. Restart the server with `.\scripts\start.ps1`. The first-run administrator setup screen will appear on the web dashboard.
