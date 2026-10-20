<#
.SYNOPSIS
    LocalVault - Windows Task Scheduler Auto-Start Installer
.DESCRIPTION
    Registers a Windows Scheduled Task ('LocalVault-Autostart') that launches
    the LocalVault backend and Cloudflare Tunnel automatically whenever you log in.
#>

[CmdletBinding()]
param (
    [switch]$QuickTunnel
)

$ErrorActionPreference = "Stop"
$TaskName = "LocalVault-Autostart"
$RootDir = Split-Path -Parent $PSScriptRoot
$StartupScript = Join-Path $PSScriptRoot "startup-service.ps1"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "    Installing LocalVault Automatic Startup       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

if (-not (Test-Path $StartupScript)) {
    Write-Error "Startup script not found at: $StartupScript"
    exit 1
}

$VbsLauncher = Join-Path $PSScriptRoot "run-hidden.vbs"
if (-not (Test-Path $VbsLauncher)) {
    Write-Error "Launcher script not found at: $VbsLauncher"
    exit 1
}

$vbsArgs = "`"$VbsLauncher`""
if ($QuickTunnel) {
    $vbsArgs += " -QuickTunnel"
}

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument $vbsArgs -WorkingDirectory $RootDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Task settings: do not stop on battery, restart on failure, unlimited execution time
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

$description = "Starts LocalVault FastAPI backend and Cloudflare Tunnel on user logon."

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Updating existing scheduled task '$TaskName'..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description $description `
    -User $env:USERNAME `
    | Out-Null

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Scheduled Task Installed Successfully!           " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Task Name:  $TaskName                            " -ForegroundColor Cyan
Write-Host " Trigger:    When user '$env:USERNAME' logs on    " -ForegroundColor White
Write-Host " Action:     $StartupScript                       " -ForegroundColor White
Write-Host ""
Write-Host " To verify in Windows, run: taskschd.msc          " -ForegroundColor DarkGray
Write-Host " To test-run the task immediately:                " -ForegroundColor Yellow
Write-Host "   Start-ScheduledTask -TaskName `"$TaskName`"      " -ForegroundColor Cyan
Write-Host " To view service logs:                            " -ForegroundColor Yellow
Write-Host "   Get-Content `"$RootDir\logs\service.log`" -Tail 20 -Wait " -ForegroundColor Cyan
Write-Host " To remove auto-start:                            " -ForegroundColor Yellow
Write-Host "   .\scripts\uninstall-autostart.ps1              " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Green
