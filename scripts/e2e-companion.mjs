// E2E: companion LAN API — enable the server, pair, exercise auth + the RPC
// allowlist over real HTTP, and prove a phone-side mutation shows up in the
// kiosk UI via the change broadcast. Static shell served from out/companion.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-companion-'))
const PORT = 8423 // uncommon port so a dev kiosk on 8420 doesn't collide

const app = await electron.launch({
  executablePath: electronPath,
  args: ['out/main/index.js', '--windowed'],
  env: { ...process.env, OSL_USER_DATA: userData }
})

try {
  const page = await app.firstWindow()
  await page.waitForSelector('[data-tile-type="todayEvents"]', { timeout: 15000 })

  // enable the companion server and pair (no PIN on fresh data — gates open)
  const { token, status } = await page.evaluate(async (port) => {
    const set = await window.osl.invoke('settings:set', { patch: { companion: { enabled: true, port } } })
    if (!set.ok) throw new Error(`settings:set failed: ${set.error?.message}`)
    await new Promise((r) => setTimeout(r, 500)) // listen() is async
    const issued = await window.osl.invoke('companion:issueToken', undefined)
    if (!issued.ok) throw new Error(`issueToken failed: ${issued.error?.message}`)
    const status = await window.osl.invoke('companion:getStatus', undefined)
    return { token: issued.data.url.split('#t=')[1], status: status.data }
  }, PORT)
  if (!status.running) throw new Error(`server not running: ${JSON.stringify(status)}`)
  if (status.pairedCount !== 1) throw new Error(`expected 1 paired device, got ${status.pairedCount}`)

  const base = `http://127.0.0.1:${PORT}`
  const rpc = (channel, payload, bearer = token) =>
    fetch(`${base}/api/rpc/${channel}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: payload === undefined ? '' : JSON.stringify(payload)
    })

  // health is open; everything else needs the token
  const health = await fetch(`${base}/api/health`)
  if (health.status !== 200) throw new Error(`health: ${health.status}`)
  if ((await rpc('lists:getAll', undefined, 'wrong-token')).status !== 401) throw new Error('expected 401')

  // gated channels are invisible even when authenticated
  if ((await rpc('settings:set', { patch: {} })).status !== 404) throw new Error('settings:set must 404')
  if ((await rpc('auth:setPin', { pin: null })).status !== 404) throw new Error('auth:setPin must 404')

  // the static shell serves
  const shell = await fetch(`${base}/`)
  if (shell.status !== 200 || !(await shell.text()).includes('OpenSkyLight')) throw new Error('shell not served')

  // a "phone" mutation: create a list + item, set a meal, then verify the data
  const created = await (await rpc('lists:create', { name: 'Phone groceries', color: '#46A758', kind: 'grocery' })).json()
  if (!created.ok) throw new Error(`lists:create: ${JSON.stringify(created)}`)
  const item = await (await rpc('listItems:add', { listId: created.data.id, text: 'Oat milk' })).json()
  if (!item.ok) throw new Error(`listItems:add: ${JSON.stringify(item)}`)
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const meal = await (await rpc('meals:set', { date: today, slot: 'dinner', text: 'Phone tacos' })).json()
  if (!meal.ok) throw new Error(`meals:set: ${JSON.stringify(meal)}`)

  // zod still guards the HTTP path
  const invalid = await (await rpc('lists:create', { name: '', color: 'red', kind: 'grocery' })).json()
  if (invalid.ok || invalid.error.code !== 'INVALID') throw new Error(`expected INVALID, got ${JSON.stringify(invalid)}`)

  // the kiosk UI must reflect the phone's edit WITHOUT a reload (broadcast → invalidation)
  await page.getByRole('button', { name: 'Lists', exact: true }).click()
  await page.waitForSelector('text=Phone groceries', { timeout: 5000 })
  await page.waitForSelector('text=Oat milk', { timeout: 5000 })

  // unpair-all kills the token
  await page.evaluate(() => window.osl.invoke('companion:unpairAll', undefined))
  if ((await rpc('lists:getAll', undefined)).status !== 401) throw new Error('expected 401 after unpairAll')

  // disabling the setting stops the server
  await page.evaluate(async (port) => {
    await window.osl.invoke('settings:set', { patch: { companion: { enabled: false, port } } })
  }, PORT)
  await new Promise((r) => setTimeout(r, 500))
  const downStatus = await page.evaluate(async () => (await window.osl.invoke('companion:getStatus', undefined)).data)
  if (downStatus.running) throw new Error('server still running after disable')

  console.log('COMPANION E2E PASS: pair, auth, allowlist, phone edit visible on kiosk, unpair, disable')
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
