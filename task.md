
You are a senior full-stack software architect, Python backend engineer,
Next.js developer, Android developer, DevOps engineer, and application
security engineer.

Your task is to BUILD a complete, production-oriented, self-hosted cloud
storage application called "LocalVault".

IMPORTANT:
Do not merely describe the implementation or generate a static UI.
Create the actual project files, implement working functionality, run
available tests, fix errors, and document how to launch the application.

Work directly in the current project workspace. Inspect existing files
before modifying them. Preserve useful existing work. If the workspace
is empty, initialize the project from scratch.

Do not stop after creating a plan or completing the frontend. Continue
through the backend, database, file operations, web app, Android app,
testing, and deployment documentation. If a component cannot be completed
in the current environment, explain the blocker and provide a functional,
testable implementation wherever possible.

==================================================
1. PROJECT VISION
==================================================

Build a personal cloud storage platform inspired by the usability of
Google Drive, Dropbox, and TeraBox.

The difference is that users own and operate their storage server.

Primary storage device:
- A Windows laptop with a 512 GB SSD.
- Actual uploaded file contents must be stored on the laptop's local disk.
- Do not use Firebase Storage, AWS S3, Supabase Storage, Google Cloud
  Storage, or another cloud object-storage provider for primary storage.
- The database must store metadata, not the actual file contents.
- Allow the administrator to configure the storage directory.
- Make the storage path configurable using environment variables.
- Support Windows paths and pathlib correctly.

Applications:
1. Responsive web application.
2. Android application.
3. Python backend API.
4. Local filesystem storage engine.
5. Local metadata database.
6. Secure remote access to the self-hosted server.

Project name: LocalVault
Initial tagline: "Your files. Your storage. Your control."

The system must be useful for personal use first, with a clean architecture
that can support multiple authorized users later.

Do not claim that the application has been tested or deployed unless that
actually happened.

==================================================
2. REQUIRED TECHNOLOGY STACK
==================================================

Web frontend:
- Next.js using the App Router.
- TypeScript with strict mode.
- Tailwind CSS.
- Lucide React icons.
- React Hook Form and Zod where useful.
- TanStack Query or an equally appropriate data-fetching solution.
- A reusable component architecture.

Backend:
- Python 3.12 or another supported stable Python version.
- FastAPI.
- Uvicorn.
- Pydantic settings.
- SQLAlchemy 2.x.
- SQLite for the initial single-server deployment.
- Alembic migrations.
- Pytest and HTTPX for automated testing.

Android:
- Expo.
- React Native.
- TypeScript.
- Expo Router.
- Expo Document Picker.
- Expo File System, using APIs supported by the installed SDK.
- Expo Secure Store for sensitive client-side credentials.
- Image and video previews where supported.

Infrastructure:
- Git.
- Environment variables.
- Docker Compose for the backend where practical.
- A native Windows development mode that works without Docker.
- Tailscale for private remote access.
- Optional Cloudflare Tunnel for a later, carefully secured public-access
  deployment.
- A written backup and recovery procedure.

Use compatible, maintained package versions. Inspect the available runtime
and documentation before choosing APIs. Avoid deprecated libraries and
unnecessary dependencies.

Do not make the Android application depend on localhost when it is running
on a real phone.

==================================================
3. REPOSITORY STRUCTURE
==================================================

Create a clean monorepo:

LocalVault/
  apps/
    web/
      src/
        app/
        components/
        features/
        hooks/
        lib/
        types/
      public/
      package.json
      .env.example

    android/
      app/
      src/
        components/
        features/
        hooks/
        lib/
        types/
      assets/
      app.json
      package.json

  backend/
    app/
      main.py
      core/
        config.py
        security.py
        logging_config.py
      api/
        dependencies.py
        routes/
          auth.py
          users.py
          files.py
          folders.py
          search.py
          sharing.py
          storage.py
          health.py
      models/
      schemas/
      services/
        auth_service.py
        file_service.py
        storage_service.py
        folder_service.py
        sharing_service.py
      repositories/
      db/
        database.py
        migrations/
      middleware/
      tests/
    requirements.txt
    pyproject.toml
    .env.example

  data/
    .gitkeep

  scripts/
    setup.ps1
    start.ps1
    stop.ps1
    backup.ps1
    restore.ps1

  docs/
    ARCHITECTURE.md
    INSTALLATION.md
    API.md
    SECURITY.md
    BACKUP_AND_RECOVERY.md
    REMOTE_ACCESS.md
    ANDROID_BUILD.md
    TROUBLESHOOTING.md

  docker-compose.yml
  .gitignore
  .editorconfig
  README.md

