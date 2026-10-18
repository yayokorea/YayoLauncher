import { SvelteMap } from 'svelte/reactivity'
import { SkinViewer, WalkingAnimation } from 'skinview3d'
import type { ICape, ISkin } from 'eml-lib'
import logger from 'electron-log/renderer'

export const skinThumbnails = new SvelteMap<string, string>()
export const capeThumbnails = new SvelteMap<string, string>()

export const skinThumbnailKey = (item: Pick<ISkin, 'url' | 'variant'>) => `${item.url}-${item.variant}`

let auxiliaryViewer: SkinViewer | null = null
let queue: Promise<void> = Promise.resolve()

function getAuxiliaryViewer() {
  if (!auxiliaryViewer) {
    auxiliaryViewer = new SkinViewer({ canvas: document.createElement('canvas'), width: 159.3, height: 180 })
    auxiliaryViewer.animation = new WalkingAnimation()
    auxiliaryViewer.animation.progress = 0.5
    auxiliaryViewer.animation.speed = 0
    auxiliaryViewer.zoom = 0.8
    auxiliaryViewer.camera.position.set(-20, -2, 35)
    auxiliaryViewer.controls.enabled = false
  }
  return auxiliaryViewer
}

async function renderSkin(item: ISkin) {
  const key = skinThumbnailKey(item)
  if (skinThumbnails.has(key)) return
  try {
    const viewer = getAuxiliaryViewer()
    await viewer.loadSkin(item.url, { model: item.variant === 'slim' ? 'slim' : 'default' })
    viewer.render()
    skinThumbnails.set(key, viewer.canvas.toDataURL())
  } catch (error) {
    logger.warn('Could not render skin thumbnail:', error)
  }
}

async function renderCape(item: ICape) {
  if (capeThumbnails.has(item.url)) return
  try {
    const image = await createImageBitmap(await (await fetch(item.url)).blob())
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 160
    const context = canvas.getContext('2d')!
    context.imageSmoothingEnabled = false
    context.drawImage(image, 1, 1, 10, 16, 0, 0, 100, 160)
    image.close()
    capeThumbnails.set(item.url, canvas.toDataURL())
  } catch (error) {
    logger.warn('Could not render cape thumbnail:', error)
  }
}

/** Renders the missing thumbnails one after another (the auxiliary viewer can only load a single skin at a time). */
export function ensureSkinThumbnails(items: ISkin[]) {
  for (const item of items) {
    if (!skinThumbnails.has(skinThumbnailKey(item))) queue = queue.then(() => renderSkin(item))
  }
}

export function ensureCapeThumbnails(items: ICape[]) {
  for (const item of items) {
    if (!capeThumbnails.has(item.url)) queue = queue.then(() => renderCape(item))
  }
}
