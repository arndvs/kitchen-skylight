// Generates the companion PWA icons (ember tile + warm sun disc) without any
// image dependencies — hand-rolled PNG encoding over raw RGBA.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const EMBER = [0xd9, 0x5b, 0x3a]
const EMBER_DEEP = [0xbf, 0x45, 0x26]
const SUN = [0xfd, 0xf0, 0xda]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = (table[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let off = 0
  for (let y = 0; y < size; y++) {
    raw[off++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y)
      raw[off++] = r
      raw[off++] = g
      raw[off++] = b
      raw[off++] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** Full-bleed ember tile (maskable-safe) with a soft sun disc and a horizon line. */
function icon(size) {
  const c = size / 2
  const sunR = size * 0.27
  const sunY = size * 0.44
  const horizonY = size * 0.66
  return encodePng(size, (x, y) => {
    // background: subtle vertical gradient ember -> ember-deep
    const t = y / size
    let px = [
      Math.round(EMBER[0] + (EMBER_DEEP[0] - EMBER[0]) * t),
      Math.round(EMBER[1] + (EMBER_DEEP[1] - EMBER[1]) * t),
      Math.round(EMBER[2] + (EMBER_DEEP[2] - EMBER[2]) * t)
    ]
    const d = Math.hypot(x - c, y - sunY)
    if (d < sunR && y < horizonY) {
      // sun disc with 2px-ish soft edge
      const edge = Math.min(1, (sunR - d) / (size * 0.012))
      px = [
        Math.round(px[0] + (SUN[0] - px[0]) * edge),
        Math.round(px[1] + (SUN[1] - px[1]) * edge),
        Math.round(px[2] + (SUN[2] - px[2]) * edge)
      ]
    }
    // horizon: two thin paper lines like a planner page
    for (const [ly, alpha] of [
      [horizonY, 0.85],
      [horizonY + size * 0.085, 0.45],
      [horizonY + size * 0.17, 0.25]
    ]) {
      if (Math.abs(y - ly) < size * 0.013) {
        px = [
          Math.round(px[0] + (SUN[0] - px[0]) * alpha),
          Math.round(px[1] + (SUN[1] - px[1]) * alpha),
          Math.round(px[2] + (SUN[2] - px[2]) * alpha)
        ]
      }
    }
    return [...px, 255]
  })
}

const outDir = join(import.meta.dirname, '../src/companion/public')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'icon-192.png'), icon(192))
writeFileSync(join(outDir, 'icon-512.png'), icon(512))
console.log('companion icons written to', outDir)
