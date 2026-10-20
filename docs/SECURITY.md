# LocalVault Security & Hardening Architecture

LocalVault is engineered with defense-in-depth principles to protect private data stored on a personal Windows laptop.

---

## 1. Authentication & Session Security

### Password Hashing (Argon2id)
- Passwords are never stored in plaintext.
- We utilize **Argon2id** (the state-of-the-art winner of the Password Hashing Competition) configured with:
  - Time Cost: 3 iterations
  - Memory Cost: 64 MB (65,536 KB)
  - Parallelism: 4 lanes
  - Salt Length: 16 bytes
- Resistant to GPU and ASIC brute-force attacks.

### Token Architecture
- **Short-Lived Access Tokens**: Signed JWTs with a 30-minute lifespan.
- **Revocable Refresh Tokens**:
  - Raw tokens are 48-byte cryptographically secure pseudorandom strings (`secrets.token_urlsafe(48)`).
  - Only the **SHA-256 hash** of the refresh token is stored in the database (`refresh_sessions` table).
  - Even if the database file is read, raw tokens cannot be recovered or used.
  - Refresh tokens are rotated upon each renewal.
  - Changing a password immediately revokes all active sessions for that user.

### Cookie Hardening (Web)
- Browser authentication uses `HttpOnly`, `SameSite=Lax`, and `Secure` (in production) cookies.
- JavaScript cannot read or exfiltrate session tokens via XSS.

### Android Credential Storage
- The Android client stores credentials in **Expo SecureStore**, which interfaces directly with the hardware-backed Android Keystore system.

---

## 2. Filesystem & Storage Engine Hardening

### Path Traversal Defense
- Physical file paths are **never** constructed from user-provided filenames or folder names.
- Each uploaded file is assigned an internal, random UUID hex key (e.g. `911a51f4e55c442588cee0745eb9b4c7`).
- Files are sub-sharded inside `data/storage/objects/ab/cd/abcdef...` within the storage root.
- Strict canonical path containment checks verify that any resolved file path remains strictly inside the configured storage root directory (`path.relative_to(storage_root)`).
- Filenames containing `../`, `..\\`, null bytes `\x00`, control characters, or Windows-reserved characters are stripped and sanitized using `sanitize_filename`.

### Atomic File Writes
- Incoming uploads are streamed into temporary files (`.tmp`) in a staging folder.
- SHA-256 is computed concurrently during the stream.
- Only upon complete, verified upload is the temporary file atomically moved into the permanent storage location (`os.replace`).
- If an upload fails or is interrupted, the partial temporary file is immediately unlinked.
- Background cleanup routines purge abandoned upload fragments older than 24 hours.

### Disk Quota & Space Protection
- Before accepting an upload, the storage engine verifies physical free disk space on the host volume using `shutil.disk_usage`.
- An enforced 200 MB physical safety margin prevents uploads from exhausting the host SSD and crashing the Windows OS.
- User quotas (e.g. 250 GB) are enforced during stream writes; if an upload exceeds the limit, it is aborted immediately with HTTP 507.

---

## 3. Secure File Delivery & Previews

### Safe Content-Disposition
- Downloads use `Content-Disposition: attachment; filename="safe_name.ext"`.
- Previews use `Content-Disposition: inline`.
- `X-Content-Type-Options: nosniff` header is strictly enforced across all file endpoints to prevent browsers from MIME-sniffing and executing binary payloads as HTML or scripts.

### Byte-Range Streaming
- File delivery is streamed in 1 MB chunks without buffering large files into RAM.
- RFC 7233 HTTP Range requests (`bytes=start-end`) are supported for resuming downloads and seeking within media files.

---

## 4. Public Share Security

- Public shares use unguessable 32-byte cryptographically secure random tokens.
- Similar to session tokens, only the SHA-256 hash of the share token is stored in the database.
- Owners can specify optional expiration timestamps and Argon2id password protection.
- Revoking a share link immediately invalidates access in real-time.

---

## 5. Rate Limiting & Throttling

- Sensitive endpoints (e.g., `/auth/login`, `/auth/register`, `/files/upload`) are protected by an in-memory sliding-window rate limiter to mitigate credential stuffing, brute force, and disk flood attacks.
