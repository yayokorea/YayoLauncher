# Contributing

## Development setup

Use Node.js 22.x and npm.

```sh
npm ci
npm run dev
```

The launcher connects to an [EML AdminTool](https://github.com/Electron-Minecraft-Launcher/EML-AdminTool) instance. Configure `ADMINTOOL_URL` in `electron/const.ts`.

## Changes

- Keep each pull request focused on one change.
- Follow the surrounding code and `.prettierrc`; avoid unrelated formatting.
- Update documentation when behavior or setup changes.
- Commit `package-lock.json` when changing dependencies.

See [ARCHITECTURE.md](ARCHITECTURE.md) for process boundaries and [DESIGN.md](DESIGN.md) for UI rules.

## Validation

```sh
npm run build
```

This runs TypeScript checks and the Vite production build. There is no automated test suite.

Exercise the affected behavior in the Electron app. State which platforms were checked and which checks were not run in the pull request.

## Packaging

Run the command for the target platform:

```sh
npm run release:win
npm run release:mac
npm run release:lin
```

Installers are written to `release/`.

## Pull requests

Describe the problem, the resulting behavior, and how the change was verified. Link related issues. Include reproduction steps for bug fixes and screenshots for UI changes.

Use descriptive commit subjects. Prefixes such as `feat:`, `fix:`, `docs:`, and `refactor:` are used to group release notes.
