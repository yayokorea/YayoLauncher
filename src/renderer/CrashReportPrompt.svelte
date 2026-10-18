<script lang="ts">
  import { onMount } from 'svelte'
  import logger from 'electron-log/renderer'
  import { crashReports, type CrashNotice } from '../ipc'
  import { showDialog } from './stores'

  const queue: CrashNotice[] = []
  let showingPrompt = false

  onMount(() =>
    crashReports.onDetected((notice) => {
      queue.push(notice)
      void processQueue()
    })
  )

  async function processQueue() {
    if (showingPrompt) return
    showingPrompt = true

    try {
      while (queue.length) {
        const report = queue.shift()!
        const accepted = await showDialog<boolean>(
          `Minecraft가 예기치 않게 종료되었습니다. (종료 코드 ${report.exitCode}) 개인 정보를 제외한 크래시 리포트를 보내시겠어요?`,
          [
            { text: '보내지 않기', type: 'cancel' },
            { text: '리포트 보내기', type: 'ok' }
          ],
          '게임이 비정상 종료되었습니다'
        )

        if (!accepted) {
          await dismiss(report.id)
          continue
        }

        let sent = false
        while (!sent) {
          const result = await crashReports.send(report.id).catch((error) => {
            logger.error('Could not send the crash report:', error)
            return { success: false, error: undefined }
          })
          if (result.success) {
            sent = true
            await showDialog('크래시 리포트를 전송했습니다. 감사합니다.', [{ text: '확인', type: 'ok' }], '전송 완료')
            continue
          }

          const retry = await showDialog<boolean>(
            `크래시 리포트를 전송하지 못했습니다.${result.error ? ` (${result.error})` : ' 네트워크 연결을 확인해 주세요.'} 다시 시도하시겠어요?`,
            [
              { text: '닫기', type: 'cancel' },
              { text: '다시 시도', type: 'ok' }
            ],
            '전송 실패'
          )
          if (!retry) {
            await dismiss(report.id)
            break
          }
        }
      }
    } finally {
      showingPrompt = false
      if (queue.length) void processQueue()
    }
  }

  async function dismiss(id: string) {
    try {
      await crashReports.dismiss(id)
    } catch (error) {
      logger.error('Could not dismiss the crash report:', error)
    }
  }
</script>
