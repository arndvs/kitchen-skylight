// Launches the built app via Playwright's Electron driver and saves screenshots.
// Usage: node scripts/screenshot.mjs [outputDir]
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const outDir = process.argv[2] ?? 'shots'
mkdirSync(outDir, { recursive: true })

const app = await electron.launch({
  executablePath: electronPath,
  args: ['out/main/index.js', '--windowed']
})
const page = await app.firstWindow()
await page.setViewportSize({ width: 1600, height: 900 }).catch(() => {})
await page.waitForTimeout(2500)
await page.screenshot({ path: join(outDir, 'week.png') })

// Open the event editor via the FAB
await page.mouse.click(1520, 825)
await page.waitForTimeout(700)
await page.screenshot({ path: join(outDir, 'editor.png') })

console.log('screenshots written to', outDir)
await app.close()
