# LocalVault Backup & Recovery Procedure

This document explains how to back up and restore your LocalVault metadata and physical files.

---

## 1. Important Concepts: Redundancy vs. Backup

> [!CRITICAL]
> **A backup stored on the same physical SSD does not protect against SSD failure.**
> If your Windows laptop's SSD experiences a hardware failure, local files and backups stored on the same drive will be lost. You should always mirror or copy your backup archives to an external USB hard drive or secondary physical machine.

| Concept | What It Does | What It Protects Against | What It Does NOT Protect Against |
| :--- | :--- | :--- | :--- |
| **Local Storage Engine** | Stores files on laptop SSD | Cloud outages, subscription fees | SSD failure, laptop theft |
| **Local Backup (`backup.ps1`)** | Transactional snapshot in `data/backups/` | Accidental file deletion, software bugs | Catastrophic SSD breakdown |
| **Off-Host Backup** | Copying backup folder to USB drive / NAS | Physical drive failure, hardware loss | - |

---

## 2. SQLite Consistency & Online Backup API

LocalVault uses SQLite with Write-Ahead Logging (`WAL` mode). Simply copying `localvault.db` with standard file tools while the server is active can result in a corrupted backup if a write transaction is currently committing to the `-wal` or `-shm` sidecar files.

To guarantee 100% ACID consistency without stopping the server, `.\scripts\backup.ps1` uses Python's **SQLite Online Backup API** (`src.backup(dst)`). This locks individual pages momentarily, transfers them safely, and writes a complete, self-consistent `.db` file.

---

## 3. Creating a Backup

Run the automated backup script from PowerShell:
```powershell
.\scripts\backup.ps1
```

Or specify a custom destination (such as an external USB drive `E:\LocalVaultBackups`):
```powershell
.\scripts\backup.ps1 -DestinationPath "E:\LocalVaultBackups\backup_20261020"
```

### What gets backed up?
1. **`localvault.db`**: All users, passwords, folder hierarchies, and file metadata.
2. **`storage/`**: All physical uploaded file objects stored on disk.
3. **`manifest.json`**: Timestamp, application version, and SHA-256 integrity checksum of the database.

---

## 4. Restoring from a Backup

To restore your data:

### Standard Restore (To Live Directory)
```powershell
.\scripts\restore.ps1 -BackupPath "data\backups\backup_20261020_091458"
```
The script will:
1. Verify the SHA-256 hash of `localvault.db` against `manifest.json`.
2. Ask for explicit `YES` confirmation before overwriting active data.
3. Restore the SQLite database file and physical storage objects.

### Testing Restoration into a Separate Directory
You can safely test that your backup is recoverable without modifying your live database:
```powershell
.\scripts\restore.ps1 `
  -BackupPath "data\backups\backup_20261020_091458" `
  -TargetDbDir "data\test_restore\db" `
  -TargetStorageDir "data\test_restore\storage" `
  -Force
```
Verify the restored files and then delete the test directory.
