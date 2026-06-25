// E2E: BirdNET tile against a stub BirdNET-Go server. Verifies the picker
// normalizes a dashboard URL, a detection row renders, the photo loads through
// the osl-bird:// proxy, and the tile persists across relaunch.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const userData = mkdtempSync(join(tmpdir(), 'osl-birdnet-'))
mkdirSync('shots', { recursive: true })

// a 1x1 transparent PNG for the species photo
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

let mediaHits = 0
const stub = createServer((req, res) => {
  if (req.url.startsWith('/api/v2/detections')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        data: [
          { id: 1, commonName: 'Northern Cardinal', scientificName: 'Cardinalis cardinalis', confidence: 0.94, timestamp: new Date().toISOString() },
          { id: 2, commonName: 'Blue Jay', scientificName: 'Cyanocitta cristata', confidence: 0.81, timestamp: new Date(Date.now() - 120000).toISOString() }
        ],
        total: 2
      })
    )
    return
  }
  if (req.url.startsWith('/media/image/')) {
    mediaHits += 1
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(PNG)
    return
  }
  res.writeHead(404).end()
})
await new Promise((r) => stub.listen(0, '127.0.0.1', r))
const port = stub.address().port
const stubBase = `http://127.0.0.1:${port}`

async function launch() {
  const app = await electron.launch({
    executablePath: electronPath,
    args: ['out/main/index.js', '--windowed'],
    env: { ...process.env, OSL_USER_DATA: userData }
  })
  const page = await app.firstWindow()
  await page.waitForSelector('[data-tile-type="todayEvents"]', { timeout: 15000 })
  return { app, page }
}

{
  const { app, page } = await launch()
  try {
    await page.getByLabel('Customize home screen').click()
    await page.getByLabel('Remove This week').click() // free up room
    await page.getByRole('button', { name: 'Add tile' }).click()
    await page.getByRole('button', { name: /Birds Recent detections/ }).click()
    await page.waitForSelector('text=BirdNET-Go address', { timeout: 5000 })

    // paste the DASHBOARD url; the service must normalize it to the origin
    await page.getByPlaceholder('http://192.168.0.208:8080').fill(`${stubBase}/ui/dashboard`)
    await page.getByRole('button', { name: 'Test & place tile' }).click()
    await page.waitForSelector('[data-tile-type="birdnet"]', { timeout: 5000 })

    // a detection renders, and the species photo loads through osl-bird://
    await page.waitForSelector('text=Northern Cardinal', { timeout: 5000 })
    await page.waitForFunction(
      () => {
        const img = document.querySelector('[data-tile-type="birdnet"] img')
        return img && img.currentSrc && img.naturalWidth > 0
      },
      null,
      { timeout: 8000 }
    )
    if (mediaHits === 0) throw new Error('osl-bird proxy never fetched the species image')

    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.waitForSelector('text=Done', { state: 'detached', timeout: 5000 })
    await page.screenshot({ path: 'shots/birdnet-tile.png' })
  } finally {
    await app.close()
  }
}

{
  const { app, page } = await launch()
  try {
    const tile = await page.evaluate(async () => {
      const res = await window.osl.invoke('settings:getAll', undefined)
      return res.data.homeLayout.find((t) => t.type === 'birdnet')
    })
    if (!tile?.config?.birdnetUrl) throw new Error(`birdnet tile not persisted: ${JSON.stringify(tile)}`)
    if (tile.config.birdnetUrl !== stubBase)
      throw new Error(`expected normalized origin ${stubBase}, got ${tile.config.birdnetUrl}`)
    await page.waitForSelector('[data-tile-type="birdnet"]', { timeout: 5000 })
    console.log('BIRDNET E2E PASS: dashboard URL normalized, detections + photo render, persisted across relaunch')
  } finally {
    await app.close()
    stub.close()
    rmSync(userData, { recursive: true, force: true })
  }
}
