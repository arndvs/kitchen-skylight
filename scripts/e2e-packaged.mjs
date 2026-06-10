// Boots the PACKAGED app (dist/win-unpacked) to verify asar paths and the
// rebuilt native module work outside the dev harness.
import { _electron as electron } from 'playwright-core'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const userData = mkdtempSync(join(tmpdir(), 'osl-packaged-'))
mkdirSync('shots', { recursive: true })

const app = await electron.launch({
  executablePath: resolve('dist/win-unpacked/OpenSkyLight.exe'),
  args: ['--windowed'],
  env: { ...process.env, OSL_USER_DATA: userData }
})

try {
  const page = await app.firstWindow()
  await page.waitForSelector('text=Week', { timeout: 20000 })
  // prove the database works in the packaged build
  await page.getByLabel('Add event').click()
  await page.getByPlaceholder("What's happening?").fill('Packaged smoke')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForSelector('text=Packaged smoke', { timeout: 5000 })
  await page.screenshot({ path: 'shots/packaged.png' })
  console.log('PACKAGED E2E PASS: installed build boots and persists events')
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
