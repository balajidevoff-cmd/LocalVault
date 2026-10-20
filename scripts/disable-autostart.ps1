<#
.SYNOPSIS
    Disable Automatic LocalVault Startup on Windows Boot
.DESCRIPTION
    Completely removes any Scheduled Task or startup entry for LocalVault,
    ensuring that PowerShell never opens automatically when the laptop restarts.
#>

$TaskName = "LocalVault-Autostart"
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[OK] LocalVault automatic startup task removed." -ForegroundColor Green
} else {
    Write-Host "[OK] Automatic startup is already disabled. Nothing runs on restart." -ForegroundColor Green
}

Write-Host "PowerShell will NOT open when restarting your laptop." -ForegroundColor Green
Write-Host "To start LocalVault when you need it, simply run:" -ForegroundColor White
Write-Host "  .\scripts\start.ps1" -ForegroundColor Cyan
