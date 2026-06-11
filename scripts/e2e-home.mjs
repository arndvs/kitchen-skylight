// E2E: customizable home screen — boots to Home by default, edit mode can
// remove, drag, resize, and add tiles, and the layout persists across relaunch.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-home-'))
mkdirSync('shots', { recursive: true })

const GAP = 12
const COLS = 12
const ROWS = 6

async function launch() {
  const app = await electron.launch({
    executablePath: electronPath,
    args: ['out/main/index.js', '--windowed'],
    env: { ...process.env, OSL_USER_DATA: userData }
  })
  const page = await app.firstWindow()
  await page.waitForSelector('[data-tile-type="todayEvents"]', { timeout: 15000 }) // home is the boot view
  return { app, page }
}

async function cellMath(page) {
  const grid = await page.locator('[data-home-grid]').boundingBox()
  const cellW = (grid.width - GAP * (COLS - 1)) / COLS
  const cellH = (grid.height - GAP * (ROWS - 1)) / ROWS
  const cellCenter = (x, y, w, h) => ({
    x: grid.x + x * (cellW + GAP) + (w * cellW + (w - 1) * GAP) / 2,
    y: grid.y + y * (cellH + GAP) + (h * cellH + (h - 1) * GAP) / 2
  })
  return { grid, cellW, cellH, cellCenter }
}

async function dragTo(page, fromX, fromY, toX, toY) {
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + ((toX - fromX) * i) / steps, fromY + ((toY - fromY) * i) / steps)
  }
  await page.waitForTimeout(120)
  await page.mouse.up()
  await page.waitForTimeout(250)
}

{
  const { app, page } = await launch()
  try {
    // enter edit mode (no PIN on fresh data — opens directly)
    await page.getByLabel('Customize home screen').click()
    await page.waitForSelector('text=Done', { timeout: 5000 })

    // remove meals + chores tiles, opening a 3x4 hole at (9,0)
    await page.getByLabel('Remove Meals today').click()
    await page.getByLabel('Remove Chores progress').click()
    await page.waitForSelector('[data-tile-type="meals"]', { state: 'detached', timeout: 5000 })

    // drag the stars tile (3x2 at 9,4) into the hole at (9,0)
    const { cellCenter, cellH } = await cellMath(page)
    const from = cellCenter(9, 4, 3, 2)
    const to = cellCenter(9, 0, 3, 2)
    await dragTo(page, from.x, from.y, to.x, to.y)
    const movedBox = await page.locator('[data-tile-id="default-starBalances"]').boundingBox()
    const expected = cellCenter(9, 0, 3, 2)
    if (Math.abs(movedBox.y + movedBox.height / 2 - expected.y) > cellH / 2) {
      throw new Error(`drag failed: tile center ${movedBox.y + movedBox.height / 2} vs expected ${expected.y}`)
    }

    // resize it one cell taller via the corner grip (it sits at the right
    // edge, so growing wider would be out of bounds)
    const heightBefore = movedBox.height
    const grip = await page.locator('[data-tile-id="default-starBalances"] [data-resize-handle]').boundingBox()
    await dragTo(page, grip.x + grip.width / 2, grip.y + grip.height / 2, grip.x + grip.width / 2, grip.y + grip.height / 2 + cellH + GAP)
    const heightAfter = (await page.locator('[data-tile-id="default-starBalances"]').boundingBox()).height
    if (heightAfter - heightBefore < cellH * 0.6) {
      throw new Error(`resize failed: height ${heightBefore} -> ${heightAfter}`)
    }

    // add-tile sheet: a placed singleton is disabled, photo can be added
    await page.getByRole('button', { name: 'Add tile' }).click()
    const weekDisabled = await page.getByRole('button', { name: 'This week Already added' }).isDisabled()
    if (!weekDisabled) throw new Error('expected This week tile entry to be disabled (already placed)')
    await page.getByRole('button', { name: /Cycling photos/ }).click()
    await page.waitForSelector('[data-tile-type="photo"]', { timeout: 5000 })

    // save
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.waitForSelector('text=Done', { state: 'detached', timeout: 5000 })
    await page.screenshot({ path: 'shots/home-edited.png' })
  } finally {
    await app.close()
  }
}

// relaunch with the SAME user data — the layout must have persisted
{
  const { app, page } = await launch()
  try {
    const layout = await page.evaluate(async () => {
      const res = await window.osl.invoke('settings:getAll', undefined)
      return res.data.homeLayout
    })
    const stars = layout.find((t) => t.id === 'default-starBalances')
    if (!stars || stars.x !== 9 || stars.y !== 0 || stars.w !== 3 || stars.h !== 3) {
      throw new Error(`persisted stars tile wrong: ${JSON.stringify(stars)}`)
    }
    if (layout.some((t) => t.type === 'meals')) throw new Error('removed meals tile came back')
    if (!layout.some((t) => t.type === 'photo')) throw new Error('added photo tile missing')
    if ((await page.locator('[data-tile-type="meals"]').count()) !== 0) throw new Error('meals tile rendered')
    await page.waitForSelector('[data-tile-type="photo"]', { timeout: 5000 })
    console.log('HOME E2E PASS: default boot, remove/drag/resize/add all persisted across relaunch')
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
}
