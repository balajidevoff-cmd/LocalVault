# LocalVault Windows Setup Script
# Checks prerequisites, creates Python virtualenv, installs backend & frontend dependencies, and runs database migrations.

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       LocalVault Automated Setup (Windows)       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check Python
Write-Host "[1/5] Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version
    Write-Host "  Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Error "Python 3.11+ is required but not found in PATH. Please install Python and try again."
}

# 2. Check Node.js
Write-Host "[2/5] Checking Node.js and npm..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "  Found Node: $nodeVersion, npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Error "Node.js (v18+) is required but not found in PATH."
}

$RootDir = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"
$WebDir = Join-Path $RootDir "apps\web"

# 3. Setup Python Virtual Environment
Write-Host "[3/5] Setting up Python virtual environment in backend\.venv..." -ForegroundColor Yellow
$VenvDir = Join-Path $BackendDir ".venv"
if (-not (Test-Path $VenvDir)) {
    python -m venv $VenvDir
}

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"

& $VenvPython -m pip install --upgrade pip --quiet
& $VenvPip install -r (Join-Path $BackendDir "requirements.txt") --quiet
Write-Host "  Backend dependencies installed successfully." -ForegroundColor Green

# 4. Setup Database & Run Alembic Migrations
Write-Host "[4/5] Initializing SQLite database & running migrations..." -ForegroundColor Yellow
Push-Location $BackendDir
try {
    & (Join-Path $VenvDir "Scripts\alembic.exe") upgrade head
    Write-Host "  Database migrations applied successfully." -ForegroundColor Green
} finally {
    Pop-Location
}

# 5. Install Web Frontend Dependencies
Write-Host "[5/5] Installing web frontend dependencies in apps\web..." -ForegroundColor Yellow
Push-Location $WebDir
try {
    npm install --quiet
    Write-Host "  Frontend dependencies installed successfully." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Setup Complete! You can now start the server:    " -ForegroundColor Green
Write-Host " Run: .\scripts\start.ps1                         " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Green
