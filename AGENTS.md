# AGENTS.md

> YayoLauncher: EML Template 기반의 모드 마인크래프트 런처입니다. UI 색상은 반드시 `_variables.scss`의 브랜드 변수만 사용하세요.

## Project overview

- **YayoLauncher** is a modded Minecraft launcher (Electron + Vite + TypeScript).
- Based on [EML Template](https://github.com/Electron-Minecraft-Launcher/EML-Template) by GoldFrite (MIT).
- Powered by [EML Lib](https://github.com/Electron-Minecraft-Launcher/EML-Lib) (MIT).
- Configured through an EML AdminTool instance at https://eml.yayokorea.net (`ADMINTOOL_URL` in `electron/const.ts`; also the electron-updater publish URL in `package.json`).

## Tech stack and commands

Electron, Vite (`vite-plugin-electron`), TypeScript, SCSS (`sass-embedded`), electron-builder. Requires Node.js 18+.

| Command                | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `npm install`          | Install dependencies                        |
| `npm run dev`          | Start Vite dev server + Electron            |
| `npm run build`        | `tsc && vite build` (type check + bundle)   |
| `npm run release:win`  | Build + NSIS installer (`.exe`)             |
| `npm run release:mac`  | Build + `.dmg` / `.zip`                     |
| `npm run release:lin`  | Build + `.AppImage`, `.deb`, `.rpm`         |

Quick verification: `npx tsc --noEmit` and `npx vite build`. Release output goes to `release/`.

## Key paths

- `electron/` — main process: `main.ts` (window, `BG_COLOR`), `preload.ts`, `const.ts`, `handlers/` (IPC: auth, launcher, settings, server, news, profiles, skin, ...).
- `src/` — renderer: `app.ts` (imports all styles), `init.ts`, `ipc.ts`, `views/` (home, login, settings, dialog).
- `src/static/styles/_variables.scss` — **single source of truth for colors** and UI tokens.
- `src/static/styles/*.scss` — per-view styles; `src/static/images/` — renderer images.
- `index.html` — renderer markup.
- `build/` — app icons (`icon.png` is the brand palette source) and installer resources.

## License notes

MIT. Keep `LICENSE` and `CREDITS` intact (EML Template, EML Lib and asset attributions). Add new third-party assets to `CREDITS`.

## Brand colors

Palette sampled from `build/icon.png`. All tokens are CSS custom properties defined in `src/static/styles/_variables.scss`. The UI is dark; contrast ratios below are against `--bg-dark` (WCAG AA = 4.5:1 for body text).

### Brand source colors

| Token                | Hex       | Source in icon      |
| -------------------- | --------- | ------------------- |
| `--brand-mint`       | `#acf4e6` | Hair (main color)   |
| `--brand-teal`       | `#5cd8d0` | Hair shade          |
| `--brand-teal-mid`   | `#3abcc2` | Hair shade          |
| `--brand-teal-deep`  | `#1fadb9` | Hair shade          |
| `--brand-gold`       | `#fad174` | Crown               |
| `--brand-purple`     | `#8465cf` | Collar              |
| `--brand-cream`      | `#f7f0e5` | Skin                |
| `--brand-skin`       | `#eccba9` | Skin shadow         |
| `--brand-ink`        | `#0e0212` | Outline             |

### Roles (use these in styles)

| Token                         | Value                       | Usage |
| ----------------------------- | --------------------------- | ----- |
| `--primary`                   | `--brand-teal` `#5cd8d0`    | Primary/Play buttons, progress bar, sliders, active nav/skin/profile, focus borders, links, icons in labels, spinners (10.9:1 on bg) |
| `--primary-hover`             | `--brand-mint` `#acf4e6`    | Hover of primary buttons and links |
| `--primary-rgb`               | `92, 216, 208`              | Tints: `rgba(var(--primary-rgb), a)` for active backgrounds, glows, selection, scrollbar hover |
| `--on-primary`                | `--brand-ink` `#0e0212`     | Text/icons on `--primary` / `--primary-hover` backgrounds (11.8:1). **Never put white text on teal/mint** (1.7:1) |
| `--secondary`, `--secondary-rgb` | `#8465cf` / `132, 101, 207` | Secondary accents: secondary button hover border, text-button hover tint, "update" news tag. Do not use as small text (4.2:1) |
| `--secondary-text`            | `#a98fe6`                   | Purple text on dark (7.1:1) |
| `--accent`, `--accent-rgb`    | `--brand-gold` `#fad174`    | Highlights, notifications, small emphasis, "event" news tag |
| `--success`                   | `#4caf50`                   | Online status, signed-in account |
| `--warning`                   | `--brand-gold`              | Pending/pinging status |
| `--danger`, `--danger-rgb`    | `#f44336`                   | Offline status, danger borders |
| `--danger-text`               | `#ff5252`                   | Danger button text |
| `--danger-soft`               | `#da8a8a`                   | Low-emphasis destructive icons (delete/reset) |
| `--bg-dark`                   | `#120f14`                   | Window/body background (mirrored by `BG_COLOR` in `electron/main.ts` and the fallback in `index.html`) |
| `--surface-1`                 | `#1a171c`                   | Dropdowns |
| `--surface-2`                 | `#1f1b22`                   | Modals, dialogs |
| `--surface-3` / `--surface-4` | `#2e2a31` / `#3d3940`       | Neutral filled buttons (rest / hover) |
| `--border-strong` / `--border-hover` | `#46424a` / `#66626a` | Input borders, slider track / hover borders |
| `--glass-bg`, `--glass-border`| tinted translucent          | Sidebar, login card, news cards |
| `--white-3` … `--white-30`    | white at 3–30% alpha        | Neutral overlays: hover backgrounds, dividers, scrollbar thumbs |
| `--scrim-rgb`                 | `14, 2, 18` (ink)           | Backdrops and shadows: `rgba(var(--scrim-rgb), a)` |
| `--text-main`                 | `#ffffff`                   | Headings, primary text |
| `--text-soft`                 | `--brand-cream`             | Long-form text (news body, author) |
| `--text-secondary`            | `#dcd7e0`                   | Form labels, secondary button text |
| `--text-muted`                | `#ada7b3`                   | Meta info, hints (8.2:1) |
| `--text-faint`                | `#8f8996`                   | Version label, footers (5.0:1 on surfaces) |

### Rules for agents

- Use the SCSS/CSS variables above. **Never hardcode hex/rgb colors** in `.scss`, `index.html` or TS-generated markup; for transparency use the `*-rgb` tokens with `rgba(var(--x-rgb), a)`.
- If a new color is truly needed, add a token to `_variables.scss` derived from the brand palette, and document it in this table.
- New UI must follow this palette and role mapping and keep WCAG AA text contrast.
- If `--bg-dark` changes, update `BG_COLOR` in `electron/main.ts` and the fallback in `index.html` too.
