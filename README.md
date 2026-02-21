<p align="center">
  <img src="src/assets/logo.png" width="128" alt="Cliqon Logo">
</p>

# Cliqon — Modern SSH & SFTP Client

Cliqon is a fast, feature-rich SSH terminal and SFTP file manager for the desktop. Built with **Tauri 2** (Rust backend) and a **React + TypeScript** frontend.

---

## ✨ Features

### 🔗 Connection Management
- Save, edit, and delete SSH connection profiles
- **Favorites** — star any connection to pin it to the top of the list
- **Color Accents** — assign a custom color per connection (left-border highlight + subtle background tint in the sidebar)
- **Search & Filter** — real-time search by profile name, hostname, or username; favorites always appear first
- Supports **Password**, **Private Key**, and **SSH Agent** authentication

### 💻 Terminal
- **xterm.js** rendering with **WebGL** acceleration for smooth, low-latency output
- **Multi-Tab** — run multiple SSH sessions side-by-side
- **Terminal Themes** — 14+ built-in themes including Tokyo Night, One Dark, Nord, Solarized, Monokai, and Gruvbox
- **Dynamic ANSI Colors** — "Match App Theme" automatically switches between Light and Dark optimized ANSI palettes for maximum readability
- **Font Settings** — choose font family (JetBrains Mono, Fira Code, Cascadia Code, Consolas, etc.), font size (10–24 px), and line height — with a live preview in Settings

### 📁 SFTP File Browser
- Integrated split-view SFTP panel per terminal tab
- Directory navigation (double-click to open, Up button to go back)
- **Drag-and-drop** file upload from your desktop into the remote directory
- **Context Menu** — Right-click files or folders for:
  - ⬇️ **Download** — Save remote files to your local machine
  - ✏️ **Rename** — Inline file and directory renaming
  - 🗑️ **Delete** — Securely remove remote items
  - 📋 **Copy Path** — Fast path copying to clipboard
  - � **Edit file** — Built-in text editor for remote files with syntax support and Ctrl+S to save
  - �💻 **cd to Terminal** — Instant navigation in the active terminal
- **Properties & Permissions** — View detailed file info and interactively edit permissions (chmod)
- Refresh button and file size display on hover

### ⚡ Connection Snippets
- Save per-connection command snippets
- One-click execution — snippet is sent directly to the active terminal
- Add/delete snippets with a clean sidebar panel

### 🎨 Theming & Appearance
- **App Themes** — 9+ high-quality themes: Nordic Night, Midnight Purple, Emerald Forest, Cyber Rose, Solarized, Glass Dark, and more
- **Terminal Palette Preview** — Visualize font colors (ANSI) directly in the Settings menu
- **Collapsible panels** — Sidebar, SFTP Browser, and Snippet Manager can each be collapsed to an icon rail for maximum terminal space; sidebar state is persisted across restarts

### 🔐 Security
- Passwords and key passphrases stored via **OS Keyring** (Keychain on macOS, libsecret on Linux, Windows Credential Manager)
- Obfuscated local fallback for environments where the system keyring is unavailable

### ↔️ Resizable Panels
- Drag to resize the Sidebar, SFTP Browser, and Snippet Manager panels
- Terminal reflows automatically after any panel resize or collapse

### 📝 Built-in Text Editor
- Edit remote files directly without downloading
- **Syntax Hints** — Automatic language detection based on file extension
- **Line Numbers** — Monospace gutter for code reference
- **Power Features** — Ctrl+S to save instantly to the server, Tab-to-space conversion

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `Ctrl + Tab` | Switch to next SSH tab |
| `Ctrl + Shift + Tab` | Switch to previous SSH tab |
| `Ctrl + N` | Open "New Connection" modal |
| `Ctrl + B` | Toggle SFTP browser panel |
| `Ctrl + F` | Focus sidebar connection search |

---

## 🛠 Technology Stack

| Layer | Technology |
|---|---|
| Desktop runtime | Tauri v2 |
| Backend | Rust (`ssh2`, `keyring`, `serde`) |
| Frontend | React 18 + Vite + TypeScript |
| Terminal | xterm.js + WebGL addon |
| Icons | Lucide React |
| Styles | Tailwind CSS + CSS variables |

---

## 🚀 Getting Started

### Prerequisites
- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) v18+
- Tauri prerequisite libraries — see [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

### Install dependencies
```bash
npm install
```

### Development
```bash
npm run tauri dev
```

### Production build (current platform)
```bash
npm run tauri build
```

### Cross-compile for Windows (from Linux)
```bash
npm run tauri build -- --target x86_64-pc-windows-gnu
```

---

## 🤝 Contributing
Issues and PRs are welcome. If you'd like to add a feature or fix a bug, feel free to open a discussion first.
