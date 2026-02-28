# Changelog

All notable changes to this project will be documented in this file.
 
## [0.8.1] - 2026-02-28
 
### Fixed
- **Backup & Restore**: Fixed "Export All Data" button by replacing browser-style downloads with Tauri's native file saving dialog and commands.
 

## [0.8.0] - 2026-02-27

### Added
- **Environment Variable Manager**:
  - New **Env** tab in the Management Panel for comprehensive environment variable control.
  - View full list of server environment variables via `printenv`.
  - Add and Edit variables with persistent storage in `~/.bashrc`.
  - Securely delete variables from the shell profile.
  - Real-time search and filter for quick variable discovery.
  - Sanitized input handling to prevent shell injection.
- **Global Command Palette (`Ctrl+K`)**:
  - Massively expanded into a central command hub with 30+ searchable actions.
  - **Terminal Settings**: Live control over cursor styles (Block/Bar/Underline), font size, and performance monitoring.
  - **Layout & View**: Toggles for sidebar modes (Cards/Compact), global snippets panel, and SFTP browser.
  - **Management Tools**: Quick access to Server Monitor, Docker, Env, Network Tools, Tunnels, Cron, and Remote Key Manager.
  - **Tab Management**: Close active tab, split terminal horizontally, and cycle through tabs.
  - **System Actions**: Securely exit the application, check for updates, or focus sidebar search.
  - **SSH Connections**: Search and connect to saved profiles directly from the palette.

## [0.7.0] - 2026-02-27

### Added
- **Systemd Timer Management**:
  - New **Timers** tab integrated into the Server Monitor panel.
  - Real-time monitoring of scheduled tasks with columns for:
    - **Next Run**: When the timer will execute next.
    - **Left**: Time remaining until the next execution.
    - **Last Run**: When the timer last executed.
    - **Activates**: The service unit triggered by the timer.
  - Interactive controls: Start/Enable, Stop/Disable, and Restart timers directly from the UI.
  - Search and filter functionality for system timers.
  - Robust parsing of `systemctl list-timers` output to handle varying states (including `n/a`).

### Changed
- **UI Consistency**: Action buttons in **Service Manager** and **Timer Manager** are now always visible instead of hover-only, improving accessibility and tablet/touch compatibility.

## [0.6.2] - 2026-02-25

### Added
- **Network Tools - System Monitoring**:
  - **Processes**: Top processes by memory usage (`ps aux --sort=-%mem`)
  - **Services**: Running systemd services (`systemctl list-units --type=service --state=running`)
  - **OS Scan**: OS detection via nmap (`nmap -O --osscan-guess`)

## [0.6.1] - 2026-02-25

### Added
- **Network Tools Enhancements**:
  - Added 7 new diagnostic tools:
    - **ARP Table**: View local ARP cache (`arp -n`)
    - **Link Info**: View network interface link status (`ip -c link`)
    - **Route Get**: Get routing path to specific destination (`ip route get <target>`)
    - **Resolvectl**: Query systemd-resolved for DNS records
    - **Tcpdump**: Packet capture preview (requires sudo)
    - **Speedtest**: Internet speed test (speedtest-cli or Cloudflare API)
  - Tools organized into Diagnostics, Network, Security, and Advanced categories

## [0.6.0] - 2026-02-25

