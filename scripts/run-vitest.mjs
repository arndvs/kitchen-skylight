// Runs vitest inside Electron's Node runtime (ELECTRON_RUN_AS_NODE) so that
// better-sqlite3 — compiled against Electron's ABI — loads in tests too.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electronPath = require('electron')

const result = spawnSync(electronPath, ['./node_modules/vitest/vitest.mjs', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
process.exit(result.status ?? 1)
