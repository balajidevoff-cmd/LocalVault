# LocalVault Remote Access Guide

LocalVault is designed to run directly on your Windows laptop with all file contents stored on your local SSD. This guide explains how to access your storage securely from outside your home network, specifically from your Android phone or a secondary browser.

---

## Architecture Overview

```
+-----------------------------------------------------------+
|                    Physical Windows Host                  |
|                                                           |
|   +-----------------------+     +---------------------+   |
|   |  FastAPI Backend API  |     |  Next.js Dashboard  |   |
|   |  (Port 8000)          |     |  (Port 3000)        |   |
|   +-----------+-----------+     +----------+----------+   |
|               |                            |              |
|   +-----------v-----------+     +----------v----------+   |
|   |  Local Storage Engine |     |   SQLite Database   |   |
|   |  (data/storage/...)   |     |   (data/db/...)     |   |
|   +-----------------------+     +---------------------+   |
+-----------------------------------------------------------+
                              ^
                              | Encrypted WireGuard Tunnel
                              | (No Port Forwarding Required)
+-----------------------------+-----------------------------+
|                     Tailscale Mesh Network                |
|                                                           |
|    +----------------------+       +-------------------+   |
|    | Windows Laptop Node  | <---> | Android Phone     |   |
|    | (100.x.y.z)          |       | (LocalVault App)  |   |
|    +----------------------+       +-------------------+   |
+-----------------------------------------------------------+
```

---

## Option 1: Tailscale Private Mesh VPN (Recommended)

Tailscale provides an encrypted WireGuard-based overlay network between your Windows laptop and your Android phone.

### Why Tailscale?
1. **Zero Open Ports**: You do **not** need to configure router port forwarding or disable the Windows Defender Firewall.
2. **Private Identity**: Only devices signed into your personal Tailscale account can communicate with your server.
3. **Works Anywhere**: Mobile data (4G/5G), coffee shop Wi-Fi, or hotel networks.

### Step 1: Install Tailscale on your Windows Laptop
1. Download Tailscale for Windows from [tailscale.com/download/windows](https://tailscale.com/download/windows).
2. Install and log in with your account (Google, Microsoft, GitHub, or Apple).
3. Open Windows PowerShell and run:
   ```powershell
   tailscale ip -4
   ```
   Note your Tailscale IPv4 address (e.g. `100.85.120.45`) or your machine's MagicDNS name (e.g. `my-laptop.tailnet-name.ts.net`).

### Step 2: Bind LocalVault Backend to all Interfaces or Tailscale IP
By default, LocalVault development servers bind to `127.0.0.1` (localhost). To allow your Tailscale-connected Android phone to reach the server, bind to `0.0.0.0` or your Tailscale IP:
```powershell
.\scripts\start.ps1 -Host "0.0.0.0"
```
Or start Uvicorn directly:
```powershell
.\backend\.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Step 3: Enable HTTPS via Tailscale Serve (Optional & Recommended)
Tailscale includes a built-in feature called **Tailscale Serve** that automatically generates a trusted Let's Encrypt TLS certificate for your MagicDNS hostname:
```powershell
tailscale serve https / http://127.0.0.1:8000
```
This gives you a real HTTPS URL like `https://my-laptop.tailnet-name.ts.net/` without opening any firewall ports!

### Step 4: Connect from your Android Phone
1. Install **Tailscale** from the Google Play Store on your Android device and log into the **same** account.
2. Open the **LocalVault Android App**.
3. In the Server Base URL field, enter:
   - If using Tailscale Serve: `https://my-laptop.tailnet-name.ts.net/api/v1`
   - If using direct IP: `http://100.85.120.45:8000/api/v1`
4. Tap **Test**. When verified, enter your credentials and log in.

---

## Option 2: Cloudflare Tunnel (Optional for Custom Domain)

If you wish to access LocalVault via a public custom domain (e.g. `vault.yourdomain.com`) without opening router ports:

### Requirements:
- A custom domain registered or managed on Cloudflare DNS.
- Cloudflare zero-trust account (free tier).

### Instructions:
1. Download `cloudflared` for Windows from [developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
2. Authenticate `cloudflared`:
   ```powershell
   cloudflared tunnel login
   ```
3. Create a tunnel:
   ```powershell
   cloudflared tunnel create localvault-tunnel
   ```
4. Create a config file `config.yml`:
   ```yaml
   tunnel: <TUNNEL_UUID>
   credentials-file: C:\Users\<Username>\.cloudflared\<TUNNEL_UUID>.json

   ingress:
     - hostname: vault.yourdomain.com
       service: http://127.0.0.1:3000
     - hostname: api-vault.yourdomain.com
       service: http://127.0.0.1:8000
     - service: http_status:404
   ```
5. Configure DNS routing:
   ```powershell
   cloudflared tunnel route dns localvault-tunnel vault.yourdomain.com
   cloudflared tunnel route dns localvault-tunnel api-vault.yourdomain.com
   ```
6. Run the tunnel:
   ```powershell
   cloudflared tunnel run localvault-tunnel
   ```

> [!WARNING]
> Exposing your storage server to the public internet creates external attack surface. Always enforce strict rate limiting, strong Argon2id passwords, and consider adding Cloudflare Access (Zero Trust SSO) in front of your domain.

---

## Security Best Practices
- Never port-forward port 8000 or port 3000 on your home router directly to the internet.
- Keep Windows Defender Firewall enabled.
- Keep your JWT `SECRET_KEY` private and regenerate it when moving to production.
- Keep laptop storage backup procedures active.
