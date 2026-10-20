<#
.SYNOPSIS
    LocalVault - Persistent Named Cloudflare Tunnel Setup Tool
.DESCRIPTION
    Interactively guides the user through authenticating with Cloudflare,
    creating a persistent named tunnel, configuring local ingress to FastAPI,
    and routing a permanent custom hostname (e.g., vault.yourdomain.com).
#>

[CmdletBinding()]
param (
    [string]$TunnelName = "localvault",
    [string]$Hostname = "",
    [int]$BackendPort = 8000
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
$TunnelConfigDir = Join-Path $RootDir "config\tunnel"
$ConfigFile = Join-Path $TunnelConfigDir "config.yml"
$TunnelInfoFile = Join-Path $TunnelConfigDir "tunnel_info.json"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "    LocalVault Persistent Cloudflare Tunnel Setup  " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Locate cloudflared executable
Write-Host "`n[Step 1/5] Verifying cloudflared executable..." -ForegroundColor Yellow
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
    Write-Error "cloudflared is not installed. Please run: winget install --id Cloudflare.cloudflared -e"
    exit 1
}

$cfVersion = (& $cloudflaredExe --version)
Write-Host "Found: $cfVersion at $cloudflaredExe" -ForegroundColor Green

# 2. Check Cloudflare Authentication (cert.pem)
Write-Host "`n[Step 2/5] Checking Cloudflare account authentication..." -ForegroundColor Yellow
$defaultCertPath = Join-Path $env:USERPROFILE ".cloudflared\cert.pem"

if (-not (Test-Path $defaultCertPath)) {
    Write-Host ""
    Write-Host "--------------------------------------------------" -ForegroundColor DarkYellow
    Write-Host "PREREQUISITE FOR A PERSISTENT NAMED TUNNEL:" -ForegroundColor Yellow
    Write-Host "1. A free Cloudflare account (https://dash.cloudflare.com)." -ForegroundColor White
    Write-Host "2. An active domain added to Cloudflare (e.g. yourdomain.com)." -ForegroundColor White
    Write-Host "--------------------------------------------------" -ForegroundColor DarkYellow
    Write-Host ""
    Write-Host "No active Cloudflare session was found at: $defaultCertPath" -ForegroundColor DarkGray
    Write-Host "Running 'cloudflared tunnel login' will open your browser so you can" -ForegroundColor White
    Write-Host "select your domain and authorize Cloudflare on this laptop." -ForegroundColor White
    Write-Host ""
    $doLogin = Read-Host "Would you like to log in to Cloudflare now? (Y/N)"
    if ($doLogin -match "^[Yy]") {
        Write-Host "Opening browser for Cloudflare authentication..." -ForegroundColor Cyan
        & $cloudflaredExe tunnel login
        Start-Sleep -Seconds 3
    } else {
        Write-Warning "Cloudflare authentication skipped. You can log in manually by running:"
        Write-Host "  & `"$cloudflaredExe`" tunnel login" -ForegroundColor White
        Write-Host ""
        Write-Host "Until a named tunnel is configured, you can use quick temporary tunnels:" -ForegroundColor DarkGray
        Write-Host "  & `"$cloudflaredExe`" tunnel --url http://127.0.0.1:$BackendPort" -ForegroundColor DarkGray
        exit 0
    }
}

if (-not (Test-Path $defaultCertPath)) {
    Write-Error "Cloudflare certificate ($defaultCertPath) was not detected. Please complete the browser login and run this script again."
    exit 1
}

Write-Host "Cloudflare certificate found: $defaultCertPath" -ForegroundColor Green

# 3. Create or Select Named Tunnel
Write-Host "`n[Step 3/5] Configuring Named Tunnel '$TunnelName'..." -ForegroundColor Yellow

$tunnelListRaw = (& $cloudflaredExe tunnel list 2>&1) | Out-String
$existingTunnelId = $null

