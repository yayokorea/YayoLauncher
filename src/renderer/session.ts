import type { Account } from 'eml-lib'
import { auth, skin } from '../ipc'
import { account, avatar, capes, page, skins } from './stores'

export async function loadSessionAssets(user: Account) {
  await skin.reload(user)
  const [userSkins, userCapes, userAvatar] = await Promise.all([skin.getSkin(user), skin.getCape(user), skin.getAvatar(user)])
  account.set(user)
  skins.set(userSkins ?? [])
  capes.set(userCapes ?? [])
  avatar.set(userAvatar)
}

/**
 * Opens the Microsoft login flow. Resolves with the error message on failure, or `null` once logged in.
 */
export async function loginWithMicrosoft(): Promise<string | null> {
  const session = await auth.login()
  if (!session.success) return session.error
  await loadSessionAssets(session.account)
  page.set('home')
  return null
}
