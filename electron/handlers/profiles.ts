import { ipcMain } from 'electron'
import { Account, Profiles } from 'eml-lib'
import logger from 'electron-log/main'
import { ADMINTOOL_URL } from '../const'

export function registerProfilesHandlers() {
  ipcMain.handle('profiles:get', async (_event, account: Account) => {
    if (!account?.uuid) return []
    try {
      const profiles = new Profiles(ADMINTOOL_URL)
      const list = await profiles.getProfiles(account)
      const sorted = [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
      return sorted
    } catch (err) {
      logger.error('Failed to fetch profiles:', err)
      return []
    }
  })

  ipcMain.handle('profiles:auth', async (_event, slug: string, password: string) => {
    try {
      const profiles = new Profiles(ADMINTOOL_URL)
      const auth = await profiles.auth(slug, password)
      return { success: true, token: auth.token, slug: auth.slug }
    } catch (err: any) {
      logger.error('Failed to authenticate profile:', err)
      if (err?.code === 'TOO_MANY_REQUESTS') {
        return { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
      } else if (err?.code === 'AUTH_ERROR') {
        return { success: false, error: err.message ?? '인증에 실패했습니다.' }
      }
      return { success: false, error: '알 수 없는 오류가 발생했습니다.' }
    }
  })
}
