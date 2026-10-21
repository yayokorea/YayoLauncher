# Architecture

## Process boundaries

- **Main process**: `electron/main.ts` creates the window and registers handlers from `electron/handlers/`. Filesystem access, native APIs, authentication, and game operations belong here.
- **Preload**: `electron/preload.ts` exposes `window.api` through `contextBridge`. Context isolation is enabled; Node.js integration in the renderer is disabled.
- **Renderer**: `src/App.svelte` and `src/renderer/` manage views and UI state. Main process functionality is accessed through `src/ipc.ts`.

The EML Lib launcher in the main process installs and launches the game, forwarding progress and lifecycle events to the renderer.

## IPC

Requests use `ipcRenderer.invoke` and `ipcMain.handle`. Progress and lifecycle events flow from the main process to the renderer. Event subscription methods return cleanup functions.

When changing an API, update the handler in `electron/handlers/`, the bridge in `electron/preload.ts`, and the types and wrappers in `src/ipc.ts` together. Clean up event subscriptions when components are destroyed.

## Persistence

Settings and authentication sessions are stored as `settings.json` and `session.json` under Electron's `userData` directory. Keep the directory name `YayoLauncher` to preserve existing user data.

Profile unlock tokens are held in renderer memory.