Adjust this structure if a more maintainable arrangement is necessary,
but preserve the separation between web, mobile, backend, and storage.

Keep uploaded files, database files, credentials, private keys, logs
containing sensitive data, and backups out of Git.

==================================================
4. LOCAL STORAGE ENGINE
==================================================

Implement a reliable local filesystem storage engine.

Requirements:

- Configurable storage root through LOCALVAULT_STORAGE_PATH.
- Windows-compatible path handling.
- Safe file creation and deletion.
- Folder hierarchy.
- File metadata in the database.
- File size and MIME type tracking.
- Upload timestamps and modification timestamps.
- File checksums, preferably SHA-256.
- Configurable maximum upload size.
- Configurable storage quota.
- Actual free-disk-space checks.
- Safe handling of filenames containing spaces, Unicode, and special
  characters.
- Correct handling of empty files.
- Streaming uploads and downloads.
- Atomic file placement after upload completion.
- Temporary upload files that are cleaned up after failures.
- Detection and reporting of incomplete uploads.
- Duplicate filenames handled without accidentally overwriting files.
- Storage usage calculations.
- Correct cleanup of database records and physical files.
- File integrity checks.

Never construct physical paths directly from an untrusted user-provided
filename or folder path.

Use generated internal storage identifiers for physical files when
appropriate. Store the original filename as metadata.

Prevent path traversal, symlink escape where applicable, and access to
files outside the configured storage root.

Do not load entire large files into RAM.

Use a configurable initial personal storage quota, for example 250 GB,
while keeping the application limited by actual disk capacity.

Do not automatically claim the entire 512 GB SSD is available. Account
for Windows, applications, filesystem overhead, and other personal data.

Allow an administrator to change the quota through a documented
configuration setting.

==================================================
5. DATABASE DESIGN
==================================================

Implement database models and migrations for:

User:
- id
- username
- email
- password_hash
- role
- is_active
- created_at
- updated_at
- last_login_at

File:
- id
- owner_id
- folder_id
- original_name
- internal_storage_key
- mime_type
- size_bytes
- checksum_sha256
- created_at
- updated_at
- deleted_at, if implementing a trash feature

Folder:
- id
- owner_id
- parent_folder_id
- name
- created_at
- updated_at

RefreshSession or equivalent:
- id
- user_id
- securely stored token hash
- expiration time
- revocation time
- created_at

ShareLink:
- id
- file_id
- owner_id
- securely stored token hash
- expiration time
- optional password hash
- permission
- revoked_at
- created_at

Add any additional tables needed for resumable uploads, audit events,
storage settings, or sharing permissions.

Requirements:
- Foreign keys and appropriate indexes.
- Database migrations.
- Transactions for related database changes.
- Explicit ownership constraints.
- Safe deletion and recovery procedures.
- Never store plaintext passwords.
- Never store raw long-lived refresh tokens unnecessarily.
- Avoid storing public share tokens in plaintext when a token hash is
  sufficient.
- Make SQLite foreign key enforcement explicit.
- Handle database locking and transactions appropriately.

==================================================
6. AUTHENTICATION AND AUTHORIZATION
==================================================

Implement working authentication.

Required features:
- Registration, configurable for initial setup.
- Login.
- Logout.
- Current-user endpoint.
- Password change.
- Account activation and deactivation.
- Administrator role.
- Secure session or token refresh.
- Session revocation.
- Password validation.
- Login throttling.
- Rate limiting on sensitive endpoints.
- Safe error messages.
- CORS allowlist configured using environment variables.

Use a modern password hashing algorithm such as Argon2id through a
maintained implementation.

Use a secure authentication design suitable for both browser and mobile
clients.

For browser authentication, prefer secure, HttpOnly cookies with
appropriate SameSite and Secure settings in production, and implement
CSRF protection when required by the chosen cookie design.

For Android, use an appropriate short-lived access credential and a
rotatable, revocable refresh mechanism. Store credentials securely with
Expo Secure Store.

Do not put long-lived credentials in localStorage, source code, URLs,
logs, or ordinary application settings.

Implement authorization checks on every protected backend endpoint.

Users must only see and operate on their own files and folders unless
they have an explicitly authorized share or administrator permission.

