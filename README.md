# Cliqon - Modern SSH & SFTP Client

Cliqon is a modern, fast, and feature-rich SSH terminal and SFTP file browser application. It is built natively for desktop using **Tauri**, powered by a high-performance **Rust** backend and a sleek **React (Vite+TypeScript)** frontend.

## Key Features

- **🚀 High-Performance Terminal:** Powered by `xterm.js` and WebGL, allowing smooth and low-latency interaction.
- **📁 Integrated SFTP File Browser:** Drag-and-drop file upload, seamless directory navigation, and a split-view layout.
- **🔐 Secure Credentials Storage:** Integrates directly with your OS-level Keyring (Keychain) to safely encrypt and store passwords and key passphrases without keeping them in plain text.
- **🎨 Dynamic Theming & Resizable UI:**
  - Includes fully customizable, responsive dark and light themes (Modern Dark, Glass Dark, Cyberpunk, Dracula, etc).
  - Customize terminal-specific color profiles independently from the app theme.
  - Includes resizable side panels for your comfort.
- **📄 Connection-Specific Snippets:** Write and save useful commands per-connection for one-click execution directly in your terminal.
- **⚡ Multi-Tab Support:** Manage several SSH sessions concurrently.

## Technology Stack
- **Backend**: Rust 🦀, Tauri v2.
- **Frontend**: React (Vite) ⚛️, TypeScript, Tailwind CSS, Lucide Icons.
- **Terminal Rendering**: Xterm.js (WebGL Addon).
- **Security**: OS Keyboard-interactive & Keyring API integration.

## Installation & Build Instructions

### Prerequisites
Make sure you have installed all necessary dependencies for Tauri and Rust according to the official [Tauri Prerequisites guide](https://tauri.app/v1/guides/getting-started/prerequisites).
Node.js (v18+) is also required.

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
Starts the application with Vite hot-module replacement and the Tauri Rust backend.
```bash
npm run tauri dev
```

### 3. Build for Production
Compiles the React frontend and packages the Rust backend into a standalone native executable for your OS.
```bash
npm run tauri build
```

## Contributing
Feel free to open issues or submit PRs if you want to extend CLIQON's capabilities!
