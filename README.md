<p align="center">
  <img src="src/assets/logo.png" width="128" alt="Cliqon Logo">
</p>

# Cliqon — Modern SSH & SFTP Client

Cliqon is a fast, feature-rich SSH terminal and SFTP file manager for the desktop. Built with **Tauri 2** (Rust backend) and a **React + TypeScript** frontend.

---

## Features

### Connection Management
- Save, edit, and delete SSH connection profiles
- **Connection Groups** — organize profiles into collapsible groups in the sidebar; state is persisted across restarts
- **Favorites** — star any connection to pin it to the top of the list
- **Color Accents** — assign a custom color per connection (left-border highlight + subtle background tint in the sidebar)
- **Search & Filter** — real-time search by profile name, hostname, or username; groups are intelligently displayed in search results
- Supports **Password**, **Private Key**, and **SSH Agent** authentication

### Terminal
- **xterm.js** rendering with **WebGL** acceleration for smooth, low-latency output
- **Split Terminal** — split any tab horizontally (`Ctrl+Shift+H`) to run multiple SSH sessions to the same host side-by-side
- **Draggable Dividers** — interactively resize terminal panes within a tab
- **Multi-Tab** — run multiple independent SSH sessions
- **Terminal Themes** — 27+ built-in themes including Night Owl, Cobalt2, Catppuccin, Rose Pine, Tokyo Night, One Dark, and many more
- **Cursor Customization** — Choose between Block, Underline, or Bar cursor styles with optional blinking
- **Dynamic ANSI Colors** — "Match App Theme" automatically switches between Light and Dark optimized ANSI palettes for maximum readability
- **Font Settings** — choose font family, size, and line height with a live preview

### SFTP File Browser
- Integrated split-view SFTP panel per terminal tab
- Directory navigation (double-click to open, Up button to go back)
- **Drag-and-drop** file upload from your desktop into the remote directory
- **Context Menu** — Right-click files or folders for:
  - **Download** — Save remote files to your local machine
  - **Rename** — Inline file and directory renaming
  - **Delete** — Securely remove remote items
  - **Copy Path** — Fast path copying to clipboard
  - **Edit file** — Built-in text editor for remote files with syntax support and Ctrl+S to save
  - **cd to Terminal** — Instant navigation in the active terminal
- **SFTP Bookmarks** — Save frequent paths per connection for instant access; one-click navigation from the bookmarks dropdown
- **Properties & Permissions** — View detailed file info and interactively edit permissions (chmod)
- Refresh button and file size display on hover

### Connection Snippets
- Save per-connection command snippets
- One-click execution — snippet is sent directly to the active terminal
- Add/delete snippets with a clean sidebar panel

### Theming & Appearance
- **App Themes** — 23+ high-quality themes: Cyberpunk Red, Hacker Void, Coffee Shop, Forest Moss, Amethyst, and many more
- **Sidebar-Driven Settings** — Completely redesigned, premium settings interface for easier customization
- **Terminal Palette Preview** — Visualize font colors (ANSI) directly in the Settings menu
- **Collapsible panels** — Sidebar, SFTP Browser, and Snippet Manager can each be collapsed to an icon rail for maximum terminal space; sidebar state is persisted across restarts

### Security
- Passwords and key passphrases stored via **OS Keyring** (Keychain on macOS, libsecret on Linux, Windows Credential Manager)
- Obfuscated local fallback for environments where the system keyring is unavailable

### Server Health Monitor
- **Real-Time Dashboard** — Live CPU, RAM, Disk, and Load Average metrics
- **Visual Analytics** — Integrated circular gauges and SVG sparkline charts with historical tracking
- **Dynamic Thresholds** — Professional color-coded indicators (Green/Amber/Red) for instant health status
- **↔ Vertically Resizable** — Adjust the monitor panel height by dragging the top handle; height is persisted per user pref
- **Auto-Open Preference** — Optional "Auto-open on connection" setting configurable via General Settings
- **System Insights** — Fast parsing of Hostname, OS Distribution, and Uptime via background SSH exec commands

### 🌐 Network Tools
A comprehensive suite of **15 on-demand diagnostic tools** executed directly from the connected server via SSH:
- **Core Connectivity**:
  - **Ping** — Remote ICMP ping with latency sparklines and Min/Avg/Max summary.
  - **Traceroute** — Visualize network hops with Host, IP, and RTT tracking.
  - **DNS Lookup** — Query records with color-coded type badges (A, AAAA, CNAME, MX).
- **Security & Auditing**:
  - **Port Scan** — Scan common service ports on any remote host.
  - **SSL Info** — Detailed certificate info (Validity, Issuer, SANs) for secure hosts.
  - **Firewall** — Instant status check for `ufw` or `iptables` rules.
- **Service Monitoring**:
  - **Listening Ports** — Audit all ports the server is currently listening on.
  - **Connections** — Real-time list of active TCP/UDP connections.
  - **HTTP Check** — Audit HTTP/S status and response headers for any URL.
- **Server Infrastructure**:
  - **Interfaces** — View local network interfaces and assigned IP addresses.
  - **Public IP** — Quickly identify the server's external presence.
  - **Socket Stats** — High-level summary of TCP, UDP, and Raw socket counts.
- **Routing & Performance**:
  - **Routes** — View the server's routing table (`ip route`).
  - **ARP Neighbors** — Display local network neighbors (ARP cache).
  - **Bandwidth** — Real-time RX/TX traffic counters per interface in MB.
- **Power-User Ready**:
  - **Context-Aware** — Input is automatically disabled for server-local diagnostics.
  - **Structured Output** — Raw shell data is parsed into clean, interactive tables and cards.
  - **Copy Raw** — One-click clipboard copy of raw command output.

### 🐳 Docker Container Manager
Manage your Docker infrastructure directly through the SSH connection:
- **Container List** — Real-time view of all containers (Running, Stopped, Exited).
- **One-Click Controls** — Start, stop, and restart containers with a single click.
- **Terminal Log Stream** — Instant `docker logs -f` integration that streams logs directly into your active terminal tab.
- **Stats & Info** — View container ID, image, assigned ports, and uptime status.
- **↕ Vertically Resizable** — Flexible panel height that persists across sessions.

### ↕ Resizable Panels & Layout
- **Intelligent Resizing** — Interactively drag to resize the Sidebar, SFTP Browser, Snippet Manager, and Server Monitor
- **Layout Persistence** — All panel widths and the monitor height are saved to local storage
- **Terminal Reflow** — xterm.js automatically adjusts columns and rows when panels are resized or collapsed

### Built-in Text Editor
- **Remote Editing** — Modify files directly on the server without manual download/upload cycles
- **Syntax Highlighting** — Automatic language detection for code and config files
- **Developer Ready** — Line numbers, monospace gutter, and `Ctrl+S` instant save integration

### Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `Ctrl + Tab` | Switch to next SSH tab |
| `Ctrl + Shift + Tab` | Switch to previous SSH tab |
| `Ctrl + N` | Open "New Connection" modal |
| `Ctrl + B` | Toggle SFTP browser panel |
| `Ctrl + F` | Focus sidebar connection search |
| `Ctrl + Shift + H` | Split current tab horizontally |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Desktop runtime | Tauri v2 |
| Backend | Rust (`ssh2`, `keyring`, `serde`) |
| Frontend | React 18 + Vite + TypeScript |
| Terminal | xterm.js + WebGL addon |
| Icons | Lucide React |
| Styles | Tailwind CSS + CSS variables |

---

## Getting Started

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

## Contributing
Issues and PRs are welcome. If you'd like to add a feature or fix a bug, feel free to open a discussion first.
