// E2E: camera tile plumbing without a real camera — add a camera pointing at a
// connection-refused RTSP URL, place the tile, verify the graceful retry state,
// and confirm camera + tile persist across relaunch. (Real video can only be
// verified against an actual RTSP camera.)
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-cam-'))
mkdirSync('shots', { recursive: true })

async function launch() {
  const app = await electron.launch({
    executablePath: electronPath,
    args: ['out/main/index.js', '--windowed'],
    env: { ...process.env, OSL_USER_DATA: userData }
  })
  const page = await app.firstWindow()
  await page.waitForSelector('[data-tile-type="todayEvents"]', { timeout: 15000 })
  return { app, page }
}

{
  const { app, page } = await launch()
  try {
    await page.getByLabel('Customize home screen').click()
    await page.getByLabel('Remove This week').click() // make room
    await page.getByRole('button', { name: 'Add tile' }).click()
    await page.getByRole('button', { name: /Camera Live view/ }).click()
    await page.waitForSelector('text=Which camera?', { timeout: 5000 })

    await page.getByPlaceholder('Name (e.g. Front door)').fill('Test cam')
    await page.getByPlaceholder(/^rtsp:\/\//).fill('rtsp://127.0.0.1:1/nope')
    await page.getByRole('button', { name: 'Add camera & place tile' }).click()
    await page.waitForSelector('[data-tile-type="camera"]', { timeout: 5000 })
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.waitForSelector('text=Done', { state: 'detached', timeout: 5000 })

    // tile shows the camera name, then the unreachable stream resolves to the retry state
    await page.waitForSelector('text=Test cam', { timeout: 5000 })
    await page.waitForSelector('text=Camera unavailable', { timeout: 25000 })
    await page.screenshot({ path: 'shots/camera-tile.png' })
  } finally {
    await app.close()
  }
}

{
  const { app, page } = await launch()
  try {
    const state = await page.evaluate(async () => {
      const settings = await window.osl.invoke('settings:getAll', undefined)
      const cameras = await window.osl.invoke('camera:list', undefined)
      return {
        tile: settings.data.homeLayout.find((t) => t.type === 'camera'),
        cameras: cameras.data
      }
    })
    if (!state.tile?.config?.cameraId) throw new Error(`camera tile config missing: ${JSON.stringify(state.tile)}`)
    if (state.cameras.length !== 1 || state.cameras[0].name !== 'Test cam')
      throw new Error(`cameras not persisted: ${JSON.stringify(state.cameras)}`)
    if (state.cameras[0].id !== state.tile.config.cameraId) throw new Error('tile points at the wrong camera')
    await page.waitForSelector('[data-tile-type="camera"]', { timeout: 5000 })
    console.log('CAMERA E2E PASS: camera added, tile placed, retry state shown, persisted across relaunch')
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
}
