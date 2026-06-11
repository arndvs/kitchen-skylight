// E2E: theme switching — explicit dark/light apply immediately, and 'auto'
// matches the expected sun/fallback rule for the current local time.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-theme-'))
mkdirSync('shots', { recursive: true })

const app = await electron.launch({
  executablePath: electronPath,
  args: ['out/main/index.js', '--windowed'],
  env: { ...process.env, OSL_USER_DATA: userData }
})

try {
  const page = await app.firstWindow()
  await page.waitForSelector('[data-tile-type="clock"]', { timeout: 15000 })

  const setTheme = (theme) =>
    page.evaluate((t) => window.osl.invoke('settings:set', { patch: { theme: t } }), theme)
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'))

  await setTheme('dark')
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'), null, { timeout: 5000 })
  await page.waitForTimeout(800) // let the bg transition settle for the screenshot
  await page.screenshot({ path: 'shots/home-dark.png' })

  await setTheme('light')
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'), null, { timeout: 5000 })

  // auto without a location follows the 19:00–07:00 fallback
  await setTheme('auto')
  const hour = new Date().getHours()
  const expectDark = hour >= 19 || hour < 7
  await page.waitForTimeout(600)
  if ((await isDark()) !== expectDark) {
    throw new Error(`auto theme mismatch: local hour ${hour}, expected dark=${expectDark}`)
  }

  console.log('THEME E2E PASS: dark/light apply instantly, auto follows the sun rule')
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