An unguessable file ID is not a replacement for authorization.

Do not allow public registration to create administrator accounts.

Provide a safe first-run administrator setup procedure. Do not hardcode
administrator credentials.

==================================================
7. FILE API
==================================================

Implement working, documented endpoints for:

Authentication:
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- POST /api/v1/auth/refresh
- GET  /api/v1/auth/me
- POST /api/v1/auth/change-password

Files:
- POST   /api/v1/files/upload
- GET    /api/v1/files
- GET    /api/v1/files/{file_id}
- GET    /api/v1/files/{file_id}/download
- GET    /api/v1/files/{file_id}/preview
- PATCH  /api/v1/files/{file_id}
- DELETE /api/v1/files/{file_id}

Folders:
- POST   /api/v1/folders
- GET    /api/v1/folders/{folder_id}
- PATCH  /api/v1/folders/{folder_id}
- DELETE /api/v1/folders/{folder_id}

Search and storage:
- GET /api/v1/search
- GET /api/v1/storage/usage
- GET /api/v1/storage/status
- GET /api/v1/health

Sharing:
- POST   /api/v1/shares
- GET    /api/v1/shares
- DELETE /api/v1/shares/{share_id}
- GET    /api/v1/public/shares/{token}
- GET    /api/v1/public/shares/{token}/download

Use consistent response schemas, pagination, validation, and appropriate
HTTP status codes.

Adapt route semantics if necessary, but document the final API.

For large files:
- Stream downloads.
- Avoid reading full files into memory.
- Support byte-range downloads when feasible.
- Implement upload size checks.
- Do not trust MIME types supplied by clients.
- Use safe Content-Disposition headers.
- Prevent execution of uploaded files.
- Do not serve arbitrary local filesystem paths.
- Prevent uploads from filling the disk unexpectedly.

Make upload and database operations robust against partial failures.

Implement resumable uploads as a separate, documented feature if the
initial upload implementation can be completed and tested first.

==================================================
8. WEB APPLICATION UI
==================================================

Build a polished, professional cloud storage dashboard.

Design direction:
- Modern SaaS interface.
- Clean typography.
- Subtle borders and shadows.
- Rounded cards.
- Good spacing.
- Lucide icons.
- Light and dark themes.
- Responsive desktop, tablet, and mobile layouts.
- Accessible colors and keyboard navigation.
- Avoid excessive gradients and unnecessary animations.

Main layout:
- Left sidebar.
- Top navigation and search.
- Main file workspace.
- Optional details panel.
- Toast notifications.
- Loading, empty, and error states.

Pages:
1. Login.
2. Registration, if enabled.
3. First-run setup.
4. Dashboard.
5. My Files.
6. Folder view.
7. Recent files.
8. Starred files.
9. Trash, if implemented.
10. Shared links.
11. Storage analytics.
12. Settings.
13. Account and security settings.
14. Administrator settings.

Dashboard components:
- Storage used / total quota.
- Number of files.
- Recent uploads.
- Recent files.
- File type distribution.
- Upload progress.
- Quick upload button.
- Quick access to folders.

File manager:
- Grid and list views.
- File and folder icons.
- Breadcrumb navigation.
- Sorting by name, date, type, and size.
- Search by filename.
- File selection.
- Multi-file download where practical.
- Rename.
- Delete.
- Restore from trash if supported.
- Star/unstar.
- Preview.
- Upload progress and cancellation.
- Drag-and-drop upload.
- Context menus.
- Confirmation before destructive operations.

Preview support:
- Images.
- PDFs.
- Text files.
- Audio and video using browser-supported playback.
- Download fallback for unsupported file formats.

Security:
- Do not embed arbitrary uploaded HTML or SVG as trusted application
  content.
- Serve previews safely.
- Avoid cross-site scripting.
- Do not expose storage paths in the interface.
- Never trust the frontend to enforce permissions.

Every button must have a real implemented action. Do not leave placeholder
buttons or fake dashboard statistics in the final application.

Use real API data. Show honest empty states when there is no data.

==================================================
9. ANDROID APPLICATION
==================================================

Build a real Android client using Expo and React Native.

Features:
- Login and logout.
- Secure credential storage.
- Dashboard.
- Folder navigation.
- File search.
- Upload from Android's document picker.
- Download files.
- View images and PDFs where supported.
- Open unsupported files with compatible external applications.
- Upload progress.
- Download progress.
- Retry failed transfers.
- Cancellation where supported.
- File details.
- Storage usage.
- Rename and delete with confirmation.
- Share-link creation and revocation.
- Settings and server connection status.

