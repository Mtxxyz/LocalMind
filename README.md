# LocalMind

A minimal, futuristic, **offline-only** notes app for Windows. Built with Tauri v2 (Rust) + React/TypeScript. No accounts, no telemetry, no network calls — everything is stored locally next to the app.

## Features
- Notes with Markdown (preview-first, `Ctrl+E` to edit)
- Folders, tags, pinning, archive, manual-only trash
- Full-text search (SQLite FTS5)
- Local attachments via file picker or drag-and-drop (files copied into the app data folder, no size limit)
- In-app reminders
- Export notes or whole folders (including subfolders) to `.md`, full JSON backup/restore
- 8 theme templates with Light/Dark/System modes and accent override
- Optional app-level password lock (argon2 hash)
- Global quick capture with `Ctrl+N`
- Command palette (`Ctrl+K`)

## Privacy
LocalMind has no HTTP client and no analytics. All data lives in a `LocalMind-data` folder next to the executable (or `%APPDATA%\LocalMind` if that folder is read-only). The password is an app lock, **not** disk encryption — the database file itself is plain SQLite.

## Development

Requires Node 18+ and Rust (stable) with the MSVC toolchain on Windows.

```bash
npm install
npm run tauri dev
```

Frontend only:

```bash
npm run dev
```

Typecheck + build frontend:

```bash
npm run build
```

Build the standalone (portable) executable:

```bash
npm run tauri build
```

Tauri v2 has no dedicated "portable" bundle target, so bundling is disabled. The build produces a single standalone executable at `src-tauri/target/release/localmind.exe`. Copy that `.exe` anywhere (including a USB drive) and run it — LocalMind creates its `LocalMind-data` folder next to it. No installer, no registry entries.

> **Building in this environment:** the Windows SDK headers/libs were not installed system-wide, so the MSVC linker could not find `kernel32.lib`. The needed SDK packages were downloaded from NuGet and extracted to `%TEMP%\winsdk-extract`. Use the included batch scripts, which wire up the compiler, SDK `INCLUDE`/`LIB` paths, `rc.exe`, and `cargo` automatically:
>
> - `build-native.bat check --manifest-path src-tauri\Cargo.toml` — Rust typecheck
> - `build-native.bat test --manifest-path src-tauri\Cargo.toml --bin localmind` — Rust unit tests
> - `build-release.bat` — frontend + release `.exe`
>
> These scripts depend on the extracted SDK in `%TEMP%`. If that folder is cleaned up, either re-extract the SDK packages there or install the Windows SDK normally via the Visual Studio Installer, after which plain `npm run tauri build` will work.

If you later want an installer, set `bundle.active` to `true` and `bundle.targets` to `["nsis"]` in `src-tauri/tauri.conf.json`.

## Keyboard shortcuts
| Shortcut | Action |
|---|---|
| `Ctrl+N` | Quick capture (global) |
| `Ctrl+Shift+N` | New note |
| `Ctrl+E` | Toggle edit / preview |
| `Ctrl+K` | Command palette |
| `Ctrl+F` | Focus search |
| `Ctrl+Shift+F` | Toggle focus mode |

## Roadmap / known limitations
- Reminders show only while the app is running (in-app only, by design).
- The app icon is a placeholder and will be replaced later.
- Attachments are listed under each note; inline Markdown image rendering of copied attachments is not wired up yet.
- No auto-update (offline by design).
