// import-recipes.cjs — Import markdown/plain recipes into the Kitchen Skylight DB.
//
// Runs as an Electron main script so the native better-sqlite3 module loads.
// Best run while the app is stopped (the DB is open in WAL mode).
//
// Recipe markdown convention — one recipe per file, or many separated by `---`:
//
//   # Fluffy Pancakes
//   tags: breakfast, easy
//   servings: 4
//   prep: 5
//   cook: 10
//   source: https://example.com/pancakes
//
//   ## Ingredients
//   - 1 cup flour
//   - 2 eggs
//
//   ## Directions
//   1. Whisk dry ingredients.
//   2. Cook on a hot griddle.
//
// Usage (from the repo root):
//   ./node_modules/.bin/electron scripts/import-recipes.cjs <file-or-dir> [dbPath]
"use strict"

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const Database = require('better-sqlite3')

// Minimal uuidv7 (the app uses @shared/uuid; replicate enough for a stable id).
function uuidv7() {
  const bytes = Buffer.alloc(16)
  const now = Date.now()
  bytes.writeUInt32BE(now >>> 0, 0)
  bytes.writeUInt16BE((now >> 32) & 0xffff, 4) // 48-bit ms timestamp (best-effort)
  for (let i = 6; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function defaultDbPath() {
  return path.join(os.homedir(), 'AppData', 'Roaming', 'kitchen-skylight', 'kitchen-skylight.db')
}

function parseRecipe(text) {
  const lines = text.split(/\r?\n/)
  const title = (lines[0] || '').trim().replace(/^#\s+/, '')
  if (!title) throw new Error('recipe missing an H1 title')

  const meta = {}
  const ingredients = []
  const directions = []
  let section = null

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^##\s*ingredients\b/i.test(line)) { section = 'ingredients'; continue }
    if (/^##\s*(?:directions|instructions|steps)\b/i.test(line)) { section = 'directions'; continue }
    if (/^##\s+/i.test(line)) { section = null; continue }

    if (section === null) {
      const m = /^([a-z]+)\s*:\s*(.+)$/i.exec(line.trim())
      if (m) meta[m[1].toLowerCase()] = m[2].trim()
    } else if (section === 'ingredients') {
      const ing = line.replace(/^\s*[-*]\s*/, '').trim()
      if (ing) ingredients.push(ing)
    } else if (section === 'directions') {
      const step = line.replace(/^\s*\d+[.)]\s*/, '').trim()
      if (step) directions.push(step)
    }
  }

  const num = (v) => (v !== undefined && v !== '' ? Number(v) || null : null)
  return {
    title,
    ingredients,
    instructions: directions.join('\n') || null,
    tags: (meta.tags || '').split(/[,\s]+/).filter(Boolean),
    servings: num(meta.servings),
    prepMinutes: num(meta.prep),
    cookMinutes: num(meta.cook),
    srcUrl: meta.source || null
  }
}

function collectFiles(arg) {
  if (!arg) {
    stderr('Usage: electron scripts/import-recipes.cjs <file.md | dir> [dbPath]')
    process.exit(2)
  }
  const p = path.resolve(arg)
  if (fs.existsSync(p)) {
    if (path.extname(p).toLowerCase() === '.md') return [p]
    const files = fs.readdirSync(p).filter((f) => path.extname(f).toLowerCase() === '.md').map((f) => path.join(p, f))
    if (files.length === 0) { stderr(`No .md files in ${p}`); process.exit(2) }
    return files
  }
  stderr(`Not found: ${p}`)
  process.exit(2)
}

const out = (m) => { process.stdout.write(m + '\n') }
const stderr = (m) => { process.stderr.write(m + '\n') }
const nowIso = () => new Date().toISOString()

function main() {
  const files = collectFiles(process.argv[2])
  const dbPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultDbPath()
  if (!fs.existsSync(dbPath)) {
    stderr(`DB not found at ${dbPath} — start the app once first.`)
    process.exit(2)
  }

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  const upsert = sqlite.prepare(`
    INSERT INTO recipes (id, title, ingredients, instructions, image_path, tags, servings, prep_minutes, cook_minutes, src_url, created_at, deleted_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL)
  `)

  let created = 0
  let skipped = 0
  const seen = new Set()

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    const blocks = text.split(/^---\s*$/m).filter((b) => b.trim())
    for (const block of blocks) {
      try {
        const r = parseRecipe(block)
        if (seen.has(r.title.toLowerCase())) { skipped++; stderr(`✗ duplicate: ${r.title}`); continue }
        seen.add(r.title.toLowerCase())
        upsert.run(
          uuidv7(),
          r.title,
          JSON.stringify(r.ingredients),
          r.instructions,
          JSON.stringify(r.tags),
          r.servings,
          r.prepMinutes,
          r.cookMinutes,
          r.srcUrl,
          nowIso()
        )
        created++
        out(`✓ imported: ${r.title}`)
      } catch (e) {
        skipped++
        stderr(`✗ skipped from ${file}: ${e.message}`)
      }
    }
  }
  const count = sqlite.prepare('SELECT COUNT(*) AS c FROM recipes WHERE deleted_at IS NULL').get().c
  sqlite.close()
  out(`\nDone. ${created} imported, ${skipped} skipped. Total recipes now: ${count}`)
  process.exit(0)
}

main()