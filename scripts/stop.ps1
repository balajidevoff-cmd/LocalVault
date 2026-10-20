# LocalVault Windows Server Shutdown Script
# Gracefully stops running LocalVault backend and frontend processes.

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "            Stopping LocalVault Server            " -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow

$stoppedAny = $false

# Stop Uvicorn processes
$uvicornProcesses = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*uvicorn app.main:app*" }
foreach ($p in $uvicornProcesses) {
    Write-Host "Stopping Backend process (PID $($p.ProcessId))..." -ForegroundColor Cyan
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    $stoppedAny = $true
}

# Stop Next.js dev server processes running on port 3000
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    foreach ($conn in $port3000) {
        if ($conn.OwningProcess -gt 0) {
            Write-Host "Stopping process on port 3000 (PID $($conn.OwningProcess))..." -ForegroundColor Cyan
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            $stoppedAny = $true
        }
    }
}

# Stop any lingering port 8000 processes
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($port8000) {
    foreach ($conn in $port8000) {
        if ($conn.OwningProcess -gt 0) {
            Write-Host "Stopping process on port 8000 (PID $($conn.OwningProcess))..." -ForegroundColor Cyan
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            $stoppedAny = $true
        }
    }
}

if ($stoppedAny) {
    Write-Host "LocalVault services stopped successfully." -ForegroundColor Green
} else {
    Write-Host "No active LocalVault processes found." -ForegroundColor DarkGray
}
