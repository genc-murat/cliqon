# Changelog

All notable changes to this project will be documented in this file.

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