### Added
- **Docker Manager Enhancements**:
  - **Container Search & Filter**: Search containers by name, image, or ID with real-time filtering.
  - **State Filter**: Filter containers by state (All/Running/Stopped).
  - **Container Inspect**: New inspect modal to view detailed container information including:
    - Basic info (ID, name, image, created date, status, PID).
    - Environment variables (with copy functionality).
    - Mounts (type, source, destination).
    - Network settings (IP, gateway, MAC).
    - Health check status (healthy/unhealthy, failing streak, logs).
    - Full JSON export with one-click copy.
  - **Log Search/Filter**: New Logs tab with:
    - Container selection dropdown.
    - Search with regex support.
    - Line count selection (100/500/1000/2000).
    - Auto-scroll toggle.
    - Color-coded output (errors=red, warnings=yellow, info=blue).
    - Real-time statistics (total lines, errors, warnings, info).
  - **Network Management**: New Networks tab to:
    - List all Docker networks (bridge, host, none, custom).
    - Create new networks (bridge, host, none drivers).
    - Remove custom networks.
  - **Real-time Events**: New Events tab to:
    - Stream Docker events in real-time (2s polling).
    - Filter by type (container, image, volume, network).
    - Color-coded event types (start=green, stop=red, die=yellow).
    - Pause/resume auto-refresh.
  - **Docker Compose Integration**: Right-click context menu for docker-compose.yml files:
    - Start Compose (docker-compose up -d).
    - Stop Compose (docker-compose down).
    - Pause Compose.
    - Resume Compose.
    - View Services.
    - Visualize Compose (existing architecture diagram).
  - **Prune Options**: Redesigned prune button as dropdown:
    - Prune Containers.
    - Prune Networks.
    - Prune Images.
    - Prune Volumes.
    - System Prune (all).

- **Network Tools Revamp**:
  - **Categorized UI**: Completely refactored the Network Tools panel into a modern two-pane layout with a category-based sidebar.
  - **Expanded Tool Suite**: Added 16 new diagnostic and system tools, bringing the total to 32 integrated commands:
    - **Diagnostics**: `mtr`, `tracepath`, `nslookup`, `curl_timing`.
    - **Status**: `netstat`, `hostname_info`, `uptime`, `disk_usage`, `memory_usage`.
    - **Security**: `nmap`, `whois`, `fail2ban_status`, `last_logins`.
    - **Infrastructure**: `dns_config` (`resolv.conf`), `hosts_file`.
    - **Advanced**: `active_users`, `open_files` (`lsof`).
  - **Intelligent Execution**: Support for "Auto-run" tools that execute immediately upon selection without requiring target input (e.g., `uptime`, `netstat`).
  - **Improved Port Scanning**: Enhanced the built-in port scanner to cover a broader range of common service ports by default.
  - **Raw Output Rendering**: Implemented a generic fallback renderer for tools that provide complex text-based output.
- **SSH Key Manager**:
  - **Local Key Management**: Completely revamped local key store with dedicated management view.
  - **Key Fingerprinting**: Robust SHA256 fingerprinting for all local and remote keys using `ssh-keygen`.
  - **Security Auditing**: Improved remote `authorized_keys` view with detailed key analysis (type, bit-length, comment, and fingerprint).
  - **Visual Recognition**: Automatic detection and labeling of "Your Key" on remote servers by matching fingerprints.
  - **Expanded Algorithm Support**: Generate modern **ED25519** (recommended), RSA, or ECDSA key pairs with optional passphrases.
  - **Import Capabilities**: Enhanced private key import with support for encrypted keys.
  - **Atomic Deployment**: One-click public key deployment with automatic `.ssh` directory and permission management.
- **Cron Manager**:
  - View and manage cron jobs on remote servers via the Management Panel.
  - Create new cron jobs with preset schedules or custom expressions.
  - View cron history and logs in real-time.

### Changed
- **Network Tools UI**: Extracted the tool list into a sidebar to resolve horizontal overcrowding in the Management Panel.
- **Backend Validation**: Relaxed target sanitization to permit parameterless system commands like `uptime`.
- **UI Organization**: Removed the dedicated SSH Key button from the Sidebar to declutter the interface.
- **Modal Standardization**: Improved modal z-index handling and overlay interactions across all system-level modals.
- **API Resilience**: Updated key management backend to return structured metadata instead of raw strings.

### Technical
- Refactored `NetworkTools.tsx` with dynamic category-based sub-tab rendering.
- Updated `NetToolManager` in Rust to handle expanded command mapping and shell-escaped paths.
- Fixed TypeScript build errors (TS6133) by removing unused imports in the terminal components.
- Implemented `get_key_info` backend utility for piping key data to `ssh-keygen` for secure parsing.
- Refactored `get_remote_authorized_keys` to provide comprehensive `RemoteKey` metadata.
- Improved shell command escaping for remote `authorized_keys` modification.

## [0.5.0] - 2026-02-24

