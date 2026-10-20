<#
.SYNOPSIS
    LocalVault - Remote Access Setup & Configuration Tool
.DESCRIPTION
    Configures persistent remote access for LocalVault using Cloudflare Tunnel.
    Verifies local backend health, tests tunnel connectivity, optionally configures
    silent Windows autostart (off by default), and outputs the exact Vercel settings.
#>

[CmdletBinding()]
param (
    [string]$Hostname = "",
    [string]$TunnelToken = "",
    [int]$BackendPort = 8000,
    [switch]$EnableAutoStart,
    [switch]$DisableAutoStart
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
$TunnelConfigDir = Join-Path $RootDir "config\tunnel"
$TunnelInfoFile = Join-Path $TunnelConfigDir "tunnel_info.json"
$LogsDir = Join-Path $RootDir "logs"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "    LocalVault Persistent Remote Access Setup     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check Backend Health
Write-Host "`n[Step 1/4] Checking local FastAPI backend health on port $BackendPort..." -ForegroundColor Yellow
$backendHealthy = $false
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
    if ($health.status -eq "ok" -and $health.database -eq "connected") {
        Write-Host "FastAPI backend is active and healthy (v$($health.version))." -ForegroundColor Green
        $backendHealthy = $true
    }
} catch {
    Write-Warning "Local backend is not currently running. Testing startup via start.ps1..."
    & (Join-Path $PSScriptRoot "start.ps1") -BackendPort $BackendPort
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
        if ($health.status -eq "ok") {
            $backendHealthy = $true
            Write-Host "FastAPI backend is now confirmed healthy!" -ForegroundColor Green
        }
    } catch {
        Write-Error "Could not connect to FastAPI backend on http://127.0.0.1:$BackendPort/api/v1/health"
        exit 1
    }
}

# 2. Check Tunnel Configuration
Write-Host "`n[Step 2/4] Verifying persistent tunnel service..." -ForegroundColor Yellow

$cloudflaredCmd = Get-Command "cloudflared" -ErrorAction SilentlyContinue
$cloudflaredExe = if ($cloudflaredCmd) { $cloudflaredCmd.Source } else {
    $candidates = @(
        "C:\Program Files (x86)\cloudflared\cloudflared.exe",
        "$env:LOCALAPPDATA\Programs\cloudflared\cloudflared.exe",
        "$env:ProgramFiles\cloudflared\cloudflared.exe"
    )
    ($candidates | Where-Object { Test-Path $_ } | Select-Object -First 1)
}

if (-not $cloudflaredExe) {
    Write-Error "cloudflared executable was not found. Please install it using: winget install --id Cloudflare.cloudflared -e"
    exit 1
}

# Check Cloudflared Windows Service
$cfService = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
if ($cfService) {
    Write-Host "Cloudflared Windows Service found: $($cfService.Status)" -ForegroundColor Green
    if ($cfService.Status -ne "Running") {
        Write-Host "Starting Cloudflared service..." -ForegroundColor Cyan
        Start-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "Cloudflared Windows Service is not installed." -ForegroundColor DarkYellow
    if ($TunnelToken) {
        Write-Host "Installing Cloudflared service with provided token (requires administrator privileges)..." -ForegroundColor Cyan
        Start-Process -FilePath $cloudflaredExe -ArgumentList "service install $TunnelToken" -Verb RunAs -Wait
    }
}

# 3. Handle Hostname and Public Verification
Write-Host "`n[Step 3/4] Validating public hostname..." -ForegroundColor Yellow

if (-not $Hostname -and (Test-Path $TunnelInfoFile)) {
    try {
        $savedInfo = Get-Content $TunnelInfoFile -Raw | ConvertFrom-Json
        $Hostname = $savedInfo.hostname
    } catch { }
}

if ($Hostname) {
    $Hostname = $Hostname.Trim().ToLower()
    Write-Host "Testing HTTPS connection to https://$Hostname/api/v1/health..." -ForegroundColor Cyan
    try {
        $remoteHealth = Invoke-RestMethod -Uri "https://$Hostname/api/v1/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
        if ($remoteHealth.status -eq "ok") {
            Write-Host "Public HTTPS Health Check PASSED!" -ForegroundColor Green
            Write-Host "Remote endpoint: https://$Hostname/api/v1" -ForegroundColor Green
        }
    } catch {
        Write-Warning "Could not verify remote endpoint at https://$Hostname/api/v1/health: $_"
        Write-Host "Ensure DNS routing is configured in your Cloudflare Zero Trust dashboard to point to http://localhost:$BackendPort." -ForegroundColor DarkGray
    }

    if (-not (Test-Path $TunnelConfigDir)) {
        New-Item -ItemType Directory -Force -Path $TunnelConfigDir | Out-Null
    }

    $info = @{
        hostname = $Hostname
        api_url = "https://$Hostname/api/v1"
        backend_url = "http://127.0.0.1:$BackendPort"
        updated_at = (Get-Date -Format "o")
    } | ConvertTo-Json -Depth 3

    Set-Content -Path $TunnelInfoFile -Value $info -Encoding utf8
} else {
    Write-Host "No public hostname specified. (You can pass -Hostname 'vault.yourdomain.com' anytime)." -ForegroundColor DarkGray
}

# 4. Automatic Startup Policy Configuration
Write-Host "`n[Step 4/4] Configuring startup policy..." -ForegroundColor Yellow

if ($DisableAutoStart -or (-not $EnableAutoStart)) {
    # Default is OFF as requested by user
    & (Join-Path $PSScriptRoot "uninstall-autostart.ps1") | Out-Null
    Write-Host "Automatic startup on reboot is DISABLED." -ForegroundColor Green
    Write-Host "PowerShell will NOT open automatically when restarting the laptop." -ForegroundColor Green
} elseif ($EnableAutoStart) {
    Write-Host "Enabling silent background autostart (zero console popup)..." -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot "install-autostart.ps1")
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " LocalVault Remote Access Configuration Summary   " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host " 1. START LOCALVAULT ON DEMAND:" -ForegroundColor Yellow
Write-Host "    .\scripts\start.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host " 2. STOP LOCALVAULT:" -ForegroundColor Yellow
Write-Host "    .\scripts\stop.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host " 3. VERCEL ENVIRONMENT VARIABLE:" -ForegroundColor Yellow
if ($Hostname) {
    Write-Host "    NEXT_PUBLIC_API_URL = https://$Hostname/api/v1" -ForegroundColor Cyan
} else {
    Write-Host "    NEXT_PUBLIC_API_URL = https://<YOUR-CLOUDFLARE-HOSTNAME>/api/v1" -ForegroundColor Cyan
}
Write-Host "    Add this under Vercel Settings -> Environment Variables, then redeploy." -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green
