# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # launch the Electron app
```

There is no build step, linter, or test suite.

## Architecture

This is an Electron app with a strict main/renderer split enforced by `contextIsolation: true` and `nodeIntegration: false`.

**Main process (`main.js`)** — Node.js side. Registers four IPC handlers:
- `get-drives` — shells out to PowerShell (`Get-WmiObject Win32_LogicalDisk`) to enumerate drives
- `get-directory-contents` — reads a directory with `fs.readdir` + `fs.stat`, sorts dirs first then by size descending
- `get-folder-size` — recursively walks a directory tree to sum file sizes
- `get-parent-path` — returns `path.dirname` or `null` at the filesystem root

**Preload (`preload.js`)** — bridges the two worlds. Uses `contextBridge.exposeInMainWorld` to expose `window.diskAPI` with the four methods above as async wrappers over `ipcRenderer.invoke`.

**Renderer (`renderer/`)** — vanilla JS, no bundler. Three IIFEs are loaded as plain `<script>` tags and communicate via globals:
- `App` (`app.js`) — top-level view controller; owns dashboard ↔ browser toggling and wires the Back/Refresh header buttons
- `Dashboard` (`dashboard.js`) — fetches drives via `window.diskAPI.getDrives()` and renders drive cards with usage progress bars (green/orange/red thresholds at 70%/90%)
- `Browser` (`browser.js`) — file/folder list view with breadcrumb navigation; folder sizes are computed lazily after the list renders using a `renderToken` integer to discard results from superseded navigations

**Styles (`renderer/styles/`)** — three CSS files loaded in order: `main.css` (global reset + CSS custom properties / design tokens), `dashboard.css` (drive card grid), `browser.css` (file list). All colors are defined as CSS variables in `main.css`; never hardcode color values elsewhere.

## IPC contract

The renderer must only reach the main process through `window.diskAPI`. Do not add `nodeIntegration: true` or bypass `contextBridge` — the security model depends on this boundary.
