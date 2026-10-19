<script lang="ts">
  import { onMount } from 'svelte'
  import DOMPurify from 'dompurify'
  import { marked } from 'marked'
  import logger from 'electron-log/renderer'
  import type { IProfile } from 'eml-lib'
  import { game, news as newsApi, profiles as profilesApi, server, settings as settingsApi } from '../ipc'
  import logo from '../static/images/logo.png'
  import { account, avatar, get as getStoreValue, overlay, profileTokens, profiles, requestedProfile, selectedProfile, showDialog } from './stores'

  type NewsFeedItem = {
    id?: string
    title: string
    content: string
    author: { username?: string | null }
    createdAt: Date | string
    image?: string | null
    tags?: Array<{ title?: string; name?: string; color: string }>
  }

  const DEFAULT_PROFILE_PORT = 25565
  const LAUNCHED_HIDE_DELAY = 10_000

  let newsItems = $state<NewsFeedItem[]>([])
  let newsLoading = $state(true)
  let newsError = $state(false)
  let profileMenuOpen = $state(false)
  let profileSelector = $state<HTMLDivElement | undefined>()
  let serverState = $state<'pinging' | 'online' | 'offline'>('pinging')
  let players = $state('')
  let launch = $state<{ visible: boolean; label: string; percent: number | null; indeterminate: boolean }>({
    visible: false,
    label: '다운로드 준비 중...',
    percent: 0,
    indeterminate: true
  })
  let totalBytes = $state(0)
  let downloaded = $state<Record<string, number>>({})
  let statusRequest = 0
  let profileRequest = 0

  const SEEN_KEY = 'news-last-seen'
  let newsOpen = $state(false)
  let lastSeen = $state(localStorage.getItem(SEEN_KEY))
  const latestKey = $derived(newsItems[0] ? (newsItems[0].id ?? String(newsItems[0].createdAt)) : null)
  const hasNew = $derived(!!latestKey && latestKey !== lastSeen)

  function setNewsOpen(open: boolean) {
    newsOpen = open
    if (open && latestKey) {
      lastSeen = latestKey
      localStorage.setItem(SEEN_KEY, latestKey)
    }
  }

  marked.use({
    renderer: {
      link(link) {
        const title = link.title ? ` title="${link.title}"` : ''
        return `<a href="${link.href ?? '#'}" target="_blank" rel="noopener noreferrer"${title}>${link.text}</a>`
      }
    }
  })

  onMount(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!profileSelector?.contains(event.target as Node)) profileMenuOpen = false
    }
    window.addEventListener('click', closeMenu)
    void loadNews()

    let launchedTimer: number | undefined
    const unsubscribe = [
      game.launchComputeDownload(() => setLaunchStep('다운로드 준비 중...')),
      game.launchDownload((download) => {
        totalBytes = download.total.size
        downloaded = {}
        launch = { visible: true, label: '파일 다운로드 중...', percent: 0, indeterminate: false }
      }),
      game.downloadProgress((progress) => {
        downloaded[progress.type] = progress.downloaded.size
        const amount = Object.values(downloaded).reduce((sum, value) => sum + value, 0)
        const percent = totalBytes ? Math.min((amount / totalBytes) * 100, 100) : 0
        launch = { visible: true, label: `${progress.type === 'JAVA' ? 'Java' : '게임 파일'} 다운로드 중...`, percent, indeterminate: false }
      }),
      game.downloadError((error) => {
        if (!launch.visible) return
        launch = { ...launch, visible: false }
        logger.error('Game download failed:', error)
        void showDialog('게임 파일을 다운로드하지 못했습니다. 잠시 후 다시 시도해 주세요.', [{ text: '확인', type: 'ok' }])
      }),
      game.launchInstallLoader(() => setLaunchStep('파일 압축 해제 중...')),
      game.launchExtractNatives(() => setLaunchStep('파일 압축 해제 중...')),
      game.launchCopyAssets(() => setLaunchStep('파일 압축 해제 중...')),
      game.launchPatchLoader(() => setLaunchStep('설치 마무리 중...')),
      game.launchLaunch(() => setLaunchStep('게임 시작 중...')),
      game.patchError((error) => {
        if (!launch.visible) return
        launch = { ...launch, visible: false }
        logger.error('Game patching failed:', error)
        void showDialog('게임 설치에 실패했습니다. 잠시 후 다시 시도해 주세요.', [{ text: '확인', type: 'ok' }])
      }),
      game.launched(() => {
        window.clearTimeout(launchedTimer)
        launchedTimer = window.setTimeout(() => {
          launch = { ...launch, visible: false }
        }, LAUNCHED_HIDE_DELAY)
      })
    ]
    return () => {
      window.removeEventListener('click', closeMenu)
      window.clearTimeout(launchedTimer)
      unsubscribe.forEach((dispose) => dispose())
    }
  })

  async function loadNews() {
    newsLoading = true
    newsError = false
    try {
      newsItems = ((await newsApi.getNews()) ?? []) as unknown as NewsFeedItem[]
    } catch (error) {
      logger.error('Could not load news:', error)
      newsError = true
    } finally {
      newsLoading = false
    }
  }

  async function refreshServerStatus(profile: IProfile | null) {
    const request = ++statusRequest
    serverState = 'pinging'
    players = ''
    const status = profile?.ip ? await server.getStatus(profile.ip, profile.port || DEFAULT_PROFILE_PORT).catch(() => null) : null
    if (request !== statusRequest) return
    serverState = status ? 'online' : 'offline'
    if (status) players = `${status.players.online.toLocaleString()} / ${status.players.max.toLocaleString()}`
  }

  function isLocked(profile: IProfile | null) {
    return profile?.visibility === 'PROTECTED' && !$profileTokens[profile.slug]
  }

  function requestUnlock(profile: IProfile) {
    requestedProfile.set(profile)
    overlay.set('profile')
  }

  function chooseProfile(profile: IProfile) {
    if (isLocked(profile)) requestUnlock(profile)
    else selectedProfile.set(profile)
    profileMenuOpen = false
  }

  function renderMarkdown(content: string) {
    const parsed = marked.parse(content, { async: false, gfm: true }) as string
    return DOMPurify.sanitize(parsed, { ADD_ATTR: ['target', 'rel'] })
  }

  function formatDate(value: Date | string) {
    return new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const isHexColor = (color: string) => /^#[\da-f]{6}$/i.test(color)

  function tagColor(color: string) {
    return isHexColor(color) ? `color-mix(in srgb, ${color} 55%, var(--brand-ink))` : undefined
  }

  function tagBackground(color: string) {
    if (!isHexColor(color)) return 'var(--overlay-10)'
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, 0.18)`
  }

  async function startGame() {
    if (!$account || launch.visible) return
    const profile = $selectedProfile
    if (profile && isLocked(profile)) {
      requestUnlock(profile)
      return
    }

    launch = { visible: true, label: '다운로드 준비 중...', percent: null, indeterminate: true }
    totalBytes = 0
    downloaded = {}
    try {
      const config = await settingsApi.get()

      const message = `
Ready to launch the game with the following settings:

👤 Account: ${$account.name}
🧠 RAM: ${config.memory.min} - ${config.memory.max}
☕️ Java: ${config.java}
🖥️ Resolution: ${config.resolution.width}x${config.resolution.height}
🚀 Action on launch: ${config.launcherAction}
`

      logger.log(message)

      await game.launch({
        account: $account,
        settings: config,
        profileSlug: profile?.slug,
        token: profile?.slug ? $profileTokens[profile.slug] : undefined
      })
    } catch (error) {
      launch = { ...launch, visible: false }
      logger.error('Could not launch the game:', error)
      await showDialog('게임을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.', [{ text: '확인', type: 'ok' }])
    }
  }

  function setLaunchStep(label: string) {
    launch = { visible: true, label, percent: null, indeterminate: true }
  }

  $effect(() => {
    void refreshServerStatus($selectedProfile)
  })

  $effect(() => {
    const currentAccount = $account
    const request = ++profileRequest
    if (!currentAccount) {
      profiles.set([])
      selectedProfile.set(null)
      return
    }

    void profilesApi
      .get(currentAccount)
      .then((result) => {
        if (request !== profileRequest) return
        const list = (result ?? []).filter(Boolean)
        profiles.set(list)
        const current = getStoreValue(selectedProfile)
        if (current && list.some((profile) => profile.slug === current.slug)) return
        selectedProfile.set(list.find((profile) => profile.visibility !== 'PROTECTED') ?? null)
      })
      .catch((error) => {
        if (request === profileRequest) logger.error('Could not load profiles:', error)
      })
  })
</script>

{#snippet accountChip()}
  <div class="hv-account">
    <img src={$avatar?.url ?? 'https://minotar.net/avatar/steve/256.png'} alt="스킨" />
    <span>{$account?.name ?? ''}</span>
  </div>
{/snippet}

{#snippet settingsButton()}
  <button class="hv-icon-btn" title="설정" aria-label="설정" onclick={() => overlay.set('settings')}><i class="fa-fw fa-solid fa-gear"></i></button>
{/snippet}

{#snippet socialLinks()}
  <a href="https://discord.yayokorea.net" target="_blank" rel="noreferrer" class="hv-icon-btn" aria-label="Discord"><i class="fa-brands fa-discord"></i></a>
  <a href="https://mc.yayokorea.net" target="_blank" rel="noreferrer" class="hv-icon-btn" aria-label="웹사이트"><i class="fa-solid fa-globe"></i></a>
{/snippet}

{#snippet profileSelect()}
  <div class="hv-profile" class:open={profileMenuOpen} bind:this={profileSelector}>
    <button class="hv-profile-current" aria-expanded={profileMenuOpen} onclick={() => (profileMenuOpen = !profileMenuOpen)}>
      <span>{$selectedProfile?.name ?? '프로필 선택'}</span><i class="fa-solid fa-chevron-down"></i>
    </button>
    {#if profileMenuOpen}
      <div class="hv-profile-list">
        {#each $profiles as item (item.slug)}
          <button class="hv-profile-option" class:active={$selectedProfile?.slug === item.slug} onclick={() => chooseProfile(item)}>
            {#if item.visibility === 'PROTECTED'}<i class="fa-fw fa-solid" class:fa-lock={!$profileTokens[item.slug]} class:fa-lock-open={!!$profileTokens[item.slug]}></i>{/if}
            <span>{item.name}</span>
          </button>
        {/each}
        {#if !$profiles.length}<span class="hv-profile-empty">사용 가능한 프로필이 없습니다.</span>{/if}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet serverStatus()}
  <div class="hv-status">
    <span class="hv-dot" class:pinging={serverState === 'pinging'} class:online={serverState === 'online'} class:offline={serverState === 'offline'}></span>
    <span>{serverState === 'pinging' ? '확인 중...' : serverState === 'online' ? '온라인' : '오프라인'}</span>
    {#if players}<span class="hv-players"><i class="fa-fw fa-solid fa-users"></i>{players}</span>{/if}
  </div>
{/snippet}

{#snippet playArea()}
  {#if !launch.visible}
    <button class="hv-play" onclick={startGame}><i class="fa-solid fa-play"></i><span>플레이</span></button>
  {:else}
    <div class="hv-progress">
      <div class="hv-progress-info">
        <span>{launch.label}</span>
        <span>{launch.percent === null ? '' : `${Math.round(launch.percent)}%`}</span>
      </div>
      <div class="hv-progress-bg">
        <div class="hv-progress-fill" class:indeterminate={launch.indeterminate} style:width={launch.percent === null ? undefined : `${launch.percent}%`}></div>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet newsList()}
  {#if newsLoading}
    <div class="hv-news-empty">뉴스를 불러오는 중...</div>
  {:else if newsError}
    <div class="hv-news-empty"><span>뉴스를 불러오지 못했습니다.</span> <button class="hv-link" onclick={loadNews}>다시 시도</button></div>
  {:else if !newsItems.length}
    <div class="hv-news-empty">표시할 뉴스가 없습니다.</div>
  {:else}
    {#each newsItems as item (item.id ?? String(item.createdAt))}
      <article class="hv-card">
        {#if item.image}
          <img class="hv-card-image" src={item.image} alt="뉴스 이미지" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
        {/if}
        <div class="hv-card-body">
          <div class="hv-card-tags">
            {#each item.tags ?? [] as tag}
              <span class="hv-tag" style:color={tagColor(tag.color)} style:background-color={tagBackground(tag.color)}>{tag.name ?? tag.title ?? ''}</span>
            {/each}
          </div>
          <h3>{item.title}</h3>
          <div class="hv-card-meta">
            <img src={`https://heads.discordsrv.com/${encodeURIComponent(item.author.username ?? 'steve')}/overlay/100`} alt="작성자" />
            <span>{item.author.username ?? '운영팀'}</span>
            <span>·</span>
            <span>{formatDate(item.createdAt)}</span>
          </div>
          <div class="hv-card-content">{@html renderMarkdown(item.content)}</div>
        </div>
      </article>
    {/each}
  {/if}
{/snippet}

{#snippet newDot()}<b class="hv-new" role="img" aria-label="새 소식"></b>{/snippet}

<svelte:window onkeydown={(event) => event.key === 'Escape' && newsOpen && setNewsOpen(false)} />

<!-- Minecraft title-screen style menu with a collapsible news drawer -->
<div class="view hv" class:hv-open={newsOpen}>
  <section class="hv-menu">
    <div class="hv-brand">
      <img class="hv-logo" src={logo} alt="" />
      <h1 class="wordmark"><span>Yayo</span><em>Launcher</em></h1>
    </div>
    <div class="hv-menu-stack">
      {@render playArea()}
      {@render profileSelect()}
      <div class="hv-menu-row">{@render settingsButton()}{@render socialLinks()}</div>
      {@render serverStatus()}
    </div>
    {@render accountChip()}
  </section>

  <aside class="hv-drawer" class:open={newsOpen}>
    <button class="hv-drawer-tab" aria-expanded={newsOpen} aria-controls="hv-drawer-panel" onclick={() => setNewsOpen(!newsOpen)}>
      <i class="fa-solid" class:fa-chevron-left={!newsOpen} class:fa-chevron-right={newsOpen}></i>
      <span>뉴스</span>
      {#if hasNew}{@render newDot()}{/if}
    </button>
    <div class="hv-panel" id="hv-drawer-panel" inert={!newsOpen}>
      <h2>뉴스</h2>
      <div class="hv-news-list">{@render newsList()}</div>
    </div>
  </aside>
</div>
