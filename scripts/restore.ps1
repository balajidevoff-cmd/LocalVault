# LocalVault Restore Script
# Restores database and storage directory from a verified backup folder.

param (
    [Parameter(Mandatory=$true)]
    [string]$BackupPath,

    [string]$TargetDbDir,
    [string]$TargetStorageDir,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
if (-not $TargetDbDir) {
    $TargetDbDir = Join-Path $RootDir "data\db"
}
if (-not $TargetStorageDir) {
    $TargetStorageDir = Join-Path $RootDir "data\storage"
}

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "            LocalVault Restore Tool               " -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "Source Backup: $BackupPath" -ForegroundColor Cyan
Write-Host "Target DB:     $TargetDbDir" -ForegroundColor Cyan
Write-Host "Target Storage:$TargetStorageDir" -ForegroundColor Cyan

if (-not (Test-Path $BackupPath)) {
    Write-Error "Backup path '$BackupPath' does not exist."
}

# 1. Verify Manifest and Checksum
$ManifestFile = Join-Path $BackupPath "manifest.json"
$DbBackupFile = Join-Path $BackupPath "localvault.db"
$StorageBackupDir = Join-Path $BackupPath "storage"

if (-not (Test-Path $DbBackupFile)) {
    Write-Error "Database file '$DbBackupFile' not found in backup."
}

Write-Host "[1/3] Verifying backup integrity..." -ForegroundColor Yellow
if (Test-Path $ManifestFile) {
    $Manifest = Get-Content $ManifestFile | ConvertFrom-Json
    $CurrentHash = (Get-FileHash -Path $DbBackupFile -Algorithm SHA256).Hash
    if ($Manifest.database_sha256 -and ($Manifest.database_sha256 -ne $CurrentHash)) {
        Write-Error "Integrity verification failed! Expected hash $($Manifest.database_sha256) but found $CurrentHash."
    }
    Write-Host "  Integrity check passed (SHA-256 match)." -ForegroundColor Green
} else {
    Write-Warning "  No manifest.json found; skipping checksum verification."
}

# 2. Confirmation before overwriting
if (-not $Force) {
    Write-Host ""
    Write-Host "WARNING: Restoring will overwrite existing data in the target directory." -ForegroundColor Red
    $confirm = Read-Host "Are you sure you want to proceed? (Type 'YES' to continue)"
    if ($confirm -ne "YES") {
        Write-Host "Restore cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# 3. Perform Restore
Write-Host "[2/3] Restoring SQLite database..." -ForegroundColor Yellow
if (-not (Test-Path $TargetDbDir)) {
    New-Item -ItemType Directory -Force -Path $TargetDbDir | Out-Null
}
Copy-Item -Path $DbBackupFile -Destination (Join-Path $TargetDbDir "localvault.db") -Force
Write-Host "  Database restored." -ForegroundColor Green

Write-Host "[3/3] Restoring storage files..." -ForegroundColor Yellow
if (Test-Path $StorageBackupDir) {
    if (-not (Test-Path $TargetStorageDir)) {
        New-Item -ItemType Directory -Force -Path $TargetStorageDir | Out-Null
    }
    Copy-Item -Path (Join-Path $StorageBackupDir "*") -Destination $TargetStorageDir -Recurse -Force
    Write-Host "  Storage objects restored." -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Restore Completed Successfully!                  " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
