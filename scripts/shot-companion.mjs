// Screenshots of the companion web app at phone size, served by a live kiosk
// (a second Electron BrowserWindow stands in for the phone browser).
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-cshot-'))
mkdirSync('shots', { recursive: true })
const PORT = 8424

const app = await electron.launch({
  executablePath: electronPath,
  args: ['out/main/index.js', '--windowed'],
  env: { ...process.env, OSL_USER_DATA: userData }
})
try {
  const page = await app.firstWindow()
  await page.waitForSelector('[data-tile-type="todayEvents"]', { timeout: 15000 })

  // seed family data + enable companion
  const token = await page.evaluate(async (port) => {
    const inv = async (ch, p) => {
      const res = await window.osl.invoke(ch, p)
      if (!res.ok) throw new Error(`${ch}: ${res.error?.message}`)
      return res.data
    }
    const day = (off = 0) => {
      const d = new Date()
      d.setDate(d.getDate() + off)
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    }
    const emma = await inv('people:create', { name: 'Emma', color: '#46A758', role: 'child' })
    const leo = await inv('people:create', { name: 'Leo', color: '#0091FF', role: 'child' })
    const groceries = await inv('lists:create', { name: 'Groceries', color: '#46A758', kind: 'grocery' })
    for (const t of ['Milk', 'Eggs', 'Avocados', 'Coffee']) await inv('listItems:add', { listId: groceries.id, text: t })
    const items = (await inv('lists:getAll', undefined)).find((l) => l.id === groceries.id).items
    await inv('listItems:toggle', { id: items[0].id })
    const todos = await inv('lists:create', { name: 'Weekend projects', color: '#0091FF', kind: 'todo' })
    await inv('listItems:add', { listId: todos.id, text: 'Fix the gate latch' })
    await inv('meals:set', { date: day(), slot: 'breakfast', text: 'Pancakes' })
    await inv('meals:set', { date: day(), slot: 'dinner', text: 'Taco night' })
    await inv('meals:set', { date: day(1), slot: 'dinner', text: 'Sheet-pan salmon' })
    const c1 = await inv('chores:create', { title: 'Make bed', personId: emma.id, starsValue: 1, recurrence: { freq: 'daily' } })
    await inv('chores:create', { title: 'Feed the dog', personId: emma.id, starsValue: 2, recurrence: { freq: 'daily' } })
    await inv('chores:create', { title: 'Take out trash', personId: leo.id, starsValue: 2, recurrence: { freq: 'daily' } })
    await inv('chores:complete', { choreId: c1.id, date: day() })
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const at = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString() }
    const cals = await inv('calendars:list', undefined)
    await inv('events:create', { calendarId: cals[0].id, title: 'Soccer practice', start: at(16), end: at(17), tz: zone, allDay: false, personIds: [emma.id], recurrence: null })
    await inv('events:create', { calendarId: cals[0].id, title: 'Piano lesson', start: at(17), end: at(18), tz: zone, allDay: false, personIds: [leo.id], recurrence: null })

    await inv('settings:set', { patch: { companion: { enabled: true, port } } })
    await new Promise((r) => setTimeout(r, 500))
    const issued = await inv('companion:issueToken', undefined)
    return issued.url.split('#t=')[1]
  }, PORT)

  // open a phone-sized window on the companion URL
  await app.evaluate(({ BrowserWindow }, { port, token }) => {
    const win = new BrowserWindow({ width: 390, height: 760, show: true })
    void win.loadURL(`http://127.0.0.1:${port}/#t=${token}`)
  }, { port: PORT, token })

  const phone = await app.waitForEvent('window', { timeout: 10000 })
  await phone.waitForSelector('text=Groceries', { timeout: 10000 })
  await phone.waitForTimeout(600)
  await phone.screenshot({ path: 'shots/companion-lists.png' })

  await phone.getByRole('button', { name: /Meals/ }).click()
  await phone.waitForTimeout(600)
  await phone.screenshot({ path: 'shots/companion-meals.png' })

  await phone.getByRole('button', { name: /Chores/ }).click()
  await phone.waitForTimeout(600)
  await phone.screenshot({ path: 'shots/companion-chores.png' })

  await phone.getByRole('button', { name: /Agenda/ }).click()
  await phone.waitForTimeout(600)
  await phone.screenshot({ path: 'shots/companion-agenda.png' })

  console.log('companion screenshots written to shots/')
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
