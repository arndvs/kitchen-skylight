// Seeds several family members and screenshots the header to inspect the
// person-chip overflow.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-hdr-'))
mkdirSync('shots', { recursive: true })

const app = await electron.launch({
  executablePath: electronPath,
  args: ['out/main/index.js', '--windowed'],
  env: { ...process.env, OSL_USER_DATA: userData }
})
try {
  const page = await app.firstWindow()
  await page.waitForSelector('[data-tile-type="clock"]', { timeout: 15000 })
  await page.evaluate(async () => {
    const people = [
      ['Emma', '#46A758'],
      ['Leo', '#0091FF'],
      ['Olivia', '#D6409F'],
      ['Grandma Sue', '#6E56CF'],
      ['Dad', '#F76B15']
    ]
    for (const [name, color] of people) {
      await window.osl.invoke('people:create', { name, color, role: 'child' })
    }
    await window.osl.invoke('settings:set', { patch: { theme: 'light' } })
  })
  await page.reload()
  await page.waitForSelector('[data-tile-type="clock"]', { timeout: 15000 })
  await page.waitForTimeout(600)
  const header = await page.locator('header').boundingBox()
  const clip = { x: 0, y: 0, width: 1280, height: Math.ceil(header.y + header.height + 8) }
  await page.screenshot({ path: 'shots/header-fixed.png', clip })
  // toggle one person off to verify the dimmed state
  await page.getByLabel('Hide Leo').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'shots/header-toggled.png', clip })
  // the tightest case: Week view shows the period nav too
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'shots/header-week.png', clip })
  console.log('saved')
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
