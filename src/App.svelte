<script lang="ts">
  import { onMount } from 'svelte'
  import logger from 'electron-log/renderer'
  import { appWindow, auth, background, maintenance, updater } from './ipc'
  import { blocking, launcherReady, overlay, page, requestedProfile, type BlockingState } from './renderer/stores'
  import { loadSessionAssets } from './renderer/session'
  import LoginView from './renderer/LoginView.svelte'
  import HomeView from './renderer/HomeView.svelte'
  import SettingsView from './renderer/SettingsView.svelte'
  import ProfileUnlock from './renderer/ProfileUnlock.svelte'
  import DialogHost from './renderer/DialogHost.svelte'
  import CrashReportPrompt from './renderer/CrashReportPrompt.svelte'
  import defaultBackground from './static/images/bg.png'
  import logo from './static/images/titlebar-icon.png'

  const isMac = navigator.userAgent.includes('Mac')
  const hasControls = !isMac

  const UPDATE_CHECK_TIMEOUT = 10_000
  const UPDATE_INSTALL_TIMEOUT = 30_000
  const dateFormatOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }

  let applicationBackground = $state(defaultBackground)
  let loadingHidden = $state(false)
  let showLoading = $state(true)
  let blockingShown = $state(false)

  onMount(() => {
    void initialize()
    return () => document.body.classList.remove('loaded')
  })

  const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

  function preloadImage(url: string) {
    return new Promise<void>((resolve) => {
      const image = new Image()
      image.onload = () => resolve()
      image.onerror = () => resolve()
      image.src = url
    })
  }

  async function checkForUpdate() {
    try {
      return await Promise.race([updater.check(), wait(UPDATE_CHECK_TIMEOUT).then(() => null)])
    } catch (error) {
      logger.error('Error while checking for launcher update:', error)
      return null
    }
  }

  function showBlocking(state: BlockingState) {
    blocking.set(state)
    window.setTimeout(() => (blockingShown = true), 200)
    window.setTimeout(() => (loadingHidden = true), 400)
  }

  async function hideBlocking() {
    blockingShown = false
    loadingHidden = false
    await wait(400)
    blocking.set({ kind: 'none' })
  }

  function setUpdateProgress(label: string, percent: number | null) {
    blocking.update((state) => (state.kind === 'update' ? { ...state, label, percent } : state))
  }

  async function update(version?: string) {
    const offError = updater.error((message) => logger.error('Launcher update error:', message))
    const offProgress = updater.downloadProgress((value) => setUpdateProgress('업데이트 다운로드 중...', value.percent))

    showBlocking({
      kind: 'update',
      text: version
        ? `${version} 버전으로 업데이트하는 중입니다. 잠시만 기다려 주세요...`
        : '런처를 업데이트하는 중입니다. 잠시만 기다려 주세요...',
      label: '업데이트 준비 중...',
      percent: 0
    })
    await wait(500)

    try {
      const downloaded = await updater.download()
      if (!downloaded) throw new Error('Download failed')

      offProgress()
      setUpdateProgress('설치 중...', null)
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
    } catch (error) {
      logger.error('Launcher update failed, continuing without update:', error)
      offProgress()
      await hideBlocking()
    } finally {
      offError()
    }
  }

  async function initialize() {
    logger.log('Initializing Launcher...')

    const [updateInfo, backgroundInfo, maintenanceInfo] = await Promise.all([checkForUpdate(), background.get(), maintenance.get()])
    const backgroundUrl = backgroundInfo?.file?.url ?? defaultBackground

    if (updateInfo?.available) await update(updateInfo.version)

    if (maintenanceInfo) {
      const unknown = '알 수 없음'
      const start = maintenanceInfo.startTime ? new Date(maintenanceInfo.startTime).toLocaleString('ko-KR', dateFormatOptions) : unknown
      const end = maintenanceInfo.endTime ? new Date(maintenanceInfo.endTime).toLocaleString('ko-KR', dateFormatOptions) : unknown
      showBlocking({ kind: 'maintenance', dates: `${start} ~ ${end}`, reason: maintenanceInfo.message ?? '잠시 후 다시 접속해 주세요.' })
      return
    }

    try {
      const [, session] = await Promise.all([preloadImage(backgroundUrl), auth.refresh()])
      applicationBackground = backgroundUrl

      if (session.success) {
        await loadSessionAssets(session.account)
        page.set('home')
      } else {
        page.set('login')
      }
    } catch (error) {
      logger.error('Error while initializing launcher:', error)
      applicationBackground = defaultBackground
      page.set('login')
    } finally {
      await wait(400)
      loadingHidden = true
      launcherReady.set(true)
      window.setTimeout(() => (showLoading = false), 450)
      await wait(200)
      document.body.classList.add('loaded')
    }
  }
