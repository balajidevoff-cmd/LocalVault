# LocalVault Windows Server Startup Script
param (
    [string]$BindHost = "127.0.0.1",
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000
)

$RootDir = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"
$WebDir = Join-Path $RootDir "apps\web"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "            Starting LocalVault Server            " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if venv exists
if (-not (Test-Path $VenvPython)) {
    Write-Warning "Backend virtual environment not found. Running setup.ps1 first..."
    & (Join-Path $PSScriptRoot "setup.ps1")
}

# Check if backend is already running
$existingBackend = Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue
if ($existingBackend) {
    Write-Host "Backend API is already running on port $BackendPort." -ForegroundColor Green
} else {
    Write-Host "Starting Backend API on http://$BindHost`:$BackendPort..." -ForegroundColor Yellow
    $BackendProcess = Start-Process -FilePath $VenvPython `
        -ArgumentList "-m uvicorn app.main:app --host $BindHost --port $BackendPort" `
        -WorkingDirectory $BackendDir `
        -PassThru
}

# Check if frontend is already running
$existingFrontend = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue
if ($existingFrontend) {
    Write-Host "Web Application is already running on port $FrontendPort." -ForegroundColor Green
} else {
    # Clean stale production build cache to prevent webpack chunk collision in dev
    if (Test-Path "$WebDir\.next\BUILD_ID") {
        Remove-Item -Recurse -Force "$WebDir\.next" -ErrorAction SilentlyContinue
    }
    Write-Host "Starting Web Application on http://localhost:$FrontendPort..." -ForegroundColor Yellow
    $FrontendProcess = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npm run dev -- -p $FrontendPort" `
        -WorkingDirectory $WebDir `
        -PassThru
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " LocalVault is running!                           " -ForegroundColor Green
Write-Host " Web Dashboard:   http://localhost:$FrontendPort  " -ForegroundColor Cyan
Write-Host " API Docs:        http://localhost:$BackendPort/api/docs " -ForegroundColor Cyan
Write-Host " Health Check:    http://localhost:$BackendPort/api/v1/health " -ForegroundColor Cyan
Write-Host ""
Write-Host " Backend PID:  $($BackendProcess.Id)              " -ForegroundColor DarkGray
Write-Host " Frontend PID: $($FrontendProcess.Id)             " -ForegroundColor DarkGray
Write-Host ""
Write-Host " To stop all services, run:                       " -ForegroundColor Yellow
Write-Host " .\scripts\stop.ps1                               " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Green
