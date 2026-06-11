// One-off: verify the Companion settings card + QR pairing dialog render.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-cset-'))
mkdirSync('shots', { recursive: true })

const app = await electron.launch({
  executablePath: electronPath,
  args: ['out/main/index.js', '--windowed'],
  env: { ...process.env, OSL_USER_DATA: userData }
})
try {
  const page = await app.firstWindow()
  await page.waitForSelector('[data-tile-type="todayEvents"]', { timeout: 15000 })
  await page.getByLabel('Settings').click()
  await page.getByRole('button', { name: 'General' }).click()
  await page.getByText('Companion app', { exact: true }).scrollIntoViewIfNeeded()
  // enable it
  await page.getByLabel('Companion app').click()
  await page.waitForSelector('text=Pair a phone', { timeout: 5000 })
  await page.waitForTimeout(1200) // status poll picks up "running"
  await page.screenshot({ path: 'shots/companion-settings.png' })
  await page.getByRole('button', { name: 'Pair a phone' }).click()
  await page.waitForSelector('img[alt="Pairing QR code"]', { timeout: 5000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'shots/companion-qr.png' })
  console.log('settings screenshots written')
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
