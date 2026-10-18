import type { WebContents } from 'electron'
import { app, ipcMain } from 'electron'
import { autoUpdater, CancellationToken } from 'electron-updater'
import logger from 'electron-log/main'

export interface IUpdateCheck {
  available: boolean
  version?: string
  releaseNotes?: string
}

export interface IUpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

const DOWNLOAD_STALL_TIMEOUT = 30_000

let initialized = false
let target: WebContents | null = null
let resetStallTimer: (() => void) | null = null

function send(channel: string, payload: unknown) {
  if (target && !target.isDestroyed()) target.send(channel, payload)
}

function isSupported() {
  if (!app.isPackaged) return false
  // Squirrel.Mac refuses unsigned apps, so auto-update is skipped on macOS.
  if (process.platform === 'darwin') return false
  if (process.platform === 'linux' && !process.env.APPIMAGE) return false
  return true
}

function notesToString(notes: unknown): string | undefined {
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) return notes.map((n) => n?.note ?? '').filter(Boolean).join('\n\n') || undefined
  return undefined
}

function init() {
  if (initialized) return
  initialized = true

  autoUpdater.logger = logger
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false

  autoUpdater.on('download-progress', (p) => {
    resetStallTimer?.()
    send('updater:download_progress', {
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond
    } satisfies IUpdateProgress)
  })

  autoUpdater.on('error', (err) => {
    logger.error('Updater error', err)
    send('updater:error', err?.message ?? String(err))
  })
}

export function registerUpdaterHandlers() {
  ipcMain.handle('updater:check', async (): Promise<IUpdateCheck> => {
    if (!isSupported()) {
      logger.info(`Auto-update skipped (packaged: ${app.isPackaged}, platform: ${process.platform})`)
      return { available: false }
    }

    try {
      init()
      const result = await autoUpdater.checkForUpdates()
      if (!result?.isUpdateAvailable) return { available: false }
      return {
        available: true,
        version: result.updateInfo.version,
        releaseNotes: notesToString(result.updateInfo.releaseNotes)
      }
    } catch (err) {
      logger.error('Error checking for launcher update', err)
      return { available: false }
    }
  })

  ipcMain.handle('updater:download', async (event): Promise<boolean> => {
    if (!isSupported()) return false
    target = event.sender

    const token = new CancellationToken()
    let stallTimer: NodeJS.Timeout | undefined
    resetStallTimer = () => {
      clearTimeout(stallTimer)
      stallTimer = setTimeout(() => {
        logger.error(`Launcher update download stalled (no progress for ${DOWNLOAD_STALL_TIMEOUT}ms), skipping update`)
        token.cancel()
      }, DOWNLOAD_STALL_TIMEOUT)
    }

    try {
      resetStallTimer()
      await autoUpdater.downloadUpdate(token)
      return true
    } catch (err) {
      logger.error('Error downloading launcher update', err)
      return false
    } finally {
      clearTimeout(stallTimer)
      resetStallTimer = null
    }
  })

  ipcMain.handle('updater:install', () => {
    if (!isSupported()) return
    setImmediate(() => autoUpdater.quitAndInstall(true, true))
  })
}
