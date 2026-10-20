<#
.SYNOPSIS
    LocalVault - Start Local Services and Persistent Remote Access
.DESCRIPTION
    Starts the FastAPI backend, verifies database and storage health,
    and activates/verifies the persistent Cloudflare Tunnel for remote access.
    Detects existing instances to prevent duplicates.
#>

[CmdletBinding()]
param (
    [string]$BindHost = "127.0.0.1",
    [int]$BackendPort = 8000,
    [switch]$Web,
    [switch]$QuickTunnel
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"
$WebDir = Join-Path $RootDir "apps\web"
$LogsDir = Join-Path $RootDir "logs"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$TunnelConfigDir = Join-Path $RootDir "config\tunnel"
$NamedConfigFile = Join-Path $TunnelConfigDir "config.yml"
$TunnelInfoFile = Join-Path $TunnelConfigDir "tunnel_info.json"

if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "            Starting LocalVault Server            " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Virtual Environment Check
if (-not (Test-Path $VenvPython)) {
    Write-Warning "Backend virtual environment not found. Running setup.ps1 first..."
    & (Join-Path $PSScriptRoot "setup.ps1")
}

# 2. Check & Start FastAPI Backend
Write-Host "[1/3] Checking FastAPI Backend on port $BackendPort..." -ForegroundColor Yellow
$existingBackendConn = Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue

$backendHealthy = $false
if ($existingBackendConn) {
    Write-Host "Port $BackendPort is occupied (PID $($existingBackendConn.OwningProcess[0])). Verifying health..." -ForegroundColor DarkGray
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
        if ($health.status -eq "ok" -and $health.database -eq "connected") {
            Write-Host "Backend is already running and healthy (v$($health.version)). Reusing instance." -ForegroundColor Green
            $backendHealthy = $true
        }
    } catch {
        Write-Warning "Port $BackendPort is occupied by an unresponsive process or another app."
    }
}

if (-not $backendHealthy) {
    Write-Host "Starting FastAPI backend via Uvicorn..." -ForegroundColor Cyan

    $BackendProcess = Start-Process -FilePath $VenvPython `
        -ArgumentList "-m uvicorn app.main:app --host $BindHost --port $BackendPort" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden `
        -PassThru

    Write-Host "Waiting for backend health check..." -ForegroundColor DarkGray
    $retries = 25
    while ($retries -gt 0 -and -not $backendHealthy) {
        Start-Sleep -Seconds 1
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($health.status -eq "ok" -and $health.database -eq "connected") {
                $backendHealthy = $true
                break
            }
        } catch { }
        $retries--
    }

    if ($backendHealthy) {
        Write-Host "Backend started successfully (PID $($BackendProcess.Id))! (DB: connected, Storage: OK)" -ForegroundColor Green
    } else {
        Write-Error "FastAPI backend failed to start on port $BackendPort. Check $backendErrLog for details."
        exit 1
    }
}

# 3. Tunnel Verification / Startup
Write-Host "`n[2/3] Checking Remote Access Tunnel..." -ForegroundColor Yellow
$cloudflaredCmd = Get-Command "cloudflared" -ErrorAction SilentlyContinue
$cloudflaredExe = if ($cloudflaredCmd) { $cloudflaredCmd.Source } else {
    $candidates = @(
        "C:\Program Files (x86)\cloudflared\cloudflared.exe",
        "$env:LOCALAPPDATA\Programs\cloudflared\cloudflared.exe",
        "$env:ProgramFiles\cloudflared\cloudflared.exe"
    )
    ($candidates | Where-Object { Test-Path $_ } | Select-Object -First 1)
}

# Check Cloudflared Windows Service
$cfService = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
$tunnelActive = $false

if ($cfService) {
    if ($cfService.Status -ne "Running") {
        Write-Host "Starting Cloudflared Windows Service..." -ForegroundColor Cyan
        Start-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        $cfService.Refresh()
    }
    if ($cfService.Status -eq "Running") {
        Write-Host "Cloudflare Persistent Tunnel Service is ACTIVE (Status: Running)" -ForegroundColor Green
        $tunnelActive = $true
    }
}

# Check running cloudflared process
if (-not $tunnelActive) {
    $existingTunnelProc = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*cloudflared*tunnel*" }
    if ($existingTunnelProc) {
        Write-Host "Cloudflare Tunnel process is running (PID $($existingTunnelProc.ProcessId[0]))." -ForegroundColor Green
        $tunnelActive = $true
    }
}

