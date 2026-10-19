<script lang="ts">
  import { loginWithMicrosoft } from './session'
  import { showDialog } from './stores'
  import logger from 'electron-log/renderer'
  import logo from '../static/images/logo.png'

  let connecting = $state(false)

  async function login() {
    connecting = true
    try {
      const error = await loginWithMicrosoft()
      if (error !== null) {
        logger.error(error)
        await showDialog('로그인에 실패했습니다.', [{ text: '확인', type: 'ok' }])
      }
    } catch (error) {
      logger.error(error)
      await showDialog('로그인 중 오류가 발생했습니다.', [{ text: '확인', type: 'ok' }])
    } finally {
      connecting = false
    }
  }
</script>

<div id="view-login" class="view">
  <div class="login-card">
    <img src={logo} class="logo" alt="로고" />
    <h1 class="wordmark"><span>Yayo</span><em>Launcher</em></h1>
    <p class="welcome">환영합니다</p>
    <p class="subtitle">계정을 확인하려면 로그인해 주세요.</p>

    <button class="btn btn-microsoft" disabled={connecting} onclick={login}>
      {#if connecting}<i class="fa-solid fa-circle-notch fa-spin"></i>{:else}<i class="fa-brands fa-microsoft"></i>{/if}
      <span>{connecting ? '연결 중...' : 'Microsoft로 로그인'}</span>
    </button>

    <div class="login-footer">
      <small>계정이 없으신가요? <a href="https://microsoft.com" target="_blank" rel="noreferrer">여기에서 만들기</a></small>
    </div>
  </div>
</div>
