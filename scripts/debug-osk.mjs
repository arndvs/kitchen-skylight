import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-dbg-'))
mkdirSync('shots', { recursive: true })

const app = await electron.launch({
  executablePath: electronPath,
  args: ['out/main/index.js', '--windowed'],
  env: { ...process.env, OSL_USER_DATA: userData }
})
try {
  const page = await app.firstWindow()
  await page.waitForSelector('text=Week', { timeout: 15000 })
  await page.getByLabel('Settings').click()
  await page.getByRole('button', { name: 'Add family member' }).click()
  await page.getByPlaceholder('Name').fill('Emma')
  await page.waitForTimeout(600)
  const info = await page.evaluate(() => {
    const save = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Save')
    const tray = document.querySelector('.simple-keyboard')?.closest('div.fixed')
    const dialogPanel = document.querySelector('.animate-pop')
    return {
      saveRect: save?.getBoundingClientRect().toJSON(),
      trayRect: tray?.getBoundingClientRect().toJSON(),
      dialogRect: dialogPanel?.getBoundingClientRect().toJSON(),
      dialogParentClass: dialogPanel?.parentElement?.className,
      activeTag: document.activeElement?.tagName,
      winH: window.innerHeight
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await page.screenshot({ path: 'shots/debug-osk.png' })
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
