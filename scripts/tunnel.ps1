<#
.SYNOPSIS
    LocalVault Secure HTTPS Tunnel Helper (Cloudflare Tunnel)
.DESCRIPTION
    Starts a secure HTTPS tunnel to your local FastAPI backend on port 8000.
    Outputs the assigned public HTTPS URL for Vercel and remote mobile access.
#>

param (
    [int]$BackendPort = 8000
)

$Host.UI.RawUI.WindowTitle = "LocalVault - Secure HTTPS Tunnel"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       LocalVault Secure Tunnel Helper            " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Verify Local FastAPI Backend is running
Write-Host "[1/3] Checking local FastAPI backend on port $BackendPort..." -ForegroundColor Yellow
$localConn = Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue

if (-not $localConn) {
    Write-Warning "FastAPI backend is NOT running on port $BackendPort!"
    Write-Host "Please start the backend first by running:" -ForegroundColor White
    Write-Host "  .\scripts\start.ps1" -ForegroundColor Green
    Write-Host "or:" -ForegroundColor White
    Write-Host "  cd backend; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000" -ForegroundColor Green
    Write-Host ""
    $startChoice = Read-Host "Would you like to start the backend now? (Y/N)"
    if ($startChoice -match "^[Yy]") {
        & (Join-Path $PSScriptRoot "start.ps1")
        Start-Sleep -Seconds 3
    } else {
        exit 1
    }
}

# Verify local health
try {
    $healthCheck = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
    Write-Host "Backend is healthy! (v$($healthCheck.version) - Status: $($healthCheck.status) - DB: $($healthCheck.database))" -ForegroundColor Green
} catch {
    Write-Warning "Could not verify http://127.0.0.1:$BackendPort/api/v1/health: $_"
}

# 2. Check for cloudflared executable
Write-Host "`n[2/3] Checking for cloudflared..." -ForegroundColor Yellow

$cloudflaredCmd = Get-Command "cloudflared" -ErrorAction SilentlyContinue
$cloudflaredExe = if ($cloudflaredCmd) { $cloudflaredCmd.Source } else { $null }

# Common Windows install locations
$commonPaths = @(
    "$env:LOCALAPPDATA\Programs\cloudflared\cloudflared.exe",
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe",
    "$PSScriptRoot\tools\cloudflared.exe"
)

if (-not $cloudflaredExe) {
    foreach ($p in $commonPaths) {
        if (Test-Path $p) {
            $cloudflaredExe = $p
            break
        }
    }
}

if (-not $cloudflaredExe) {
    Write-Warning "cloudflared was not found on your system."
    Write-Host "You can automatically install Cloudflare Tunnel using winget:" -ForegroundColor White
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Green
    Write-Host ""
    $installChoice = Read-Host "Would you like to run 'winget install --id Cloudflare.cloudflared' now? (Y/N)"
    if ($installChoice -match "^[Yy]") {
        winget install --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $cloudflaredCmd = Get-Command "cloudflared" -ErrorAction SilentlyContinue
        if ($cloudflaredCmd) {
            $cloudflaredExe = $cloudflaredCmd.Source
        }
    }
}

if (-not $cloudflaredExe) {
    Write-Error "cloudflared is required to create a secure HTTPS tunnel. Please install it and rerun this script."
    exit 1
}

# 3. Start cloudflared tunnel
Write-Host "`n[3/3] Starting Cloudflare Tunnel to http://127.0.0.1:$BackendPort..." -ForegroundColor Yellow
Write-Host "Press CTRL+C anytime to terminate the tunnel.`n" -ForegroundColor DarkGray

& $cloudflaredExe tunnel --url "http://127.0.0.1:$BackendPort"