### Added
- **FileBrowser Enhancements**:
  - **Hidden Files Toggle**: Show/hide hidden files (starting with `.`) via toolbar button.
  - **Sorting**: Sort files by name, size, or date (ascending/descending). Folders always listed first.
  - **Create New File/Folder**: Toolbar buttons to create new files and folders directly.
  - **Copy/Cut/Paste**: Clipboard support for files - Copy and Cut via context menu or keyboard (Ctrl+C/X), Paste via toolbar or Ctrl+V.
  - **Keyboard Navigation**: Arrow keys for navigation, Enter to open, F2 to rename, Delete to remove, Ctrl+A to select all.
- **New SFTP Backend Commands**:
  - `create_sftp_dir`: Create new directory on remote server.
  - `create_sftp_file`: Create new empty file on remote server.
  - `copy_sftp_file`: Copy file to new location on remote server.
  - `move_sftp_file`: Move/rename file on remote server.

## [0.4.5] - 2026-02-23

### Added
- **IndexedDB Storage Migration**:
  - Migrated from localStorage to IndexedDB for improved data persistence and larger storage capacity.
  - Automatic, silent migration on first launch - all existing settings preserved.
  - ML autocomplete models now stored in IndexedDB (up to 50MB+ per profile).
  - New storage abstraction layer (`src/lib/storage.ts`) for unified data access.
- **Connection Pooling (Backend)**:
  - Implemented SSH connection pooling in Rust for better resource management.
  - Connections reused across terminal, SFTP, and Docker operations.
  - Automatic cleanup after 5 minutes of inactivity.
  - Keep-alive packets every 30 seconds to prevent connection drops.
- **Terminal Performance Settings**:
  - New "Performance" tab in Settings modal.
  - Configurable scrollback buffer size (1,000 - 100,000 lines or unlimited).
  - Renderer selection: Auto, WebGL, or Canvas fallback.
  - Optional FPS counter and GPU info display.
- **Output Throttling**:
  - Terminal output now batched every 16ms for smoother rendering.
  - Reduces CPU usage during high-volume output (e.g., `cat` large files).
- **Backup & Restore UI**:
  - Export all data (profiles, snippets, settings, ML models) as JSON.
  - Import from backup file with merge support.
  - Storage statistics display (profiles, snippets, ML models count).

### Changed
- **Storage Architecture**:
  - `ThemeContext.tsx` now uses IndexedDB via storage abstraction.
  - `useResizable.ts` panel sizes persisted to IndexedDB.
  - `useTerminalHistory.ts` ML models stored in IndexedDB.

### Technical
- Added `dexie` package for IndexedDB management.
- New `src/lib/db.ts` with Dexie schema and helper functions.
- New `src/lib/migration.ts` for automatic localStorage migration.
- New `src-tauri/src/services/connection_pool.rs` with pooling logic.

## [0.4.0] - 2026-02-22

### Added
- **Network Snippet Sharing**:
  - Expanded the P2P sharing infrastructure to support **Global Snippets**.
  - Added a "Share" action to the Snippet Manager panel, allowing one-click sharing of command snippets with discovered network peers.
  - Implemented backend support for unified profile and snippet transfer payloads.
  - Updated the incoming share interface to display and accept snippets alongside SSH profiles.

## [0.3.9] - 2026-02-22

### Changed
- **Network Sharing UI**:
  - Extracted the Network Sharing interface to be accessible globally across the application.
  - Added a global active sharing indicator to the TitleBar.
  - Added a notification badge to the TitleBar indicator when there are pending incoming share requests.

## [0.3.8] - 2026-02-22

### Fixed
- **macOS Window Controls**: Fixed an issue where the custom application header was not draggable and the minimize/maximize/close buttons were unresponsive on macOS.

## [0.3.7] - 2026-02-22

### Added
- **Enhanced Network Discovery**:
  - Implemented multi-interface broadcasting to support VPN and complex network environments.
  - Added a **Manual Connection** UI in the Sharing Panel for direct P2P connection via IP and port.
  - Improved peer discovery reliability across different operating systems on the same network.

## [0.3.6] - 2026-02-22

