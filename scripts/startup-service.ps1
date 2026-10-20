<#
.SYNOPSIS
    LocalVault - Background Service Supervisor
.DESCRIPTION
    Starts the FastAPI backend, verifies local database and storage health on port 8000,
    and then starts the configured Cloudflare Tunnel (Named Tunnel or Quick Tunnel).
    Includes log rotation, error handling, and process supervision.
#>

[CmdletBinding()]
param (
    [int]$BackendPort = 8000,
    [switch]$QuickTunnel,
    [int]$MaxLogSizeBytes = 5242880 # 5 MB
)

$RootDir = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$LogsDir = Join-Path $RootDir "logs"
$LogFile = Join-Path $LogsDir "service.log"
$TunnelConfigDir = Join-Path $RootDir "config\tunnel"
$NamedConfigFile = Join-Path $TunnelConfigDir "config.yml"

# Ensure logs directory exists
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
}

# Log rotation
function Write-ServiceLog {
    param ([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    
    # Check log size and rotate
    if (Test-Path $LogFile) {
        $fileSize = (Get-Item $LogFile).Length
        if ($fileSize -ge $MaxLogSizeBytes) {
            $backupLog = Join-Path $LogsDir "service_$((Get-Date).ToString('yyyyMMdd_HHmmss')).log"
            Move-Item -Path $LogFile -Destination $backupLog -Force -ErrorAction SilentlyContinue
        }
    }

    Add-Content -Path $LogFile -Value $line -Encoding utf8
    Write-Host $line
}

Write-ServiceLog "================ LocalVault Service Starting ================"

# 1. Verify Python Virtual Environment
if (-not (Test-Path $VenvPython)) {
    Write-ServiceLog "Python virtual environment not found at: $VenvPython" "ERROR"
    exit 1
}

# 2. Check Port 8000 & Start FastAPI
Write-ServiceLog "Checking port $BackendPort..."
$existingPort = Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue

$backendRunning = $false
if ($existingPort) {
    Write-ServiceLog "Port $BackendPort is currently occupied by PID $($existingPort.OwningProcess[0]). Verifying health..."
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
        if ($health.status -eq "ok" -and $health.database -eq "connected") {
            Write-ServiceLog "Existing FastAPI backend is healthy (v$($health.version)). Reusing running instance."
            $backendRunning = $true
        } else {
            Write-ServiceLog "Port $BackendPort answered but status is degraded or not LocalVault: $($health | ConvertTo-Json -Compress)" "WARN"
        }
    } catch {
        Write-ServiceLog "Port $BackendPort is occupied by an unresponsive process or different application." "WARN"
    }
}

$backendProc = $null
if (-not $backendRunning) {
    Write-ServiceLog "Starting FastAPI backend via Uvicorn..."
    $backendProc = Start-Process -FilePath $VenvPython `
        -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden `
        -PassThru

    Write-ServiceLog "FastAPI process launched with PID $($backendProc.Id)."
    
    # 3. Health Poll Loop (up to 30 seconds)
    Write-ServiceLog "Waiting for backend health verification on http://127.0.0.1:$BackendPort/api/v1/health..."
    $healthy = $false
    $retries = 30
    while ($retries -gt 0 -and -not $healthy) {
        Start-Sleep -Seconds 1
        try {
            $res = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($res.status -eq "ok" -and $res.database -eq "connected" -and $res.disk_healthy) {
                $healthy = $true
                Write-ServiceLog "Backend confirmed healthy! (DB: connected, Disk: OK, SetupRequired: $($res.first_run_setup_required))"
                break
            }
        } catch {
            # Still booting
        }
        $retries--
    }

    if (-not $healthy) {
        Write-ServiceLog "CRITICAL: FastAPI backend failed to reach healthy status within 30 seconds. Aborting tunnel startup." "ERROR"
        if ($backendProc -and -not $backendProc.HasExited) {
            Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
        }
        exit 1
    }
}

# 4. Locate cloudflared binary
$cloudflaredCmd = Get-Command "cloudflared" -ErrorAction SilentlyContinue
$cloudflaredExe = if ($cloudflaredCmd) { $cloudflaredCmd.Source } else { $null }

if (-not $cloudflaredExe) {
    $commonPaths = @(
        "C:\Program Files (x86)\cloudflared\cloudflared.exe",
        "$env:LOCALAPPDATA\Programs\cloudflared\cloudflared.exe",
        "$env:ProgramFiles\cloudflared\cloudflared.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) {
            $cloudflaredExe = $p
            break
        }
    }
}

if (-not $cloudflaredExe) {
    Write-ServiceLog "cloudflared executable not found. Backend is running locally, but tunnel cannot start." "WARN"
    Write-ServiceLog "Run 'winget install --id Cloudflare.cloudflared -e' to install it." "WARN"
    exit 0
}

# 5. Check if tunnel is already running
$existingTunnel = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*cloudflared*tunnel*" }
if ($existingTunnel) {
    Write-ServiceLog "A Cloudflare Tunnel is already running (PID $($existingTunnel.ProcessId[0])). Maintaining existing tunnel connection."
    exit 0
}

# 6. Start Cloudflare Tunnel
$tunnelProc = $null
if (Test-Path $NamedConfigFile) {
    Write-ServiceLog "Found persistent named tunnel configuration: $NamedConfigFile"
    Write-ServiceLog "Starting persistent named tunnel..."
    $tunnelProc = Start-Process -FilePath $cloudflaredExe `
        -ArgumentList "tunnel --config `"$NamedConfigFile`" run" `
        -WorkingDirectory $TunnelConfigDir `
        -WindowStyle Hidden `
        -PassThru
    Write-ServiceLog "Named Cloudflare Tunnel started with PID $($tunnelProc.Id)."
} elseif ($QuickTunnel) {
    Write-ServiceLog "No named tunnel config found. Starting temporary quick tunnel to http://127.0.0.1:$BackendPort..."
    $quickLog = Join-Path $LogsDir "quick_tunnel.log"
    $tunnelProc = Start-Process -FilePath $cloudflaredExe `
        -ArgumentList "tunnel --url http://127.0.0.1:$BackendPort --logfile `"$quickLog`"" `
        -WorkingDirectory $RootDir `
        -WindowStyle Hidden `
        -PassThru
    Write-ServiceLog "Quick Cloudflare Tunnel started with PID $($tunnelProc.Id). Logs: $quickLog"
} else {
    Write-ServiceLog "No named tunnel configured (config/tunnel/config.yml missing). Run .\scripts\setup-tunnel.ps1 to configure a permanent hostname." "INFO"
    Write-ServiceLog "To run a temporary tunnel instead, use: .\scripts\startup-service.ps1 -QuickTunnel" "INFO"
}

Write-ServiceLog "LocalVault service startup sequence completed successfully."
