# LocalVault Backup Script
# Performs a consistent, transactional backup of the SQLite database and storage directory.

param (
    [string]$DestinationPath
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$DbFile = Join-Path $RootDir "data\db\localvault.db"
$StorageDir = Join-Path $RootDir "data\storage"
$VenvPython = Join-Path $RootDir "backend\.venv\Scripts\python.exe"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (-not $DestinationPath) {
    $DestinationPath = Join-Path $RootDir "data\backups\backup_$Timestamp"
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "            LocalVault Backup Tool                " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Target: $DestinationPath" -ForegroundColor Yellow

if (-not (Test-Path $DestinationPath)) {
    New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null
}

# 1. Consistent SQLite Database Backup
Write-Host "[1/3] Creating consistent transactional SQLite backup..." -ForegroundColor Yellow
$DbBackupFile = Join-Path $DestinationPath "localvault.db"
$SqliteBackupScript = Join-Path $PSScriptRoot "sqlite_backup.py"

& $VenvPython $SqliteBackupScript $DbFile $DbBackupFile

# 2. Copy Local Storage Objects
Write-Host "[2/3] Copying local filesystem storage objects..." -ForegroundColor Yellow
$StorageBackupDir = Join-Path $DestinationPath "storage"
if (Test-Path $StorageDir) {
    Copy-Item -Path $StorageDir -Destination $StorageBackupDir -Recurse -Force
}

# 3. Create Manifest and Checksum
Write-Host "[3/3] Generating backup manifest and SHA-256 checksums..." -ForegroundColor Yellow
$ManifestFile = Join-Path $DestinationPath "manifest.json"
$DbHash = (Get-FileHash -Path $DbBackupFile -Algorithm SHA256).Hash

$Manifest = @{
    timestamp = (Get-Date -Format "o")
    version = "0.1.0"
    database_sha256 = $DbHash
    backup_path = $DestinationPath
} | ConvertTo-Json

Set-Content -Path $ManifestFile -Value $Manifest

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Backup Completed Successfully!                   " -ForegroundColor Green
Write-Host " Location: $DestinationPath                       " -ForegroundColor Cyan
Write-Host " Database Checksum: $DbHash                       " -ForegroundColor DarkGray
Write-Host "==================================================" -ForegroundColor Green
