# NetworkTool

A lightweight Windows desktop app for viewing and managing localhost listening ports. Built with Tauri v2 (Rust + vanilla HTML/CSS/JS).

## Features

- Scans all TCP ports in LISTENING state on localhost
- Shows port number, process name, PID, and bound address
- DEV/SYS tags to distinguish dev servers from system services
- Kill any process directly from the UI (2-click confirmation)
- Auto-refreshes every 3 seconds (silent, no flicker)
- Search/filter by port, process name, or PID
- Dark theme designed for developer use

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) >= 18

## Development

```powershell
npm install
npm run dev
```

First build takes several minutes (compiling Tauri + dependencies). Subsequent builds are fast.

## Build

```powershell
npm run build
```

Produces an `.msi` installer in `src-tauri/target/release/bundle/msi/`.

## Project Structure

```
src/                  # Frontend (vanilla HTML/CSS/JS)
  index.html          # Main page
  styles.css          # Dark theme
  main.js             # Frontend logic
src-tauri/            # Tauri/Rust backend
  src/lib.rs          # scan_ports + kill_process commands
  src/main.rs         # Entry point
  tauri.conf.json     # App config
  capabilities/       # Tauri v2 permissions
```

