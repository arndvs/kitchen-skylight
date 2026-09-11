// E2E: verify a SECOND drag works after the first (regression for "can only
// drag one"). Creates three lists, drags the first right, then drags the
// (new) first list right again.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-lists-double-'))
mkdirSync('shots', { recursive: true })

const app = await electron.launch({
  executablePath: electronPath,
  args: ['out/main/index.js', '--windowed'],
  env: { ...process.env, OSL_USER_DATA: userData }
})

async function dragHeaderRight(page, listId, px) {
  const box = await page.locator(`[data-list-id="${listId}"]`).boundingBox()
  if (!box) throw new Error(`list ${listId} not found`)
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
  await page.getByRole('button', { name: 'Lists', exact: true }).click()

  for (const name of ['Alpha', 'Bravo', 'Charlie']) {
    await page.getByRole('button', { name: 'New list' }).click()
    await page.getByPlaceholder('e.g. Groceries').fill(name)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForSelector(`text=${name}`, { timeout: 5000 })
  }

  const order = async () =>
    page.locator('[data-list-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-list-id')))

  const before = await order()
  console.log('initial:', before)

  // FIRST drag: move list[0] right
  await dragHeaderRight(page, before[0], 500)
  const after1 = await order()
  console.log('after 1st drag:', after1)
  if (after1[0] === before[0]) throw new Error('first drag did not reorder')

  // SECOND drag: move the (new) first list right again
  await dragHeaderRight(page, after1[0], 500)
  const after2 = await order()
  console.log('after 2nd drag:', after2)
  if (after2[0] === after1[0]) throw new Error('SECOND drag did not reorder — can only drag one')

  console.log('DOUBLE DRAG PASS: both drags reordered')
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}