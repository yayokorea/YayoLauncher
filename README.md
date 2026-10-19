# Yayo Launcher

Modded Minecraft launcher, powered by [EML Lib](https://github.com/Electron-Minecraft-Launcher/EML-Lib) and configured through an [EML AdminTool](https://github.com/Electron-Minecraft-Launcher/EML-AdminTool) instance.

![YayoLauncher](./.github/assets/screenshot.png)

## Development

Requires Node.js 18 or higher.

```bash
npm install
npm run dev
```

The AdminTool URL is set in `electron/const.ts`.

## Build

| Platform | Command               | Output format               |
| -------- | --------------------- | --------------------------- |
| Windows  | `npm run release:win` | `.exe` (NSIS Installer)     |
| macOS    | `npm run release:mac` | `.dmg` (Disk Image)         |
| Linux    | `npm run release:lin` | `.AppImage`, `.deb`, `.rpm` |

Compiled files are written to the `release/` folder.

## License

MIT. See [LICENSE](./LICENSE) and [CREDITS](./CREDITS).

Based on [EML Template](https://github.com/Electron-Minecraft-Launcher/EML-Template) by GoldFrite (MIT).