Use a configurable server base URL.

Support:
- Development API address on a local network.
- Private Tailscale address for remote personal access.
- HTTPS domain for optional public access.

Do not hardcode a LAN address or Tailscale address in production code.

Add a settings field for the server address with validation.

Use native secure storage for credentials. Handle network failures and
expired sessions without crashing.

Do not attempt to make the Android app connect to the Windows laptop
through localhost.

Document the process to create an installable Android APK using an
appropriate Expo build workflow.

If a mobile SDK or build environment is unavailable, still create and
validate the application source as far as possible and document exactly
what remains to be built.

==================================================
10. REMOTE INTERNET ACCESS
==================================================

The Windows laptop is the storage server.

Implement a deployment architecture that keeps file storage local.

First option: private Tailscale access.

Requirements:
- Install and configure Tailscale separately on the Windows host and
  Android device.
- Use the server's private Tailscale address or supported hostname.
- Configure the backend to be reachable only through an appropriate
  private interface or protected reverse proxy.
- Use an HTTPS endpoint when required for browser and mobile security.
- Do not expose SQLite, the filesystem, or administrative endpoints.
- Do not expose an unauthenticated development server.
- Document access policies and troubleshooting.

Do not assume Tailscale automatically provides HTTPS for every arbitrary
IP address or application endpoint. Explain the actual configuration
required by the selected setup.

Optional second option: Cloudflare Tunnel and a custom domain.

If implemented:
- Use a named tunnel and documented DNS configuration.
- Do not commit tunnel tokens or credentials.
- Keep origin services bound to localhost or otherwise appropriately
  restricted.
- Configure HTTPS.
- Protect the application with its own authentication.
- Add rate limits and upload limits.
- Never bypass application authorization merely because a user passed
  through an access gateway.
- Explain that public access increases attack exposure.

Never automatically configure router port forwarding, disable the
Windows firewall, or publish the backend to the entire internet.

The application should continue working locally if the remote-access
service is unavailable.

==================================================
11. WINDOWS STARTUP AND OPERATION
==================================================

Provide PowerShell scripts to:

- Check prerequisites.
- Create the Python virtual environment.
- Install backend dependencies.
- Install frontend dependencies.
- Initialize the database.
- Run database migrations.
- Create the first administrator safely.
- Start the backend.
- Start the frontend.
- Stop development processes.
- Check server health.
- Display storage usage.
- Back up application metadata and uploaded files.
- Restore from a backup.

Create a clear native Windows setup that works without Docker.

Docker Compose may be provided as an additional option. If used, mount
the storage directory and database directory as persistent volumes.

Do not store uploaded files inside an ephemeral container filesystem.

Document Windows path and permission issues.

Ensure that the server can be restarted without losing files or
metadata. Document how to configure automatic startup safely.

Do not claim automatic startup or a Windows service has been configured
unless it has actually been configured and verified.

==================================================
12. BACKUP AND DATA RECOVERY
==================================================

Implement and document backup procedures.

Requirements:
- Backup metadata consistently.
- Backup uploaded files.
- Include configuration instructions without including secrets.
- Use a backup destination separate from the primary storage directory.
- Verify backup integrity.
- Include a restore procedure.
- Explain the consistency requirements when backing up SQLite.
- Test restoration into a separate directory.
- Avoid overwriting existing data without explicit confirmation.

A backup stored only on the same physical SSD is not sufficient
protection against SSD failure.

Explain the difference between synchronization, backup, and redundancy.

Do not implement destructive automatic cleanup without explicit
configuration.

==================================================
13. SECURITY TESTING
==================================================

Write automated tests for:
- Authentication.
- Invalid credentials.
- Expired and revoked sessions.
- File upload and download.
- File size limits.
- Storage quotas.
- Folder creation and navigation.
- Rename and delete.
- Unauthorized file access.
- Unauthorized folder access.
- Cross-user access attempts.
- Path traversal.
- Malicious filenames.
- Unexpected MIME types.
- Missing files.
- Interrupted uploads.
- Storage usage calculations.
- Share-link expiration and revocation.
- Rate limiting on sensitive operations.
- Database consistency.

Test that one user cannot access another user's private files by changing
an ID in the API request.

Test that filenames such as ../../outside.txt cannot escape the storage
root.

