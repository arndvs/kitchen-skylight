// E2E: add a News tile from the preset picker, save, relaunch, verify it
// persisted with the chosen feed. Headlines load from the live feed when the
// network allows; the retry state is also acceptable.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-news-'))
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
    // make room: the default layout is full
    await page.getByLabel('Remove This week').click()
    await page.getByRole('button', { name: 'Add tile' }).click()
    await page.getByRole('button', { name: /News headlines/ }).click()
    await page.waitForSelector('text=Which news feed?', { timeout: 5000 })
    await page.waitForSelector('text=United States', { timeout: 5000 })
    await page.getByRole('button', { name: 'NPR News', exact: true }).click()
    await page.waitForSelector('[data-tile-type="news"]', { timeout: 5000 })
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.waitForSelector('text=Done', { state: 'detached', timeout: 5000 })

    // headlines (live) or the graceful retry state — both fine
    await page.waitForSelector('text=NPR NEWS', { timeout: 5000 })
    await page
      .waitForFunction(
        () => {
          const tile = document.querySelector('[data-tile-type="news"]')
          return tile && !tile.textContent.includes('Loading headlines')
        },
        null,
        { timeout: 20000 }
      )
      .catch(() => {})
    await page.screenshot({ path: 'shots/news-tile.png' })
  } finally {
    await app.close()
  }
}

{
  const { app, page } = await launch()
  try {
    const layout = await page.evaluate(async () => {
      const res = await window.osl.invoke('settings:getAll', undefined)
      return res.data.homeLayout
    })
    const news = layout.find((t) => t.type === 'news')
    if (!news || news.config?.feedId !== 'npr') throw new Error(`persisted news tile wrong: ${JSON.stringify(news)}`)
    await page.waitForSelector('[data-tile-type="news"]', { timeout: 5000 })
    console.log('NEWS E2E PASS: preset picked, tile added, persisted across relaunch')
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
}
