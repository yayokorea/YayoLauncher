<script lang="ts">
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { SkinViewer, WalkingAnimation } from 'skinview3d'
  import logger from 'electron-log/renderer'
  import type { ICape, ISkin } from 'eml-lib'
  import { auth, settings as settingsApi, skin as skinApi, system } from '../ipc'
  import type { IGameSettings } from '../../electron/handlers/settings'
  import { account, avatar, capes, overlay, page, profileTokens, profiles, selectedProfile, showDialog, skins } from './stores'
  import { capeThumbnails, ensureCapeThumbnails, ensureSkinThumbnails, skinThumbnailKey, skinThumbnails } from './thumbnails'

  type Resolution = { label: string; value: string; width: number; height: number }
  const resolutions: Resolution[] = [
    { label: '자동 (기본값)', value: '854x480', width: 854, height: 480 },
    { label: '전체 화면', value: 'fullscreen', width: 854, height: 480 },
    { label: '2560x1440 (1440p)', value: '2560x1440', width: 2560, height: 1440 },
    { label: '1920x1080 (1080p)', value: '1920x1080', width: 1920, height: 1080 },
    { label: '1600x900', value: '1600x900', width: 1600, height: 900 },
    { label: '1366x768', value: '1366x768', width: 1366, height: 768 },
    { label: '1280x1024', value: '1280x1024', width: 1280, height: 1024 },
    { label: '1280x720 (720p)', value: '1280x720', width: 1280, height: 720 },
    { label: '1024x768', value: '1024x768', width: 1024, height: 768 },
    { label: '800x600', value: '800x600', width: 800, height: 600 }
  ]
  const defaultSkin = {
    id: 'steve',
    url: 'https://textures.minecraft.net/texture/d5c4ee5ce20aed9e33e866c66caa37178606234b3721084bf01d13320fb2eb3f',
    variant: 'classic',
    state: 'active'
  } as ISkin
  const RAM_STEP = 0.5

  let tab = $state<'game' | 'skin' | 'account'>('game')
  let settings = $state<IGameSettings | null>(null)
  let version = $state('')
  let maxMemory = $state(16)
  let minMemory = $state(2)
  let maxAllocated = $state(8)
  let resolution = $state('854x480')
  let java = $state('bundled')
  let launcherAction = $state<IGameSettings['launcherAction']>('close')
  let availableResolutions = $state<Resolution[]>([])
  let canvas = $state<HTMLCanvasElement | undefined>()
  let skinViewer = $state.raw<SkinViewer | undefined>()
  let skinSourceType = $state<'file' | 'url'>('file')
  let skinUrl = $state('')
  let skinFile = $state<File | null>(null)
  let skinVariant = $state<'classic' | 'slim'>('classic')
  let skinFileInput = $state<HTMLInputElement | undefined>()
  let settingsContent = $state<HTMLElement | undefined>()
  let saving = $state(false)

  let minPercent = $derived(((minMemory - RAM_STEP) / (maxMemory - RAM_STEP)) * 100)
  let maxPercent = $derived(((maxAllocated - RAM_STEP) / (maxMemory - RAM_STEP)) * 100)
  let activeSkin = $derived($skins.find((item) => item.state === 'active') ?? defaultSkin)
  let activeCape = $derived($capes.find((item) => item.state === 'active'))
  let canAddSkin = $derived(skinSourceType === 'url' ? !!skinUrl.trim() : !!skinFile)
  let accountType = $derived($account?.meta.type ?? 'unknown')

  onMount(() => {
    void loadSettings()
  })

  async function loadSettings() {
    try {
      const [info, saved] = await Promise.all([system.getInfo(), settingsApi.get()])
      settings = saved
      version = `Yayo Launcher v${info.version}`
      maxMemory = Math.max(1, Math.min(info.totalMem, 16))
      minMemory = Math.min(saved.memory.min, maxMemory - RAM_STEP)
      maxAllocated = Math.min(Math.max(saved.memory.max, minMemory + RAM_STEP), maxMemory)
      availableResolutions = [
        resolutions[0],
        ...resolutions.slice(1).filter((item) => item.width <= info.resolution.width && item.height <= info.resolution.height)
      ]
      resolution = saved.resolution.fullscreen ? 'fullscreen' : `${saved.resolution.width}x${saved.resolution.height}`
      if (!availableResolutions.some((item) => item.value === resolution)) resolution = availableResolutions[0]?.value ?? '854x480'
      java = saved.java === 'bundled' ? 'bundled' : 'system'
      launcherAction = saved.launcherAction
    } catch (error) {
      logger.error('Could not load settings:', error)
      await showDialog('런처 설정을 불러오지 못했습니다.', [{ text: '확인', type: 'ok' }])
    }
  }

  // The 3D preview only exists while the skin tab is displayed.
  $effect(() => {
    if (tab !== 'skin' || !canvas) return
    try {
      const viewer = new SkinViewer({ canvas, width: 530, height: 250, preserveDrawingBuffer: true })
      viewer.animation = new WalkingAnimation()
      viewer.animation.speed = 0.3
      viewer.camera.position.set(-20, -2, 35)
      viewer.controls.enableZoom = false
      viewer.controls.enablePan = false
      viewer.controls.rotateSpeed = 0.3
      skinViewer = viewer
      return () => {
        viewer.dispose()
        skinViewer = undefined
      }
    } catch (error) {
      logger.error('Could not initialize the skin viewer:', error)
    }
  })

  $effect(() => {
    const viewer = skinViewer
    if (!viewer) return
    void viewer
      .loadSkin(activeSkin.url, { model: activeSkin.variant === 'slim' ? 'slim' : 'default' })
      .catch((error) => logger.warn('Could not load skin preview:', error))
    if (activeCape) void viewer.loadCape(activeCape.url).catch((error) => logger.warn('Could not load cape preview:', error))
    else viewer.resetCape()
  })

  $effect(() => {
    if (tab === 'skin') ensureSkinThumbnails($skins)
  })
  $effect(() => {
    if (tab === 'skin') ensureCapeThumbnails($capes)
  })

  function setMinMemory(event: Event & { currentTarget: HTMLInputElement }) {
    minMemory = Math.max(RAM_STEP, Math.min(event.currentTarget.valueAsNumber, maxAllocated - RAM_STEP))
    event.currentTarget.value = String(minMemory)
  }

  function setMaxMemory(event: Event & { currentTarget: HTMLInputElement }) {
    maxAllocated = Math.min(maxMemory, Math.max(event.currentTarget.valueAsNumber, minMemory + RAM_STEP))
    event.currentTarget.value = String(maxAllocated)
  }

  function scrollToTop() {
    settingsContent?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveSettings() {
    if (!settings) {
      overlay.set(null)
      return
    }
    const picked = availableResolutions.find((item) => item.value === resolution)
    const next: IGameSettings = {
      ...settings,
      memory: { min: minMemory, max: maxAllocated },
      resolution: { width: picked?.width ?? 854, height: picked?.height ?? 480, fullscreen: resolution === 'fullscreen' },
      java: java === 'bundled' ? 'bundled' : 'system',
      launcherAction
    }
    saving = true
    try {
      const ok = await settingsApi.set(next)
      if (!ok) throw new Error('Settings were not saved')
      settings = next
      overlay.set(null)
    } catch (error) {
      logger.error('Could not save settings:', error)
      await showDialog('설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', [{ text: '닫기', type: 'ok' }])
    } finally {
      saving = false
    }
  }

  async function logout() {
    const confirmed = await showDialog('로그아웃하시겠어요?', [
      { text: '취소', type: 'cancel' },
      { text: '로그아웃', type: 'danger' }
    ])
    if (!confirmed) return
    await auth.logout()
    account.set(null)
    avatar.set(null)
    skins.set([])
    capes.set([])
    profileTokens.set({})
    selectedProfile.set(null)
    profiles.set([])
    overlay.set(null)
    page.set('login')
  }

  function chooseSkinSource(type: 'file' | 'url') {
    skinSourceType = type
    skinUrl = ''
    skinFile = null
    if (skinFileInput) skinFileInput.value = ''
  }

  function resetSkinFile() {
    skinFile = null
    if (skinFileInput) skinFileInput.value = ''
  }

  async function addSkin() {
    if (!canAddSkin) return
    try {
      const source = skinSourceType === 'url' ? skinUrl.trim() : await skinFile!.arrayBuffer()
      const updated = await skinApi.updateSkin(source, skinVariant)
      if (!Array.isArray(updated)) {
        await showDialog('스킨을 추가하지 못했습니다. URL이나 파일을 확인한 뒤 다시 시도해 주세요.', [{ text: '닫기', type: 'ok' }])
        return
      }
      skins.set(updated)
      skinUrl = ''
      resetSkinFile()
      scrollToTop()
    } catch (error) {
      logger.error('Error occurred while adding the skin:', error)
      await showDialog('스킨을 추가하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', [{ text: '닫기', type: 'ok' }])
    }
  }

  async function selectSkin(item: ISkin) {
    if (item.state === 'active') return
    try {
      const updated = await skinApi.updateSkin(item.url, item.variant as 'classic' | 'slim')
      if (!Array.isArray(updated)) throw new Error('Skin update failed')
      skins.set(updated)
      scrollToTop()
    } catch (error) {
      logger.error('Error occurred while changing the skin:', error)
      await showDialog('스킨을 변경하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', [{ text: '닫기', type: 'ok' }])
    }
  }

  async function deleteSkin(item: ISkin, event: MouseEvent) {
    event.stopPropagation()
    try {
      const updated = await skinApi.deleteSkin(item.id)
      if (!Array.isArray(updated)) throw new Error('Skin deletion failed')
      skins.set(updated)
    } catch (error) {
      logger.error('Error occurred while deleting the skin:', error)
      await showDialog('스킨을 삭제하는 중 오류가 발생했습니다.', [{ text: '확인', type: 'ok' }])
    }
  }

  async function selectCape(item?: ICape) {
    if (item ? item.state === 'active' : !activeCape) return
    try {
      const updated = item ? await skinApi.switchCape(item.id) : await skinApi.hideCape()
      if (!Array.isArray(updated)) throw new Error('Cape update failed')
      capes.set(updated)
      scrollToTop()
    } catch (error) {
      logger.error('Error occurred while changing the cape:', error)
      await showDialog(
        item ? '망토를 변경하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' : '망토를 해제하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        [{ text: '닫기', type: 'ok' }]
      )
    }
  }

  const accountTypes: Record<string, { label: string; icon: string }> = {
    msa: { label: 'Microsoft 계정', icon: 'fa-brands fa-microsoft' },
    yggdrasil: { label: 'Yggdrasil 계정', icon: 'fa-solid fa-user' },
    azuriom: { label: 'Azuriom 계정', icon: 'fa-solid fa-globe' },
    crack: { label: '오프라인 계정', icon: 'fa-solid fa-user-slash' }
  }
</script>

<div id="view-settings" class="view overlay" transition:fade={{ duration: 100 }}>
  <div class="settings-modal">
    <button class="btn btn-icon-only btn-close-absolute" aria-label="설정 닫기" disabled={saving} onclick={saveSettings}
      ><i class="fa-fw fa-solid fa-xmark"></i></button
    >

    <aside class="settings-sidebar">
      <h2>설정</h2>
      <nav>
        <button class="btn nav-btn" class:active={tab === 'game'} onclick={() => (tab = 'game')}
          ><i class="fa-fw fa-solid fa-cubes"></i><span>게임</span></button
        >
        <button class="btn nav-btn" class:active={tab === 'skin'} onclick={() => (tab = 'skin')}
          ><i class="fa-fw fa-solid fa-shirt"></i><span>스킨</span></button
        >
        <button class="btn nav-btn" class:active={tab === 'account'} onclick={() => (tab = 'account')}
          ><i class="fa-fw fa-solid fa-user"></i><span>계정</span></button
        >
      </nav>
      <p id="version">{version}</p>
    </aside>

    <main class="settings-content" id="settings-content" bind:this={settingsContent}>
      {#if tab === 'game'}
        <section id="tab-game" class="tab-content">
          <h3>Minecraft 설정</h3>

          <div class="setting-group">
            <label for="ram-min"><i class="fa-fw fa-solid fa-memory"></i>&nbsp;&nbsp;메모리 할당</label>

            <div class="dual-slider-container">
              <div class="slider-track"></div>
              <div class="slider-fill" style:left="{minPercent}%" style:width="{maxPercent - minPercent}%"></div>

              <input
                id="ram-min"
                type="range"
                min={RAM_STEP}
                max={maxMemory}
                step={RAM_STEP}
                value={minMemory}
                oninput={setMinMemory}
                aria-label="최소 메모리"
              />
              <input type="range" min={RAM_STEP} max={maxMemory} step={RAM_STEP} value={maxAllocated} oninput={setMaxMemory} aria-label="최대 메모리" />
            </div>

            <div class="ram-labels">
              <span>{minMemory} GB</span>
              <span>{maxAllocated} GB</span>
            </div>
          </div>

          <div class="setting-group">
            <label for="resolution-select"><i class="fa-fw fa-solid fa-display"></i>&nbsp;&nbsp;해상도</label>
            <select id="resolution-select" bind:value={resolution}>
              {#each availableResolutions as item (item.value)}<option value={item.value}>{item.label}</option>{/each}
            </select>
          </div>

          <div class="setting-group">
            <label for="launcher-action-select"><i class="fa-solid fa-power-off"></i>&nbsp;&nbsp;게임 실행 후 동작</label>
            <div class="select-wrapper">
              <select id="launcher-action-select" bind:value={launcherAction}>
                <option value="close">런처 닫기</option>
                <option value="keep">런처 열어 두기</option>
                <option value="hide">런처 숨기기 (최소화)</option>
              </select>
            </div>
          </div>

          <div class="setting-group">
            <label for="java-select"><i class="fa-brands fa-java"></i>&nbsp;&nbsp;Java 버전</label>
            <div class="java-selector">
              <select id="java-select" bind:value={java}>
                <option value="bundled">내장 Java 사용 (권장)</option>
                <option value="system">시스템 Java 사용 (PATH)</option>
              </select>
            </div>
          </div>
        </section>
      {:else if tab === 'skin'}
        <section id="tab-skin" class="tab-content skin-management">
          <h3>스킨 관리</h3>

          <canvas bind:this={canvas} id="skin-container" aria-label="3D 스킨 미리보기"></canvas>

          <div class="setting-group">
            <p class="setting-group-label"><i class="fa-fw fa-solid fa-shirt"></i>&nbsp;&nbsp;스킨</p>

            <div id="skin-gallery" class="skin-gallery">
              {#each $skins as item (item.id)}
                <div
                  class="skin-preview"
                  class:active={item.state === 'active'}
                  role="button"
                  tabindex="0"
                  aria-label="스킨 사용"
                  onclick={() => selectSkin(item)}
                  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectSkin(item)}
                >
                  {#if skinThumbnails.get(skinThumbnailKey(item))}
                    <img src={skinThumbnails.get(skinThumbnailKey(item))} alt="스킨 미리보기" />
                  {:else}
                    <span class="thumb-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></span>
                  {/if}
                  {#if item.state === 'inactive' && item.id !== 'steve' && item.id !== 'alex'}
                    <button class="btn-delete-skin btn btn-secondary" aria-label="스킨 삭제" onclick={(e) => deleteSkin(item, e)}
                      ><i class="fa-solid fa-times"></i></button
                    >
                  {/if}
                </div>
              {/each}
            </div>

            <div id="add-skin" class="add-skin">
              <p class="add-skin-title">스킨 추가</p>
              <div class="btns-add-skin">
                <button class="btn-add-skin" class:active={skinSourceType === 'file'} onclick={() => chooseSkinSource('file')}>파일</button>
                <button class="btn-add-skin" class:active={skinSourceType === 'url'} onclick={() => chooseSkinSource('url')}>URL</button>
              </div>

              {#if skinSourceType === 'file'}
                <label for="input-add-skin-file">스킨 파일:</label>
                <input
                  bind:this={skinFileInput}
                  id="input-add-skin-file"
                  type="file"
                  accept=".png"
                  onchange={(e) => (skinFile = e.currentTarget.files?.[0] ?? null)}
                />
                {#if skinFile}
                  <div class="selected-file">
                    <span>{skinFile.name}</span>
                    <button class="btn btn-secondary btn-reset" aria-label="선택한 파일 지우기" onclick={resetSkinFile}
                      ><i class="fa-solid fa-times"></i></button
                    >
                  </div>
                {:else}
                  <button class="btn btn-choose-file btn-secondary" onclick={() => skinFileInput?.click()}>파일 선택...</button>
                {/if}
              {:else}
                <label for="input-add-skin-url">스킨 URL:</label>
                <input id="input-add-skin-url" type="text" bind:value={skinUrl} placeholder="https://..." />
              {/if}

              <label for="input-add-skin-variant-classic">모델:</label>
              <div class="variant-options">
                <input id="input-add-skin-variant-classic" type="radio" bind:group={skinVariant} value="classic" />
                <label for="input-add-skin-variant-classic">클래식</label>
                <input id="input-add-skin-variant-slim" type="radio" bind:group={skinVariant} value="slim" />
                <label for="input-add-skin-variant-slim">슬림</label>
              </div>

              <button class="add-skin-btn-submit btn btn-secondary" disabled={!canAddSkin} onclick={addSkin}>추가 후 적용</button>
            </div>
          </div>

          <div class="setting-group">
            <p class="setting-group-label"><i class="fa-fw fa-solid fa-square"></i>&nbsp;&nbsp;망토</p>

            <div id="cape-gallery" class="skin-gallery">
              <button type="button" class="cape-preview" class:active={!activeCape} aria-label="망토 해제" onclick={() => selectCape()}>
                <span><i class="fa-solid fa-ban"></i></span>
              </button>
              {#each $capes as item (item.id)}
                <button type="button" class="cape-preview" class:active={item.state === 'active'} aria-label="{item.alias} 사용" onclick={() => selectCape(item)}>
                  {#if capeThumbnails.get(item.url)}<img src={capeThumbnails.get(item.url)} alt="" />{/if}
                  <span>{item.alias}</span>
                </button>
              {/each}
            </div>
          </div>
        </section>
      {:else}
        <section id="tab-account" class="tab-content">
          <h3>계정 관리</h3>

          <div class="account-card">
            <div class="account-header">
              <img src={$avatar?.url ?? 'https://minotar.net/avatar/steve/256.png'} alt="스킨" class="account-avatar" />
              <div class="account-details">
                <span class="account-name">{$account?.name}</span>
                <span class="account-uuid">UUID: {$account?.uuid}</span>
                <span class="account-type"
                  ><i class={accountTypes[accountType]?.icon ?? 'fa-solid fa-user'}></i>{accountTypes[accountType]?.label ?? '알 수 없는 계정 유형'}</span
                >
              </div>
            </div>

            <div class="account-actions">
              <a href="https://www.xbox.com/play/user" target="_blank" rel="noreferrer" class="btn btn-secondary">
                <i class="fa-fw fa-solid fa-external-link-alt"></i><span>Xbox 계정 관리</span>
              </a>
              <button class="btn btn-danger" onclick={logout}><i class="fa-fw fa-solid fa-right-from-bracket"></i><span>로그아웃</span></button>
            </div>
          </div>
        </section>
      {/if}
    </main>
  </div>
</div>