### Added
- **Session Timeout UX Refinement**:
  - Added a **Close Tab** button to the Session Locked overlay, allowing specific tab closure without exiting the application.
  - Bound the **Esc** key to the Close Tab action for faster keyboard navigation during locks.
- **Robust Inactivity Detection**:
  - Implemented jitter protection to ignore redundant mouse movements caused by sensor noise.
  - Added `mousedown` tracking to ensure the session stays active during clicks without significant movement.
  - Added debug logging for session timeout triggers.

## [0.3.5] - 2026-02-22

### Added
- **Global Snippet System**:
  - Snippets are now stored globally and can be used across any SSH connection.
  - Added support for folder-based snippet organization.
  - Added an "Auto-run" toggle for immediate execution vs. pasting into the terminal buffer.
  - Complete backend and frontend rewrite of the snippet manager for a faster, termius-like experience.

## [0.3.0] - 2026-02-22

### Added
- **SSH Tunneling (Port Forwarding)**:
  - Added support for Local, Remote, and Dynamic (SOCKS5) port forwarding.
  - New "Tunnels" tab in the Management Panel for easy configuration and monitoring.
  - Tunnels are managed per-profile and run in lightweight background threads.

## [0.2.5] - 2026-02-22

### Added
- **Session Timeout & Auto-Lock**:
  - Implemented a secure inactivity timeout (configurable: 5m, 15m, 30m, 60m, or Never).
  - **Strict Disconnection**: When timed out, the application forcefully unmounts all active terminal and SFTP views, triggering backend process cleanup for SSH/SFTP sessions.
  - **Secure Overlay**: Added a high-fidelity, blur-background lock screen that prevents unauthorized access while timed out.
  - **Quick Reconnect**: Pressing 'R' on the lock screen instantly re-establishes all previously active secure connections.
- Added "Session Timeout" configuration to the General Settings panel.


## [0.1.2] - 2026-02-22

### Added
- **SFTP Enhancements**:
  - **Multi-File Selection**: Support for selecting multiple files using Ctrl/Shift+Click.
  - **Batch ZIP Download**: Quickly download multiple files and folders as a single compressed ZIP archive.
  - **Real-Time Directory Watching**: Added a "Watch" mode to automatically refresh the file list on remote directory changes.
  - **Transfer Progress Queue**: A dedicated, theme-aware panel at the bottom of the SFTP browser to track active uploads and downloads with progress bars.
  - **Custom Modal Dialogs**: Replaced native browser prompts with styled React modals for a consistent premium UI.

### Fixed
- Improved TransferQueue text layout to prevent overflow in narrow panels.
- Fixed SFTP backend polling logic for better performance during file watching.

---

## [0.1.1] - 2026-02-22

### Added
- **Advanced Terminal Features**:
  - **Terminal Search (Ctrl+F)**: Added a floating find/replace overlay with match navigation, case sensitivity, and regex support.
  - **Interactive History Search (Ctrl+R)**: Added a reverse-i-search component that leverages the ML-powered `CommandPredictor` to search through command history.
  - **Clickable URLs**: Integrated `@xterm/addon-web-links` to automatically detect URLs in terminal output and make them clickable.
  - **Enhanced Clipboard Support**: Integrated `@xterm/addon-clipboard` for better copy/paste handling.
  - **Optional Line Numbers**: Added a toggleable line number gutter (Ctrl+Shift+L) that displays scrollback buffer line numbers.

### Fixed
- Fixed a critical crash where the WebGL renderer would turn the terminal black when using certain SearchAddon decorations.
- Resolved TypeScript compilation warning regarding unused variables in `TerminalViewer.tsx`.

### Changed
- Refactored `TerminalViewer.tsx` to handle new terminal addons and overlays.
- Expsosed `searchHistory()` and `getAllHistory()` methods in `CommandPredictor.ts`.

---

## [0.1.0] - 2026-02-21

### Added
- Initial release with core SSH and SFTP functionality.
- Feature-rich Docker Management.
- P2P Network Profile Sharing.
- ML-powered command autocomplete.
- Server health monitoring dashboard.
- Extensive theme system with 20+ presets.