if ($tunnelListRaw -match "$TunnelName\s+([a-f0-9\-]+)") {
    $existingTunnelId = $matches[1]
    Write-Host "Found existing tunnel '$TunnelName' with ID: $existingTunnelId" -ForegroundColor Green
} else {
    Write-Host "Creating new named tunnel '$TunnelName'..." -ForegroundColor Cyan
    $createOutput = (& $cloudflaredExe tunnel create $TunnelName 2>&1) | Out-String
    if ($createOutput -match "([a-f0-9]{8}\-[a-f0-9]{4}\-[a-f0-9]{4}\-[a-f0-9]{4}\-[a-f0-9]{12})") {
        $existingTunnelId = $matches[1]
        Write-Host "Tunnel created successfully! ID: $existingTunnelId" -ForegroundColor Green
    } else {
        Write-Error "Failed to create tunnel: $createOutput"
        exit 1
    }
}

$credentialsFile = Join-Path $env:USERPROFILE ".cloudflared\$existingTunnelId.json"
if (-not (Test-Path $credentialsFile)) {
    Write-Error "Credentials file not found at: $credentialsFile"
    exit 1
}

# 4. Hostname Configuration & Ingress Rules
Write-Host "`n[Step 4/5] Configuring stable domain hostname..." -ForegroundColor Yellow
if (-not $Hostname) {
    Write-Host "Please enter the full custom hostname you want to assign to LocalVault." -ForegroundColor White
    Write-Host "Example: vault.yourdomain.com or storage.yourdomain.com" -ForegroundColor DarkGray
    $Hostname = Read-Host "Hostname"
}

if (-not $Hostname -or $Hostname -notmatch "\.") {
    Write-Error "Invalid hostname '$Hostname'. A valid domain name with an extension is required (e.g. vault.yourdomain.com)."
    exit 1
}

$Hostname = $Hostname.Trim().ToLower()

# Ensure config directory exists
if (-not (Test-Path $TunnelConfigDir)) {
    New-Item -ItemType Directory -Force -Path $TunnelConfigDir | Out-Null
}

# Generate config.yml
$yamlContent = @"
tunnel: $existingTunnelId
credentials-file: "$credentialsFile"

ingress:
  - hostname: $Hostname
    service: http://127.0.0.1:$BackendPort
    originRequest:
      noTLSVerify: true
  - service: http_status:404
"@

Set-Content -Path $ConfigFile -Value $yamlContent -Encoding utf8
Write-Host "Generated configuration file: $ConfigFile" -ForegroundColor Green

# 5. Route DNS in Cloudflare
Write-Host "`n[Step 5/5] Routing DNS record in Cloudflare..." -ForegroundColor Yellow
Write-Host "Running: cloudflared tunnel route dns $TunnelName $Hostname" -ForegroundColor Cyan
$routeOutput = (& $cloudflaredExe tunnel route dns $TunnelName $Hostname 2>&1) | Out-String
Write-Host $routeOutput.Trim() -ForegroundColor DarkGray

# Save metadata
$tunnelInfo = @{
    tunnel_name = $TunnelName
    tunnel_id = $existingTunnelId
    hostname = $Hostname
    credentials_file = $credentialsFile
    config_file = $ConfigFile
    backend_url = "http://127.0.0.1:$BackendPort"
    api_url = "https://$Hostname/api/v1"
    configured_at = (Get-Date -Format "o")
} | ConvertTo-Json -Depth 4

Set-Content -Path $TunnelInfoFile -Value $tunnelInfo -Encoding utf8

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Named Tunnel Configuration Completed!           " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Tunnel Name:       $TunnelName                   " -ForegroundColor Cyan
Write-Host " Tunnel ID:         $existingTunnelId             " -ForegroundColor DarkGray
Write-Host " Stable Public URL: https://$Hostname             " -ForegroundColor Yellow
Write-Host " API Endpoint:      https://$Hostname/api/v1      " -ForegroundColor Green
Write-Host ""
Write-Host " NEXT STEP IN VERCEL:" -ForegroundColor Yellow
Write-Host " 1. Go to your Vercel Project Settings -> Environment Variables." -ForegroundColor White
Write-Host " 2. Add or update:" -ForegroundColor White
Write-Host "    NEXT_PUBLIC_API_URL = https://$Hostname/api/v1" -ForegroundColor Cyan
Write-Host " 3. Trigger a redeploy on Vercel." -ForegroundColor White
Write-Host ""
Write-Host " To start the tunnel now, run:" -ForegroundColor Yellow
Write-Host "   & `"$cloudflaredExe`" tunnel --config `"$ConfigFile`" run" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Green
