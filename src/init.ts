import { setBlockingView, setUser, setView } from './state'
import { auth, background, maintenance, skin, updater } from './ipc'
import logger from 'electron-log/renderer'

const DEFAULT_BACKGROUND = '/src/static/images/bg.png'
const UPDATE_CHECK_TIMEOUT = 10_000
const UPDATE_INSTALL_TIMEOUT = 30_000
const dateFormatOptions: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = url
    img.onload = () => resolve()
    img.onerror = () => resolve()
  })
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function checkForUpdate() {
  try {
    return await Promise.race([updater.check(), wait(UPDATE_CHECK_TIMEOUT).then(() => null)])
  } catch (err) {
    logger.error('Error while checking for launcher update:', err)
    return null
  }
}

export async function bootstrap() {
  logger.log('Initializing Launcher...')

  const bgElement = document.querySelector('.app-background') as HTMLElement
  const maintenanceDates = document.getElementById('maintenance-dates')!
  const maintenanceReason = document.getElementById('maintenance-reason')!
  const progressBar = document.getElementById('update-progress-bar')
  const progressLabel = document.getElementById('update-progress-label')
  const progressPercent = document.getElementById('update-progress-percent')

  const setIndeterminate = (active: boolean) => {
    if (!progressBar || !progressPercent) return

    if (active) {
      progressBar.classList.add('indeterminate')
      progressPercent.style.display = 'none'
    } else {
      progressBar.classList.remove('indeterminate')
      progressPercent.style.display = 'block'
    }
  }

  const update = async (version?: string) => {
    const updateView = document.getElementById('view-update')
    const updateText = document.getElementById('update-text')
    const offError = updater.error((message) => logger.error('Launcher update error:', message))
    const offProgress = updater.downloadProgress((value) => {
      const percent = value.percent.toFixed(2)
      progressLabel!.innerText = '업데이트 다운로드 중...'
      progressPercent!.innerText = `${percent}%`
      progressBar!.style.width = `${percent}%`
    })

    setIndeterminate(false)
    progressBar!.style.width = '0%'
    progressLabel!.innerText = '업데이트 준비 중...'
    progressPercent!.innerText = '0%'
    if (updateText && version) updateText.innerText = `${version} 버전으로 업데이트하는 중입니다. 잠시만 기다려 주세요...`
    setBlockingView('update')
    await wait(500)

    try {
      const downloaded = await updater.download()
      if (!downloaded) throw new Error('Download failed')

      offProgress()
      setIndeterminate(true)
      progressLabel!.innerText = '설치 중...'
      logger.log('Update downloaded, restarting launcher to install...')

      // The app quits on success; if it is still running after an error or timeout, continue normally.
      let offInstallError = () => {}
      await new Promise<void>((resolve) => {
        offInstallError = updater.error(() => resolve())
        updater.install().catch(() => resolve())
        wait(UPDATE_INSTALL_TIMEOUT).then(resolve)
      })
      offInstallError()
      throw new Error('Install did not complete')
    } catch (err) {
      logger.error('Launcher update failed, continuing without update:', err)
      offProgress()
      updateView?.classList.remove('loaded')
    } finally {
      offError()
    }
  }

  const [up, bg, mn] = await Promise.all([checkForUpdate(), background.get(), maintenance.get()])
  const bgUrl = bg?.file?.url ?? DEFAULT_BACKGROUND

  if (up?.available) await update(up.version)

  if (mn) {
    const start = new Date(mn.startTime as Date)
    const end = new Date(mn.endTime as Date)
    maintenanceDates.innerText = `${start.toLocaleString([], dateFormatOptions)} ~ ${end.toLocaleString([], dateFormatOptions)}`
    maintenanceReason.innerText = mn.message ?? '잠시 후 다시 접속해 주세요.'
    setBlockingView('maintenance')
    return
  }
  try {
    const [_, session] = await Promise.all([
      preloadImage(bgUrl),
      auth.refresh(),
    ])

    if (bgElement) bgElement.style.backgroundImage = `url('${bgUrl}')`

    if (session.success) {
      const [__, skins, capes, avatar] = await Promise.all([skin.reload(session.account), skin.getSkin(), skin.getCape(), skin.getAvatar()])

      setUser(session.account, { skins, capes, avatar })
      setView('home')
    } else {
      setView('login')
    }
  } catch (err) {
    logger.error('Error while initializing launcher:', err)
    if (bgElement) bgElement.style.backgroundImage = `url('${DEFAULT_BACKGROUND}')`
    setView('login')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 400))
    document.querySelector('div#view-loading')?.classList.add('loaded')
    await new Promise((resolve) => setTimeout(resolve, 200))
    document.body.classList.add('loaded')
  }
}

