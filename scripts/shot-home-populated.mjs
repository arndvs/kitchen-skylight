// Seeds data through the real IPC layer and screenshots the populated home screen.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-shot-'))
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
    const inv = (ch, p) => window.osl.invoke(ch, p)
    const day = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    const at = (h, m = 0) => {
      const d = new Date()
      d.setHours(h, m, 0, 0)
      return d.toISOString()
    }
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const emma = (await inv('people:create', { name: 'Emma', color: '#46A758', role: 'child' })).data
    const leo = (await inv('people:create', { name: 'Leo', color: '#0091FF', role: 'child' })).data
    const cals = (await inv('calendars:list', undefined)).data
    const mk = (title, h, personIds, dur = 1) =>
      inv('events:create', {
        calendarId: cals[0].id, title, start: at(h), end: at(h + dur), tz: zone,
        allDay: false, personIds, recurrence: null
      })
    await mk('Soccer practice', 16, [emma.id])
    await mk('Piano lesson', 17, [leo.id])
    await mk('Family movie night', 19, [emma.id, leo.id], 2)
    const chore = (t, p) => inv('chores:create', { title: t, personId: p, starsValue: 2, recurrence: { freq: 'daily' } })
    const c1 = (await chore('Make bed', emma.id)).data
    await chore('Feed the dog', emma.id)
    const c2 = (await chore('Take out trash', leo.id)).data
    await inv('chores:complete', { choreId: c1.id, date: day })
    await inv('chores:complete', { choreId: c2.id, date: day })
    await inv('meals:set', { date: day, slot: 'dinner', text: 'Taco night' })
    await inv('meals:set', { date: day, slot: 'breakfast', text: 'Pancakes' })
  })
  // seeding bypassed React Query, so reload to refetch everything
  await page.reload()
  await page.waitForSelector('[data-tile-type="clock"]', { timeout: 15000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'shots/home-populated.png' })
  console.log('screenshot saved')
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
