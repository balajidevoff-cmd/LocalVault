<#
.SYNOPSIS
    LocalVault - Windows Task Scheduler Auto-Start Uninstaller
.DESCRIPTION
    Safely removes the 'LocalVault-Autostart' scheduled task.
#>

$ErrorActionPreference = "Stop"
$TaskName = "LocalVault-Autostart"

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "    Removing LocalVault Automatic Startup         " -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Scheduled task '$TaskName' removed successfully." -ForegroundColor Green
} else {
    Write-Host "Task '$TaskName' was not found in Task Scheduler." -ForegroundColor DarkGray
}
