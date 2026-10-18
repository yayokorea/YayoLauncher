<script lang="ts">
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import logger from 'electron-log/renderer'
  import type { IProfile } from 'eml-lib'
  import { overlay, profileTokens, requestedProfile, selectedProfile } from './stores'
  import { profiles as profileApi } from '../ipc'

  let { profile }: { profile: IProfile } = $props()
  let password = $state('')
  let error = $state('')
  let submitting = $state(false)
  let passwordInput = $state<HTMLInputElement | undefined>()
  let previousSlug = $state<string | undefined>()

  onMount(() => passwordInput?.focus())

  $effect(() => {
    const slug = profile.slug
    if (previousSlug !== undefined && slug !== previousSlug) {
      password = ''
      error = ''
    }
    previousSlug = slug
  })

  async function unlock() {
    if (!password.trim() || submitting) return
    submitting = true
    error = ''
    try {
      const result = await profileApi.auth(profile.slug, password)
      if (!result.success) {
        error = '인증에 실패했습니다. 비밀번호를 확인한 뒤 다시 시도해 주세요.'
        password = ''
        return
      }
      profileTokens.update((tokens) => ({ ...tokens, [profile.slug]: result.token }))
      selectedProfile.set(profile)
      overlay.set(null)
      requestedProfile.set(null)
    } catch (err) {
      logger.error('Profile authentication failed:', err)
      error = '프로필 인증 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    } finally {
      submitting = false
    }
  }

  function close() {
    overlay.set(null)
    requestedProfile.set(null)
  }
</script>

<div
  id="view-profile"
  class="view overlay"
  transition:fade={{ duration: 100 }}
  role="presentation"
  onclick={(e) => e.target === e.currentTarget && close()}
>
  <div class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="unlock-profile-title">
    <button class="btn btn-icon-only btn-close-absolute" aria-label="닫기" onclick={close}><i class="fa-fw fa-solid fa-xmark"></i></button>
    <div class="profile-content">
      <h2 id="unlock-profile-title">{profile.name}</h2>
      <p class="subtitle">비밀번호를 입력해 프로필 잠금을 해제해 주세요.</p>

      <label for="profile-password">비밀번호:</label>
      <input
        id="profile-password"
        type="password"
        bind:this={passwordInput}
        bind:value={password}
        placeholder="비밀번호 입력"
        onkeydown={(e) => e.key === 'Enter' && unlock()}
      />
      {#if error}<p class="error-message" role="alert">{error}</p>{/if}

      <button class="btn btn-secondary unlock-profile-btn-submit" disabled={submitting || !password.trim()} onclick={unlock}>
        {submitting ? '해제 중...' : '잠금 해제'}
      </button>
    </div>
  </div>
</div>
