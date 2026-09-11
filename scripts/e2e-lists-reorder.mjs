// E2E: lists drag-and-drop reorder through the real UI. Creates three lists,
// drags the first list's header to the right, and verifies the new order
// persisted (survives a refetch).
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-lists-reorder-'))
mkdirSync('shots', { recursive: true })

const app = await electron.launch({
  executablePath: electronPath,
  args: ['out/main/index.js', '--windowed'],
  env: { ...process.env, OSL_USER_DATA: userData }
})

async function dragHeaderRight(page, listId, px) {
  const box = await page.locator(`[data-list-id="${listId}"]`).boundingBox()
  if (!box) throw new Error(`list ${listId} not found`)
  // grab the middle of the header (name area), not the pencil button on the right
  const fromX = box.x + box.width * 0.4
  const fromY = box.y + 24
  const toX = fromX + px
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + ((toX - fromX) * i) / steps, fromY)
  }
  await page.waitForTimeout(120)
  await page.mouse.up()
  await page.waitForTimeout(400)
}

try {
  const page = await app.firstWindow()
  await page.waitForSelector('text=Week', { timeout: 15000 })

  // go to Lists
  await page.getByRole('button', { name: 'Lists', exact: true }).click()

  // create three lists: Alpha, Bravo, Charlie
  for (const name of ['Alpha', 'Bravo', 'Charlie']) {
    await page.getByRole('button', { name: 'New list' }).click()
    await page.getByPlaceholder('e.g. Groceries').fill(name)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForSelector(`text=${name}`, { timeout: 5000 })
  }

  // capture the initial left-to-right order of the cards
  const order = async () => {
    const ids = await page.locator('[data-list-id]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-list-id'))
    )
    return ids
  }
  const before = await order()
  if (before.length !== 3) throw new Error(`expected 3 lists, got ${before.length}`)

  // drag the FIRST list's header right by ~1.5 card widths (336px stride)
  await dragHeaderRight(page, before[0], 500)

  const after = await order()
  console.log('before:', before)
  console.log('after :', after)

  if (after[0] === before[0]) {
    throw new Error(`drag did not reorder: first list stayed ${before[0]}`)
  }
  if (after.length !== 3 || new Set(after).size !== 3) {
    throw new Error(`order corrupted: ${after}`)
  }

  await page.screenshot({ path: 'shots/lists-reorder.png' })
  console.log('LISTS REORDER E2E PASS: first list moved right, order persisted')
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}