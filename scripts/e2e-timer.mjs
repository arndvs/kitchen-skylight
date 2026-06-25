// E2E: timer tile — add it, start a preset timer (counts down + persists across
// reload), fast-forward the clock to the alarm (ringing "Done!"), then dismiss.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-timer-'))
mkdirSync('shots', { recursive: true })

const app = await electron.launch({
  executablePath: electronPath,
  args: ['out/main/index.js', '--windowed'],
  env: { ...process.env, OSL_USER_DATA: userData }
})

try {
  const page = await app.firstWindow()
  await page.waitForSelector('[data-tile-type="todayEvents"]', { timeout: 15000 })

  // add the timer tile
  await page.getByLabel('Customize home screen').click()
  await page.getByLabel('Remove This week').click() // free up room
  await page.getByRole('button', { name: 'Add tile' }).click()
  await page.getByRole('button', { name: /Timers Countdown/ }).click()
  await page.waitForSelector('[data-tile-type="timer"]', { timeout: 5000 })
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.waitForSelector('text=Done', { state: 'detached', timeout: 5000 })

  // start a 1-minute timer — a countdown row appears
  await page.getByLabel('Start a 1m timer').click()
  await page.waitForFunction(
    () => /(1:00|0:[0-5]\d)/.test(document.querySelector('[data-tile-type="timer"]')?.textContent ?? ''),
    null,
    { timeout: 5000 }
  )

  // persists across a reload (localStorage, absolute end time)
  await page.reload()
  await page.waitForSelector('[data-tile-type="timer"]', { timeout: 15000 })
  await page.waitForFunction(
    () => /(1:00|0:[0-5]\d)/.test(document.querySelector('[data-tile-type="timer"]')?.textContent ?? ''),
    null,
    { timeout: 5000 }
  )

  // fast-forward past the end → the timer rings
  await page.clock.install({ time: Date.now() })
  await page.clock.fastForward(62_000)
  await page.waitForSelector('[data-tile-type="timer"] >> text=Done!', { timeout: 5000 })
  await page.screenshot({ path: 'shots/timer-ringing.png' })

  // dismiss it → the row clears
  await page.getByLabel(/Dismiss/).click()
  await page.waitForSelector('[data-tile-type="timer"] >> text=Done!', { state: 'detached', timeout: 5000 })

  console.log('TIMER E2E PASS: tile added, preset counts down, persists across reload, rings, dismisses')
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
