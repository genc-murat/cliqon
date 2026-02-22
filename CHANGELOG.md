# Changelog

All notable changes to this project will be documented in this file.

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