# Start user-level tunnel if service is not running
if (-not $tunnelActive -and $cloudflaredExe) {
    if (Test-Path $NamedConfigFile) {
        Write-Host "Starting persistent named tunnel from $NamedConfigFile..." -ForegroundColor Cyan
        $tunnelLog = Join-Path $LogsDir "tunnel.log"
        $tunnelProc = Start-Process -FilePath $cloudflaredExe `
            -ArgumentList "tunnel --config `"$NamedConfigFile`" run" `
            -WorkingDirectory $TunnelConfigDir `
            -RedirectStandardOutput $tunnelLog `
            -RedirectStandardError $tunnelLog `
            -WindowStyle Hidden `
            -PassThru
        Write-Host "Named tunnel started with PID $($tunnelProc.Id)." -ForegroundColor Green
        $tunnelActive = $true
    } elseif ($QuickTunnel) {
        Write-Host "Starting temporary quick tunnel..." -ForegroundColor Yellow
        $quickLog = Join-Path $LogsDir "quick_tunnel.log"
        $tunnelProc = Start-Process -FilePath $cloudflaredExe `
            -ArgumentList "tunnel --url http://127.0.0.1:$BackendPort --ha-connections 4 --protocol http2 --logfile `"$quickLog`"" `
            -WorkingDirectory $RootDir `
            -WindowStyle Hidden `
            -PassThru
        Write-Host "High-speed tunnel started with PID $($tunnelProc.Id). URL will be in $quickLog" -ForegroundColor Green
        $tunnelActive = $true
    } else {
        Write-Host "No active tunnel running. To configure a permanent hostname, run: .\scripts\install-remote-access.ps1" -ForegroundColor DarkYellow
    }
}

# 4. Optional Local Web Frontend
if ($Web) {
    Write-Host "`n[3/3] Checking Local Web Frontend..." -ForegroundColor Yellow
    $existingFrontend = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if ($existingFrontend) {
        Write-Host "Web Application is already running on port 3000." -ForegroundColor Green
    } else {
        if (Test-Path "$WebDir\.next\BUILD_ID") {
            Remove-Item -Recurse -Force "$WebDir\.next" -ErrorAction SilentlyContinue
        }
        Write-Host "Starting Web Application on http://localhost:3000..." -ForegroundColor Yellow
        Start-Process -FilePath "cmd.exe" `
            -ArgumentList "/c npm run dev -- -p 3000" `
            -WorkingDirectory $WebDir `
            -WindowStyle Hidden
    }
} else {
    Write-Host "`n[3/3] Frontend: Using Vercel cloud deployment (or pass -Web to start local dev)." -ForegroundColor DarkGray
}

# Display configured public endpoint if known
$publicBaseUrl = $null
$publicApiUrl = $null

if (Test-Path $TunnelInfoFile) {
    try {
        $info = Get-Content $TunnelInfoFile -Raw | ConvertFrom-Json
        $publicBaseUrl = $info.base_url
        $publicApiUrl = $info.api_url
    } catch { }
}

# If still null, check quick tunnel log
if (-not $publicBaseUrl) {
    foreach ($logP in @((Join-Path $LogsDir "test_cf.log"), (Join-Path $LogsDir "quick_tunnel.log"))) {
        if (Test-Path $logP) {
            $content = Get-Content $logP -Raw -ErrorAction SilentlyContinue
            if ($content -match '(https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com)') {
                $publicBaseUrl = $matches[1]
                $publicApiUrl = "$($matches[1])/api/v1"
                break
            }
        }
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " LocalVault Server is Ready!                      " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Local Health:   http://127.0.0.1:$BackendPort/api/v1/health" -ForegroundColor Cyan
Write-Host " API Docs:       http://127.0.0.1:$BackendPort/api/docs" -ForegroundColor Cyan

if ($publicBaseUrl) {
    Write-Host ""
    Write-Host "--------------------------------------------------" -ForegroundColor DarkYellow
    Write-Host " BACKEND CONNECTION URL (Copy to Vercel):" -ForegroundColor Yellow
    Write-Host "   $publicBaseUrl" -ForegroundColor Green
    Write-Host " API Endpoint:" -ForegroundColor DarkGray
    Write-Host "   $publicApiUrl" -ForegroundColor DarkGray
    Write-Host "--------------------------------------------------" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host " To stop LocalVault, run:                         " -ForegroundColor DarkGray
Write-Host "   .\scripts\stop.ps1                             " -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Green