Use temporary directories and test databases.

Do not perform destructive tests against real user files.

Fix the failures that can be reproduced. If a test cannot be run, state
why rather than claiming that it passed.

==================================================
14. PERFORMANCE AND RELIABILITY
==================================================

Optimize for a single-user self-hosted Windows laptop.

Requirements:
- Streaming file transfers.
- Efficient directory listings.
- Database indexes.
- Paginated API results.
- Sensible request timeouts.
- Cancellation and cleanup for failed uploads.
- Progress reporting.
- Structured logging without credentials or file contents.
- Clear error messages.
- Storage and health monitoring.
- Graceful shutdown.
- Reasonable concurrency limits.
- No unnecessary background processes.

Do not introduce microservices, Kubernetes, Redis, or external cloud
infrastructure unless a demonstrated requirement justifies them.

The first release should be simple to install and maintain.

==================================================
15. TESTING AND COMPLETION CRITERIA
==================================================

After implementation:

1. Inspect the project structure.
2. Install dependencies using the available environment.
3. Run Python syntax checks and backend tests.
4. Run database migrations.
5. Test the health endpoint.
6. Test upload, listing, download, rename, and deletion.
7. Confirm actual file contents are stored in the configured local folder.
8. Confirm file metadata is stored in SQLite.
9. Test authentication and cross-user access restrictions.
10. Run frontend linting and type checking.
11. Build the web application where the environment allows.
12. Validate the Android application source and configuration.
13. Run available Android build checks.
14. Fix errors that can be reproduced.
15. Update the README and documentation to match the actual implementation.

A feature is complete only when its behavior is implemented and
appropriately tested. Do not substitute mocked responses for real
functionality.

If dependencies cannot be installed because internet access or the
environment is unavailable, explain the limitation and continue with
checks that can be performed.

==================================================
16. DOCUMENTATION
==================================================

Create a useful README containing:

- Project overview.
- Features.
- Architecture.
- Requirements.
- Windows installation.
- Backend setup.
- Frontend setup.
- Database initialization.
- First administrator setup.
- Storage path configuration.
- How to run the application.
- How to run tests.
- Android setup.
- APK build instructions.
- Tailscale setup.
- Optional public access setup.
- Backup and recovery.
- Troubleshooting.
- Security considerations.
- Current limitations.

Provide example environment files with safe placeholders.

Never put real secrets in example files.

Explain all environment variables and defaults.

==================================================
17. IMPLEMENTATION WORKFLOW
==================================================

Work in the following sequence:

Phase 1: Inspect the environment and create the project structure.

Phase 2: Implement configuration, database, migrations, and storage
engine.

Phase 3: Implement authentication and authorization.

Phase 4: Implement and test file and folder APIs.

Phase 5: Build the Next.js frontend and connect it to the API.

Phase 6: Build the Expo Android client and connect it to the API.

Phase 7: Implement and document secure remote access.

Phase 8: Add backup, restore, Windows scripts, and deployment instructions.

Phase 9: Run available tests, fix issues, and verify the final workflow.

Maintain a concise implementation checklist and update it as tasks
are completed.

After each major phase:
- Run the relevant checks.
- Fix errors before moving on where possible.
- Summarize files created or changed.
- Explain what works.
- Identify any remaining blockers.

Do not stop to ask about minor design choices. Use sensible defaults.

Do not overwrite existing files without inspecting them first.

Do not delete user data.

Do not run destructive commands without explicit approval.

If the task exceeds one execution session, leave the repository in a
consistent state, update the checklist, and explain exactly where work
should resume.

==================================================
18. FINAL DELIVERABLE
==================================================

Deliver a working LocalVault project with:

- Web application.
- Android application source.
- Python API.
- Local filesystem storage engine.
- SQLite database and migrations.
- Authentication and authorization.
- Upload and download functionality.
- Folder management.
- Storage usage dashboard.
- Secure private remote-access instructions.
- Optional public deployment instructions.
- Windows startup and backup scripts.
- Automated tests.
- Installation and troubleshooting documentation.

The primary file contents must remain on the laptop's configured local
storage directory.

The system must not require a paid cloud-storage provider to store
files. Optional domains, remote-access services, internet connectivity,
or other third-party services may have their own terms and costs.

Start by inspecting the current workspace and creating an implementation
checklist. Then immediately begin implementing Phase 1 and continue
through the project in manageable, testable stages.