</script>

{#if showLoading || !$launcherReady}
  <div id="view-loading" class="loading" class:loaded={loadingHidden}>
    <div class="loading-card">
      <p class="spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></p>
      <p class="text">불러오는 중...</p>
    </div>
  </div>
{/if}

{#if $blocking.kind === 'maintenance'}
  <div id="view-maintenance" class="maintenance" class:loaded={blockingShown}>
    <div class="maintenance-card">
      <p class="gears"><i class="fa-solid fa-gears"></i></p>
      <h3>점검 중</h3>
      <p class="dates">{$blocking.dates}</p>
      <p class="text">{$blocking.reason}</p>
    </div>
  </div>
{:else if $blocking.kind === 'update'}
  <div id="view-update" class="update" class:loaded={blockingShown}>
    <div class="maintenance-card">
      <p class="up"><i class="fa-solid fa-circle-up"></i></p>
      <h3>새 업데이트가 있습니다</h3>
      <p class="text">{$blocking.text}</p>
      <div class="progress-container">
        <div class="progress-info">
          <span>{$blocking.label}</span>
          <span>{$blocking.percent === null ? '' : $blocking.percent === 0 ? '0%' : `${$blocking.percent.toFixed(2)}%`}</span>
        </div>
        <div class="progress-bar-bg">
          <div
            class="progress-bar-fill"
            class:indeterminate={$blocking.percent === null}
            style:width={$blocking.percent === null ? undefined : `${$blocking.percent}%`}
          ></div>
        </div>
      </div>
    </div>
  </div>
{/if}

<div class="titlebar" class:mac={isMac}>
  <img src={logo} alt="" />
  <span>Yayo Launcher</span>
  {#if hasControls}
    <span class="spacer"></span>
    <div class="win-controls">
      <button type="button" aria-label="최소화" onclick={() => appWindow.minimize()}><i class="fa-solid fa-minus"></i></button>
      <button type="button" aria-label="최대화" onclick={() => appWindow.toggleMaximize()}><i class="fa-solid fa-window-maximize"></i></button>
      <button type="button" class="close" aria-label="닫기" onclick={() => appWindow.close()}><i class="fa-solid fa-xmark"></i></button>
    </div>
  {/if}
</div>

<div id="app">
  <div class="app-background" style:background-image={`url('${applicationBackground}')`}></div>
  {#if $page === 'login'}
    <LoginView />
  {:else if $page === 'home'}
    <HomeView />
  {/if}

  {#if $overlay === 'settings'}
    <SettingsView />
  {:else if $overlay === 'profile' && $requestedProfile}
    <ProfileUnlock profile={$requestedProfile} />
  {/if}
</div>
<DialogHost />
<CrashReportPrompt />

<style lang="scss">
  div.loading,
  div.maintenance,
  div.update {
    position: fixed;
    top: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    width: 100vw;
    background-color: var(--bg);
    transition: opacity 0.4s ease-in-out;
    z-index: 2000;
  }

  div.loading {
    opacity: 1;
  }

  div.loading.loaded {
    opacity: 0;
    pointer-events: none;
  }

  div.maintenance,
  div.update {
    opacity: 0;
  }

  div.maintenance.loaded,
  div.update.loaded {
    opacity: 1;
  }
</style>
