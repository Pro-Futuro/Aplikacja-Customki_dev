# Customki

Desktop app for generating "Customki" League of Legends drafts, saving match summaries, and exporting both team assignments.

The frontend now also exposes:

- per-player points entry when saving a match
- chosen champion entry for each player
- player ranking based on saved history
- duo win-rate stats
- champion usage and best-champion summaries inside the ranking view

## Run in development

From the project root:

```powershell
npm install
npm run tauri:dev
```

## Build a packaged app

From the project root:

```powershell
npm install
npm run tauri:build
```

The built executable and installers are typically created under:

- `src-tauri\target\release\app.exe`
- `src-tauri\target\release\bundle\`

## Match summary storage

The Rust backend stores app state in a file named `state.json` inside Tauri's app data directory.

That path is built in the backend by calling `app.path().app_data_dir()` and appending `state.json`.

On Windows, with the current app identifier `com.customki`, this is typically:

```text
C:\Users\<your-user>\AppData\Roaming\com.customki\state.json
```

The stored data includes:

- saved blue-side and red-side player names
- match history
- winners
- saved draft payloads
- chosen champions and points payloads
